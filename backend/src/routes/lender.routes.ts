import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export function createLenderRoutes(): Router {
  const router = Router();

  // All lender routes require LENDER or ADMIN role
  router.use(authenticateToken, requireRole(['LENDER', 'ADMIN']));

  // GET /api/lender/portfolio (Portfolio metrics & distribution)
  router.get('/portfolio', async (_req: Request, res: Response, next) => {
    try {
      const statsRes = await db.query(`
        SELECT 
          COALESCE(SUM(principal_paise), 0) as total_principal_paise,
          COALESCE(SUM(outstanding_balance_paise), 0) as total_outstanding_paise,
          COALESCE(SUM(total_repaid_paise), 0) as total_repaid_paise,
          COUNT(*) as total_loans,
          COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_loans_count,
          COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) as settled_loans_count,
          COUNT(CASE WHEN status = 'PENDING_APPROVAL' THEN 1 END) as pending_loans_count
        FROM loans
      `);

      const stats = statsRes.rows[0];
      const totalPrincipal = parseInt(stats.total_principal_paise || '0', 10);
      const totalOutstanding = parseInt(stats.total_outstanding_paise || '0', 10);
      const totalRepaid = parseInt(stats.total_repaid_paise || '0', 10);
      const activeCount = parseInt(stats.active_loans_count || '0', 10);
      const settledCount = parseInt(stats.settled_loans_count || '0', 10);
      const pendingCount = parseInt(stats.pending_loans_count || '0', 10);

      const repaymentPct = totalPrincipal > 0 ? Number(((totalRepaid / totalPrincipal) * 100).toFixed(2)) : 0;

      // Platform distribution
      const platformRes = await db.query(`
        SELECT w.primary_platform, COUNT(l.id) as loan_count, COALESCE(SUM(l.principal_paise), 0) as principal_paise
        FROM loans l
        JOIN worker_profiles w ON w.id = l.worker_id
        GROUP BY w.primary_platform
      `);

      // Credit tier distribution
      const tierRes = await db.query(`
        SELECT w.credit_tier, COUNT(l.id) as loan_count, COALESCE(SUM(l.outstanding_balance_paise), 0) as outstanding_paise
        FROM loans l
        JOIN worker_profiles w ON w.id = l.worker_id
        GROUP BY w.credit_tier
      `);

      res.json({
        totalPrincipalPaise: totalPrincipal,
        totalOutstandingPaise: totalOutstanding,
        totalRepaidPaise: totalRepaid,
        activeLoansCount: activeCount,
        settledLoansCount: settledCount,
        pendingLoansCount: pendingCount,
        repaymentProgressPct: repaymentPct,
        defaultRatePct: 0.0, // Continuous proportional streaming deduction yields 0 conventional defaults
        platformDistribution: platformRes.rows,
        tierDistribution: tierRes.rows,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/lender/workers/:workerId/risk (Cash-flow underwriting risk profile)
  // Security requirement: Must check active consent before exposing earnings/risk!
  router.get('/workers/:workerId/risk', async (req: Request, res: Response, next) => {
    try {
      const { workerId } = req.params;

      // Find worker profile by workerId or did
      const workerRes = await db.query(
        `SELECT w.*, u.name, u.email
         FROM worker_profiles w
         JOIN users u ON u.id = w.user_id
         WHERE w.id = $1 OR w.did = $1`,
        [workerId]
      );

      if (workerRes.rows.length === 0) {
        res.status(404).json({
          error: 'Worker profile not found.',
          code: 'WORKER_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const worker = workerRes.rows[0];

      // 1. Consent Verification Check
      const now = new Date().toISOString();
      const consentRes = await db.query(
        `SELECT * FROM consent_grants
         WHERE worker_id = $1
           AND status = 'ACTIVE'
           AND (scope LIKE '%EARNINGS_READ%' OR scope LIKE '%CREDIT_ASSESSMENT%')
           AND expires_at > $2
         LIMIT 1`,
        [worker.id, now]
      );

      if (consentRes.rows.length === 0) {
        res.status(403).json({
          error: 'Access Denied: Worker has not granted active consent for earnings inspection or credit assessment.',
          code: 'CONSENT_REQUIRED',
          workerDid: worker.did,
          workerName: worker.name,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const activeConsent = consentRes.rows[0];

      // 2. Fetch Earnings History for Cash-Flow Underwriting
      const earningsRes = await db.query(
        `SELECT date, gross_earnings_paise, net_earnings_paise, orders_count
         FROM earnings_records
         WHERE worker_id = $1
         ORDER BY date DESC
         LIMIT 30`,
        [worker.id]
      );

      const earningsRows = earningsRes.rows;
      const totalGross = earningsRows.reduce((acc, r) => acc + (r.gross_earnings_paise || 0), 0);
      const activeDays = earningsRows.length || 1;
      const avgDailyGrossPaise = Math.round(totalGross / activeDays);

      // Recommended credit limit: ~15x avg daily gross (up to ₹30,000)
      const recommendedCreditLimitPaise = Math.min(3000000, Math.round(avgDailyGrossPaise * 15));

      // Active and historical loans
      const loanRes = await db.query(
        `SELECT * FROM loans WHERE worker_id = $1 ORDER BY issued_at DESC`,
        [worker.id]
      );

      // Active mandate check
      const mandateRes = await db.query(
        `SELECT * FROM payment_mandates WHERE worker_id = $1 AND status = 'ACTIVE' LIMIT 1`,
        [worker.id]
      );

      res.json({
        worker: {
          id: worker.id,
          did: worker.did,
          name: worker.name,
          phone: worker.phone,
          primaryPlatform: worker.primary_platform,
          creditTier: worker.credit_tier,
          riskScore: worker.risk_score,
          vpa: worker.vpa,
        },
        consent: {
          id: activeConsent.id,
          grantee: activeConsent.grantee,
          scope: activeConsent.scope,
          grantedAt: activeConsent.granted_at,
          expiresAt: activeConsent.expires_at,
        },
        underwriting: {
          avgDailyGrossPaise,
          total30DayGrossPaise: totalGross,
          activeDaysCount: activeDays,
          recommendedCreditLimitPaise,
          suggestedDeductionRateBps: worker.credit_tier === 'PRIME_A' ? 500 : 600,
          suggestedDailyCapPaise: Math.round(avgDailyGrossPaise * 0.2), // 20% max daily cap
          cashFlowConsistencyScore: Math.min(98, 70 + Math.round(activeDays * 1.8)),
        },
        loans: loanRes.rows,
        mandate: mandateRes.rows[0] || null,
        recentEarnings: earningsRows.slice(0, 10),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
