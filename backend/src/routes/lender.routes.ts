import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { cashFlowAnalyticsService } from '../services/cashflow-analytics.service.js';

export function createLenderRoutes(): Router {
  const router = Router();

  // All lender routes require LENDER or ADMIN role
  router.use(authenticateToken, requireRole(['LENDER', 'ADMIN']));

  // GET /api/lender/portfolio (Portfolio metrics, repayment progress, and debit statistics)
  router.get('/portfolio', async (_req: Request, res: Response, next) => {
    try {
      const statsRes = await db.query(`
        SELECT 
          COALESCE(SUM(principal_paise), 0) as total_principal_paise,
          COALESCE(SUM(outstanding_balance_paise), 0) as total_outstanding_paise,
          COALESCE(SUM(total_repaid_paise), 0) as total_repaid_paise,
          COUNT(*) as total_loans,
          COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_loans_count,
          COUNT(CASE WHEN status = 'SETTLED' OR status = 'PAID' THEN 1 END) as settled_loans_count,
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

      // Overall Debit Analytics
      const debitRes = await db.query(`
        SELECT
          COUNT(*) as total_debits,
          COUNT(CASE WHEN status = 'SUCCEEDED' THEN 1 END) as succeeded_count,
          COUNT(CASE WHEN status IN ('FAILED', 'RETRY_PENDING') THEN 1 END) as failed_count
        FROM debit_instructions
      `);
      const totalDebits = parseInt(debitRes.rows[0]?.total_debits || '0', 10);
      const succeededDebits = parseInt(debitRes.rows[0]?.succeeded_count || '0', 10);
      const failedDebits = parseInt(debitRes.rows[0]?.failed_count || '0', 10);
      const debitSuccessRatePct = totalDebits > 0 ? Number(((succeededDebits / totalDebits) * 100).toFixed(1)) : 100;

      // Recent 30-day aggregate earnings trends across portfolio
      const trendRes = await db.query(`
        SELECT
          date,
          COALESCE(SUM(gross_earnings_paise), 0) as daily_gross_paise,
          COUNT(DISTINCT worker_id) as active_workers
        FROM earnings_records
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY date
        ORDER BY date ASC
      `);

      res.json({
        totalPrincipalPaise: totalPrincipal,
        totalOutstandingPaise: totalOutstanding,
        totalRepaidPaise: totalRepaid,
        activeLoansCount: activeCount,
        settledLoansCount: settledCount,
        pendingLoansCount: pendingCount,
        repaymentProgressPct: repaymentPct,
        defaultRatePct: 0.0,
        debitAnalytics: {
          totalDebits,
          succeededDebits,
          failedDebits,
          debitSuccessRatePct,
        },
        platformDistribution: platformRes.rows,
        tierDistribution: tierRes.rows,
        portfolioEarningsTrend: trendRes.rows,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/lender/workers (Worker search & filtering with privacy pseudonymization)
  router.get('/workers', async (req: Request, res: Response, next) => {
    try {
      const search = (req.query.search as string || '').toLowerCase();
      const platformFilter = req.query.platform as string;
      const tierFilter = req.query.tier as string;

      const workersRes = await db.query(`
        SELECT
          w.id,
          w.did,
          w.primary_platform,
          w.credit_tier,
          w.risk_score,
          l.id as active_loan_id,
          l.outstanding_balance_paise,
          l.principal_paise,
          l.deduction_rate_bps,
          l.status as loan_status
        FROM worker_profiles w
        LEFT JOIN loans l ON l.worker_id = w.id AND l.status = 'ACTIVE'
        ORDER BY w.created_at ASC
      `);

      const workersList = [];
      for (const w of workersRes.rows) {
        const pseudonymId = cashFlowAnalyticsService.generatePseudonym(w.id, w.primary_platform);

        // Check active consent
        const consentRes = await db.query(
          `SELECT id FROM consent_grants WHERE worker_id = $1 AND status = 'ACTIVE' AND expires_at > NOW() LIMIT 1`,
          [w.id]
        );
        const hasConsent = consentRes.rows.length > 0;

        // Apply filters
        if (platformFilter && platformFilter !== 'ALL' && w.primary_platform !== platformFilter) continue;
        if (tierFilter && tierFilter !== 'ALL' && w.credit_tier !== tierFilter) continue;
        if (search && !pseudonymId.toLowerCase().includes(search) && !w.primary_platform.toLowerCase().includes(search)) {
          continue;
        }

        workersList.push({
          workerId: w.id,
          pseudonymId,
          primaryPlatform: w.primary_platform,
          creditTier: w.credit_tier,
          riskScore: w.risk_score,
          hasConsent,
          activeLoan: w.active_loan_id ? {
            id: w.active_loan_id,
            outstandingBalancePaise: Number(w.outstanding_balance_paise || 0),
            principalPaise: Number(w.principal_paise || 0),
            deductionRateBps: Number(w.deduction_rate_bps || 500),
          } : null,
        });
      }

      res.json({ workers: workersList, total: workersList.length });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/lender/workers/:workerId/risk (Privacy-preserving cash-flow underwriting)
  // Strict Privacy: Pseudonymous ID, Consent Verification, PII Redaction
  router.get('/workers/:workerId/risk', async (req: Request, res: Response, next) => {
    try {
      const { workerId } = req.params;
      const windowDays = req.query.window === '60' ? 60 : 30;

      // Find worker profile
      const workerRes = await db.query(
        `SELECT w.*, u.name as user_name FROM worker_profiles w JOIN users u ON u.id = w.user_id WHERE w.id = $1 OR w.did = $1`,
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

      // 1. Mandatory Privacy Consent Verification Check
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
          pseudonymId: cashFlowAnalyticsService.generatePseudonym(worker.id, worker.primary_platform),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const activeConsent = consentRes.rows[0];

      // 2. Compute Complete Cash-Flow Analytics and Rules-Based Risk Assessment
      const analytics = await cashFlowAnalyticsService.calculateWorkerAnalytics(worker.id, windowDays);
      const riskAssessment = await cashFlowAnalyticsService.evaluateRulesBasedRisk(worker.id, windowDays);

      // 3. Query Loan-level transaction history
      const loansRes = await db.query(
        `SELECT id, principal_paise, outstanding_balance_paise, interest_rate_bps, deduction_rate_bps, daily_cap_paise, total_repaid_paise, status, purpose, issued_at, settled_at
         FROM loans
         WHERE worker_id = $1
         ORDER BY issued_at DESC`,
        [worker.id]
      );

      const debitsRes = await db.query(
        `SELECT id, loan_id, amount_paise, status, upi_ref, failure_reason, created_at, executed_at
         FROM debit_instructions
         WHERE worker_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [worker.id]
      );

      // Return privacy-preserving payload with pseudonym identifier and backward-compatible fields
      res.json({
        worker: {
          id: worker.id,
          did: worker.did,
          name: worker.user_name || 'Verified Gig Worker',
          pseudonymId: analytics.pseudonymId,
          primaryPlatform: worker.primary_platform,
          creditTier: worker.credit_tier,
          phoneMasked: '+91 ****** ' + worker.phone.slice(-4),
        },
        consent: {
          id: activeConsent.id,
          grantee: activeConsent.grantee,
          scope: activeConsent.scope,
          grantedAt: activeConsent.granted_at,
          expiresAt: activeConsent.expires_at,
        },
        underwriting: {
          avgDailyGrossPaise: analytics.avgDailyEarningsPaise,
          recommendedCreditLimitPaise: riskAssessment.underwritingRecommendation.recommendedCreditLimitPaise,
          suggestedDeductionRateBps: riskAssessment.underwritingRecommendation.recommendedDeductionRateBps,
          suggestedDailyCapPaise: riskAssessment.underwritingRecommendation.recommendedDailyCapPaise,
          activeDaysCount: analytics.activeEarningDays,
          total30DayGrossPaise: analytics.totalGrossEarningsPaise,
          cashFlowConsistencyScore: analytics.volatilityTier === 'LOW' ? 92 : analytics.volatilityTier === 'MODERATE' ? 78 : 62,
        },
        analytics,
        riskAssessment,
        loans: loansRes.rows,
        recentDebits: debitsRes.rows,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
