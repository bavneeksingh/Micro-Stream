import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/db.js';
import { parsePagination } from '../utils/pagination.js';
import { validateBody } from '../middleware/validate.js';
import { repaymentEngine } from '../services/repayment-engine.service.js';

const simulatePayoutSchema = z.object({
  workerId: z.string().optional(),
  did: z.string().optional(),
  platformId: z.string().default('zomato-in'),
  amountPaise: z.number().int().nonnegative().optional(),
  amountRupees: z.number().nonnegative().optional(),
  reference: z.string().optional(),
  payoutDate: z.string().optional(),
  failureType: z.enum(['NONE', 'INSUFFICIENT_FUNDS', 'MANDATE_EXCEEDED', 'NETWORK_ERROR']).default('NONE').optional(),
  autoConfirm: z.boolean().default(true).optional(),
});

const callbackSchema = z.object({
  instructionId: z.string().min(1),
  reference: z.string().min(1),
  amountPaise: z.number().int(),
  success: z.boolean(),
  upiRef: z.string().optional(),
  failureReason: z.string().optional(),
});

const configSchema = z.object({
  dailyCapPaise: z.number().int().nonnegative().optional(),
  minimumDeductionThresholdPaise: z.number().int().nonnegative().optional(),
  retryLimit: z.number().int().nonnegative().optional(),
  repaymentRateBasisPoints: z.number().int().min(0).max(10000).optional(),
});

export function createPayoutRoutes(): Router {
  const router = Router();

  // GET /api/payouts (List payout events with pagination and filtering)
  router.get('/', async (req: Request, res: Response, next) => {
    try {
      const { page, limit, offset, sortBy, sortOrder } = parsePagination(
        req.query,
        'detected_at',
        ['detected_at', 'payout_date', 'amount_paise']
      );

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (req.query.workerId) {
        conditions.push(`p.worker_id = $${paramIdx++}`);
        params.push(req.query.workerId);
      }
      if (req.query.status) {
        conditions.push(`p.status = $${paramIdx++}`);
        params.push(req.query.status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await db.query(
        `SELECT COUNT(*) as total FROM payout_events p ${whereClause}`,
        params
      );
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const dataRes = await db.query(
        `SELECT p.*, w.did, u.name as worker_name
         FROM payout_events p
         JOIN worker_profiles w ON w.id = p.worker_id
         JOIN users u ON u.id = w.user_id
         ${whereClause}
         ORDER BY p.${sortBy} ${sortOrder}
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...params, limit, offset]
      );

      res.json({
        payouts: dataRes.rows,
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

  // Handler for payout simulation streaming loop using Deterministic Repayment Engine
  const handleSimulatePayout = async (req: Request, res: Response, next: any) => {
    try {
      const body = req.body;
      const amountPaise = body.amountPaise !== undefined
        ? body.amountPaise
        : (body.amountRupees !== undefined ? Math.round(body.amountRupees * 100) : 100000);
      const platformId = body.platformId || 'zomato-in';
      const reference = body.reference || `PAY-${platformId.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Resolve Worker ID
      let workerId = body.workerId;
      if (!workerId && body.did) {
        const workerRes = await db.query(`SELECT id FROM worker_profiles WHERE did = $1`, [body.did]);
        if (workerRes.rows.length > 0) workerId = workerRes.rows[0].id;
      }
      if (!workerId && req.user?.workerId) {
        workerId = req.user.workerId;
      }
      if (!workerId) {
        const defaultWorkerRes = await db.query(`SELECT id FROM worker_profiles LIMIT 1`);
        workerId = defaultWorkerRes.rows[0]?.id || 'wrk_ravi_01';
      }

      // Execute through Deterministic Repayment Engine
      const receipt = await repaymentEngine.processPayout({
        workerId,
        amountPaise,
        reference,
        platformId,
        failureType: body.failureType || 'NONE',
        autoConfirm: body.autoConfirm !== undefined ? body.autoConfirm : true,
      });

      // Maintain backward-compatible response properties for frontend
      res.status(200).json({
        ...receipt,
        deductionCalculatedPaise: receipt.debitInstruction?.amountPaise || 0,
        debitResult: {
          success: receipt.debitInstruction?.status === 'SUCCEEDED',
          amountDebitedPaise: receipt.debitInstruction?.status === 'SUCCEEDED' ? receipt.debitInstruction.amountPaise : 0,
          upiRef: receipt.debitInstruction?.upiRef,
          instructionId: receipt.debitInstruction?.id,
          failureReason: receipt.debitInstruction?.failureReason,
        },
        updatedLoan: receipt.loanState,
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/simulator/payouts
  router.post('/simulator/payouts', validateBody(simulatePayoutSchema), handleSimulatePayout);

  // POST /api/payouts/simulate (Aliased for compatibility)
  router.post('/simulate', validateBody(simulatePayoutSchema), handleSimulatePayout);

  // POST /api/payments/callback (Payment confirmation/callback handler)
  router.post('/callback', validateBody(callbackSchema), async (req: Request, res: Response, next) => {
    try {
      const result = await repaymentEngine.processPaymentCallback(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/debits/:instructionId/retry (Retry a RETRY_PENDING debit instruction)
  router.post('/debits/:instructionId/retry', async (req: Request, res: Response, next) => {
    try {
      const result = await repaymentEngine.retryDebitInstruction(req.params.instructionId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/transactions/history (Complete transaction lifecycle history)
  router.get('/transactions/history', async (req: Request, res: Response, next) => {
    try {
      let workerId: string | undefined = req.query.workerId as string;
      if (req.user?.role === 'WORKER') {
        workerId = req.user.workerId;
      }
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const history = await repaymentEngine.getTransactionHistory({ workerId, limit, offset });
      res.json(history);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/engine/config (Retrieve current engine configuration)
  router.get('/config', (_req: Request, res: Response) => {
    res.json(repaymentEngine.getConfig());
  });

  // PUT /api/engine/config (Update engine configuration)
  router.put('/config', validateBody(configSchema), (req: Request, res: Response) => {
    const { dailyCapPaise, minimumDeductionThresholdPaise, retryLimit, repaymentRateBasisPoints } = req.body;
    repaymentEngine.updateConfig({
      defaultDailyCapPaise: dailyCapPaise,
      minimumDeductionThresholdPaise,
      maxRetries: retryLimit,
      defaultRepaymentRateBps: repaymentRateBasisPoints,
    });
    res.json({
      message: 'Repayment engine configuration updated successfully.',
      config: repaymentEngine.getConfig(),
    });
  });

  return router;
}
