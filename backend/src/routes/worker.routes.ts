import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticateToken, requireWorker } from '../middleware/auth.js';
import { parsePagination } from '../utils/pagination.js';

export function createWorkerRoutes(): Router {
  const router = Router();

  // ==========================================================================
  // Authenticated Worker Self Routes (/api/workers/me/*)
  // Security: Worker can ONLY access their own records. Never trust client IDs.
  // ==========================================================================

  // GET /api/workers/me
  router.get('/me', authenticateToken, requireWorker, async (req: Request, res: Response, next) => {
    try {
      const workerId = req.user!.workerId!;

      const profileRes = await db.query(
        `SELECT w.*, u.name, u.email
         FROM worker_profiles w
         JOIN users u ON u.id = w.user_id
         WHERE w.id = $1`,
        [workerId]
      );

      if (profileRes.rows.length === 0) {
        res.status(404).json({
          error: 'Worker profile not found.',
          code: 'PROFILE_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const worker = profileRes.rows[0];

      // Active loan
      const loanRes = await db.query(
        `SELECT * FROM loans WHERE worker_id = $1 AND status = 'ACTIVE' LIMIT 1`,
        [workerId]
      );
      const activeLoan = loanRes.rows[0] || null;

      // Active mandate
      const mandateRes = await db.query(
        `SELECT * FROM payment_mandates WHERE worker_id = $1 AND status = 'ACTIVE' LIMIT 1`,
        [workerId]
      );
      const activeMandate = mandateRes.rows[0] || null;

      // 14-day earnings summary
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
      const earningsRes = await db.query(
        `SELECT 
           COALESCE(SUM(gross_earnings_paise), 0) as total_gross_paise,
           COALESCE(AVG(gross_earnings_paise), 0) as avg_gross_paise,
           COUNT(*) as active_days
         FROM earnings_records
         WHERE worker_id = $1 AND date >= $2`,
        [workerId, fourteenDaysAgo]
      );

      const earningsSummary = {
        totalGrossPaise: parseInt(earningsRes.rows[0]?.total_gross_paise || '0', 10),
        avgGrossPaise: Math.round(Number(earningsRes.rows[0]?.avg_gross_paise || 0)),
        activeDaysCount: parseInt(earningsRes.rows[0]?.active_days || '0', 10),
      };

      res.json({
        worker,
        activeLoan,
        activeMandate,
        earningsSummary,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/workers/me/earnings (with pagination, sorting, and date/platform filtering)
  router.get('/me/earnings', authenticateToken, requireWorker, async (req: Request, res: Response, next) => {
    try {
      const workerId = req.user!.workerId!;
      const { page, limit, offset, sortBy, sortOrder } = parsePagination(
        req.query,
        'date',
        ['date', 'gross_earnings_paise', 'recorded_at']
      );

      const conditions: string[] = ['worker_id = $1'];
      const params: any[] = [workerId];
      let paramIndex = 2;

      if (req.query.startDate) {
        conditions.push(`date >= $${paramIndex++}`);
        params.push(req.query.startDate);
      }
      if (req.query.endDate) {
        conditions.push(`date <= $${paramIndex++}`);
        params.push(req.query.endDate);
      }
      if (req.query.platformId) {
        conditions.push(`platform_id = $${paramIndex++}`);
        params.push(req.query.platformId);
      }

      const whereClause = conditions.join(' AND ');

      // Total count query
      const countRes = await db.query(
        `SELECT COUNT(*) as total FROM earnings_records WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      // Data query
      const dataQuery = `
        SELECT * FROM earnings_records
        WHERE ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      const dataRes = await db.query(dataQuery, [...params, limit, offset]);

      res.json({
        data: dataRes.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/workers/me/loans (with status filtering)
  router.get('/me/loans', authenticateToken, requireWorker, async (req: Request, res: Response, next) => {
    try {
      const workerId = req.user!.workerId!;
      const conditions: string[] = ['worker_id = $1'];
      const params: any[] = [workerId];

      if (req.query.status) {
        conditions.push('status = $2');
        params.push(req.query.status);
      }

      const loansRes = await db.query(
        `SELECT * FROM loans WHERE ${conditions.join(' AND ')} ORDER BY issued_at DESC`,
        params
      );

      res.json({
        loans: loansRes.rows,
        total: loansRes.rows.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/workers/me/repayments (with pagination and sorting)
  router.get('/me/repayments', authenticateToken, requireWorker, async (req: Request, res: Response, next) => {
    try {
      const workerId = req.user!.workerId!;
      const { page, limit, offset, sortBy, sortOrder } = parsePagination(
        req.query,
        'settled_at',
        ['settled_at', 'amount_paise']
      );

      const conditions: string[] = ['worker_id = $1'];
      const params: any[] = [workerId];
      let paramIndex = 2;

      if (req.query.loanId) {
        conditions.push(`loan_id = $${paramIndex++}`);
        params.push(req.query.loanId);
      }

      const whereClause = conditions.join(' AND ');

      const countRes = await db.query(
        `SELECT COUNT(*) as total FROM repayments WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const dataQuery = `
        SELECT * FROM repayments
        WHERE ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      const dataRes = await db.query(dataQuery, [...params, limit, offset]);

      res.json({
        data: dataRes.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ==========================================================================
  // Public / Shared Directory Endpoints (for demo switches & lender views)
  // ==========================================================================

  // GET /api/workers
  router.get('/', async (_req, res, next) => {
    try {
      const result = await db.query(
        `SELECT w.*, u.name, u.email
         FROM worker_profiles w
         JOIN users u ON u.id = w.user_id
         ORDER BY w.created_at ASC`
      );
      res.json({
        workers: result.rows.map((row) => ({
          ...row,
          userId: row.user_id,
          primaryPlatform: row.primary_platform,
          creditTier: row.credit_tier,
          riskScore: row.risk_score,
          publicKey: row.public_key,
        })),
        total: result.rows.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/workers/:did
  router.get('/:did', async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT w.*, u.name, u.email
         FROM worker_profiles w
         JOIN users u ON u.id = w.user_id
         WHERE w.did = $1 OR w.id = $1`,
        [req.params.did]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Worker not found' });
        return;
      }

      const workerRow = result.rows[0];
      const worker = {
        ...workerRow,
        userId: workerRow.user_id,
        primaryPlatform: workerRow.primary_platform,
        creditTier: workerRow.credit_tier,
        riskScore: workerRow.risk_score,
        publicKey: workerRow.public_key,
      };

      const loanRes = await db.query(
        `SELECT * FROM loans WHERE worker_id = $1 AND status = 'ACTIVE' LIMIT 1`,
        [worker.id]
      );
      const activeLoan = loanRes.rows[0]
        ? {
            ...loanRes.rows[0],
            loanId: loanRes.rows[0].id,
            principalPaise: loanRes.rows[0].principal_paise,
            outstandingBalancePaise: loanRes.rows[0].outstanding_balance_paise,
            totalRepaidPaise: loanRes.rows[0].total_repaid_paise,
            deductionRateBps: loanRes.rows[0].deduction_rate_bps,
            dailyCapPaise: loanRes.rows[0].daily_cap_paise,
          }
        : null;

      const mandateRes = await db.query(
        `SELECT * FROM payment_mandates WHERE worker_id = $1 AND status = 'ACTIVE' LIMIT 1`,
        [worker.id]
      );
      const mandate = mandateRes.rows[0] || null;

      const earningsRes = await db.query(
        `SELECT 
           COALESCE(SUM(gross_earnings_paise), 0) as total_gross_paise,
           COALESCE(AVG(gross_earnings_paise), 0) as avg_gross_paise,
           COUNT(*) as active_days
         FROM earnings_records
         WHERE worker_id = $1`,
        [worker.id]
      );

      const earningsSummary = {
        totalGrossPaise: parseInt(earningsRes.rows[0]?.total_gross_paise || '0', 10),
        avgGrossPaise: Math.round(Number(earningsRes.rows[0]?.avg_gross_paise || 0)),
        activeDaysCount: parseInt(earningsRes.rows[0]?.active_days || '0', 10),
      };

      res.json({
        worker,
        activeLoan,
        mandate,
        earningsSummary,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
