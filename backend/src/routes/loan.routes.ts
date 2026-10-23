import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/db.js';
import { authenticateToken, requireRole, requireWorker } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { parsePagination } from '../utils/pagination.js';

const applyLoanSchema = z.object({
  amountPaise: z.number().int().positive().optional(),
  amountRupees: z.number().positive().optional(),
  deductionRateBps: z.number().int().min(100).max(5000).optional(),
  deductionRatePct: z.number().min(1).max(50).optional(),
  dailyCapPaise: z.number().int().nonnegative().optional(),
  dailyCapRupees: z.number().nonnegative().optional(),
  purpose: z.string().min(3).max(256),
  lenderName: z.string().optional(),
});

export function createLoanRoutes(): Router {
  const router = Router();

  // POST /api/loans/apply (Worker applies for micro-loan)
  router.post(
    '/apply',
    authenticateToken,
    requireWorker,
    validateBody(applyLoanSchema),
    async (req: Request, res: Response, next) => {
      try {
        const workerId = req.user!.workerId!;
        const body = req.body;

        // Money conversion: accept paise or rupees
        const principalPaise = body.amountPaise ?? (body.amountRupees ? Math.round(body.amountRupees * 100) : 1000000);
        const deductionRateBps = body.deductionRateBps ?? (body.deductionRatePct ? Math.round(body.deductionRatePct * 100) : 500);
        const dailyCapPaise = body.dailyCapPaise ?? (body.dailyCapRupees ? Math.round(body.dailyCapRupees * 100) : 0);

        // Run within a database transaction
        const newLoan = await db.transaction(async (tx) => {
          // 1. Verify worker has an active payment mandate
          const mandateRes = await tx.query(
            `SELECT * FROM payment_mandates WHERE worker_id = $1 AND status = 'ACTIVE' LIMIT 1`,
            [workerId]
          );

          if (mandateRes.rows.length === 0) {
            const err: any = new Error('Active UPI AutoPay mandate required before applying for a loan.');
            err.statusCode = 400;
            err.code = 'MANDATE_REQUIRED';
            throw err;
          }
          const mandate = mandateRes.rows[0];

          // 2. Check if worker already has an active loan
          const existingLoanRes = await tx.query(
            `SELECT * FROM loans WHERE worker_id = $1 AND status = 'ACTIVE' LIMIT 1`,
            [workerId]
          );

          if (existingLoanRes.rows.length > 0) {
            const err: any = new Error('Worker already has an active micro-loan. Only one active loan permitted at a time.');
            err.statusCode = 400;
            err.code = 'ACTIVE_LOAN_EXISTS';
            throw err;
          }

          // 3. Find default lender
          const lenderRes = await tx.query(
            `SELECT id, name FROM users WHERE role = 'LENDER' LIMIT 1`
          );
          const lenderId = lenderRes.rows[0]?.id || 'usr_lender_01';
          const lenderName = body.lenderName || lenderRes.rows[0]?.name || 'Kotak Microfinance';

          // 4. Generate unique loan ID
          const countRes = await tx.query('SELECT COUNT(*) as count FROM loans');
          const loanNum = parseInt(countRes.rows[0]?.count || '0', 10) + 1;
          const loanId = `LN-2026-${String(loanNum).padStart(3, '0')}`;

          // Status set to PENDING_APPROVAL for lender review
          const status = 'PENDING_APPROVAL';

          await tx.query(
            `INSERT INTO loans (
               id, worker_id, lender_id, lender_name, principal_paise,
               outstanding_balance_paise, interest_rate_bps, deduction_rate_bps,
               daily_cap_paise, total_repaid_paise, mandate_id, status, purpose
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11, $12)`,
            [
              loanId,
              workerId,
              lenderId,
              lenderName,
              principalPaise,
              principalPaise,
              1200, // 12% p.a.
              deductionRateBps,
              dailyCapPaise,
              mandate.id,
              status,
              body.purpose,
            ]
          );

          // 5. Insert audit event
          await tx.query(
            `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              `aud_${Date.now()}`,
              req.user!.userId,
              'LOAN_APPLIED',
              'LOAN',
              loanId,
              `Worker applied for micro-loan of ₹${(principalPaise / 100).toFixed(2)} for '${body.purpose}'`,
            ]
          );

          const createdRes = await tx.query(`SELECT * FROM loans WHERE id = $1`, [loanId]);
          return createdRes.rows[0];
        });

        res.status(201).json(newLoan);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/loans/:loanId/approve (Lender or Admin approves micro-loan)
  router.post(
    '/:loanId/approve',
    authenticateToken,
    requireRole(['LENDER', 'ADMIN']),
    async (req: Request, res: Response, next) => {
      try {
        const { loanId } = req.params;

        const updatedLoan = await db.transaction(async (tx) => {
          const loanRes = await tx.query(`SELECT * FROM loans WHERE id = $1`, [loanId]);
          if (loanRes.rows.length === 0) {
            const err: any = new Error('Loan not found');
            err.statusCode = 404;
            err.code = 'LOAN_NOT_FOUND';
            throw err;
          }

          const loan = loanRes.rows[0];
          if (loan.status === 'ACTIVE') {
            const err: any = new Error('Loan is already active');
            err.statusCode = 400;
            err.code = 'LOAN_ALREADY_ACTIVE';
            throw err;
          }
          if (loan.status === 'SETTLED') {
            const err: any = new Error('Cannot approve a settled loan');
            err.statusCode = 400;
            err.code = 'LOAN_ALREADY_SETTLED';
            throw err;
          }

          await tx.query(
            `UPDATE loans
             SET status = 'ACTIVE',
                 approved_by = $1,
                 approved_at = CURRENT_TIMESTAMP,
                 issued_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [req.user!.userId, loanId]
          );

          await tx.query(
            `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              `aud_${Date.now()}`,
              req.user!.userId,
              'LOAN_APPROVED',
              'LOAN',
              loanId,
              `Loan ${loanId} approved by ${req.user!.name} (${req.user!.role})`,
            ]
          );

          const result = await tx.query(`SELECT * FROM loans WHERE id = $1`, [loanId]);
          return result.rows[0];
        });

        res.json({
          message: 'Loan approved successfully and activated for streaming deductions.',
          loan: updatedLoan,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/loans (List loans with pagination and filtering)
  router.get('/', async (req: Request, res: Response, next) => {
    try {
      const { page, limit, offset, sortBy, sortOrder } = parsePagination(
        req.query,
        'issued_at',
        ['issued_at', 'principal_paise', 'outstanding_balance_paise']
      );

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (req.query.workerId) {
        conditions.push(`worker_id = $${paramIdx++}`);
        params.push(req.query.workerId);
      }
      if (req.query.status) {
        conditions.push(`status = $${paramIdx++}`);
        params.push(req.query.status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await db.query(`SELECT COUNT(*) as total FROM loans ${whereClause}`, params);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const dataRes = await db.query(
        `SELECT l.*, w.did, u.name as worker_name
         FROM loans l
         JOIN worker_profiles w ON w.id = l.worker_id
         JOIN users u ON u.id = w.user_id
         ${whereClause}
         ORDER BY l.${sortBy} ${sortOrder}
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...params, limit, offset]
      );

      res.json({
        loans: dataRes.rows.map((r) => ({
          ...r,
          loanId: r.id,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        total,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/loans/:loanId
  router.get('/:loanId', async (req: Request, res: Response, next) => {
    try {
      const loanRes = await db.query(
        `SELECT l.*, w.did, u.name as worker_name
         FROM loans l
         JOIN worker_profiles w ON w.id = l.worker_id
         JOIN users u ON u.id = w.user_id
         WHERE l.id = $1`,
        [req.params.loanId]
      );

      if (loanRes.rows.length === 0) {
        res.status(404).json({ error: 'Loan not found' });
        return;
      }

      const loan = {
        ...loanRes.rows[0],
        loanId: loanRes.rows[0].id,
      };

      const repaymentsRes = await db.query(
        `SELECT * FROM repayments WHERE loan_id = $1 ORDER BY settled_at DESC`,
        [req.params.loanId]
      );

      res.json({
        loan,
        repayments: repaymentsRes.rows,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
