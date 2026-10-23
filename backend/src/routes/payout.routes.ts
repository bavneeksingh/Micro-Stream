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

  // POST /api/simulator/one-click-demo
  router.post('/one-click-demo', async (_req: Request, res: Response, next) => {
    try {
      const workerRes = await db.query(`SELECT id, did FROM worker_profiles WHERE id = 'wrk_ravi_01' LIMIT 1`);
      const workerId = workerRes.rows[0]?.id || 'wrk_ravi_01';

      const demoLoanId = 'LN-DEMO-10K';
      // Upsert demo loan with exact balance ₹10,000 (1,000,000 paise), deduction rate 5% (500 bps)
      await db.query(
        `INSERT INTO loans (
           id, worker_id, lender_id, lender_name, principal_paise, outstanding_balance_paise,
           interest_rate_bps, deduction_rate_bps, daily_cap_paise, total_repaid_paise, status, purpose, issued_at
         ) VALUES ($1, $2, 'usr_lender_01', 'Kotak Microfinance', 1000000, 1000000, 1200, 500, 20000, 0, 'ACTIVE', 'MicroStream 1-Click Verification Demo Loan', '2020-01-01 00:00:00+00')
         ON CONFLICT (id) DO UPDATE SET
           outstanding_balance_paise = 1000000,
           total_repaid_paise = 0,
           status = 'ACTIVE',
           deduction_rate_bps = 500,
           issued_at = '2020-01-01 00:00:00+00'`,
        [demoLoanId, workerId]
      );

      const initialBalancePaise = 1000000; // ₹10,000.00
      const payoutAmountPaise = 100000;    // ₹1,000.00
      const expectedDeductionPaise = 5000; // ₹50.00
      const expectedBalanceAfterPaise = 995000; // ₹9,950.00

      const demoRef = `PAY-DEMO-ONECLICK-${Date.now()}`;

      // Step 1: Successful AutoPay Debit
      const run1Receipt = await repaymentEngine.processPayout({
        workerId,
        amountPaise: payoutAmountPaise,
        reference: demoRef,
        platformId: 'zomato-in',
        failureType: 'NONE',
        autoConfirm: true,
      });

      const run1Loan = await db.query(`SELECT * FROM loans WHERE id = $1`, [demoLoanId]);
      const balanceAfterRun1 = run1Loan.rows[0]?.outstanding_balance_paise;

      const proof1Success = (
        run1Receipt.debitInstruction?.status === 'SUCCEEDED' &&
        run1Receipt.debitInstruction?.amountPaise === expectedDeductionPaise &&
        balanceAfterRun1 === expectedBalanceAfterPaise
      );

      // Step 2: Replay the Same Payout (Idempotency Proof)
      const run2Receipt = await repaymentEngine.processPayout({
        workerId,
        amountPaise: payoutAmountPaise,
        reference: demoRef, // Exact same reference
        platformId: 'zomato-in',
        failureType: 'NONE',
        autoConfirm: true,
      });

      const run2Loan = await db.query(`SELECT * FROM loans WHERE id = $1`, [demoLoanId]);
      const balanceAfterRun2 = run2Loan.rows[0]?.outstanding_balance_paise;

      const proof2Idempotency = (
        run2Receipt.message.includes('Duplicate') &&
        balanceAfterRun2 === expectedBalanceAfterPaise
      );

      // Step 3: Simulate a Failed Debit (Proof that balance remains unchanged)
      const failRef = `PAY-DEMO-FAIL-${Date.now()}`;
      const run3Receipt = await repaymentEngine.processPayout({
        workerId,
        amountPaise: payoutAmountPaise,
        reference: failRef,
        platformId: 'swiggy-in',
        failureType: 'INSUFFICIENT_FUNDS',
        autoConfirm: true,
      });

      const run3Loan = await db.query(`SELECT * FROM loans WHERE id = $1`, [demoLoanId]);
      const balanceAfterRun3 = run3Loan.rows[0]?.outstanding_balance_paise;

      const proof3FailureBalancePreserved = (
        run3Receipt.debitInstruction?.status === 'RETRY_PENDING' &&
        balanceAfterRun3 === expectedBalanceAfterPaise
      );

      res.json({
        success: proof1Success && proof2Idempotency && proof3FailureBalancePreserved,
        summary: 'MicroStream 1-Click Verification Demo successfully executed.',
        demoLoanId,
        steps: [
          {
            step: 1,
            name: 'Successful AutoPay Stream Deduction',
            description: 'Payout ₹1,000 at 5% deduction rate on ₹10,000 loan',
            payoutAmountPaise,
            deductionCalculatedPaise: run1Receipt.debitInstruction?.amountPaise,
            expectedDeductionPaise,
            previousBalancePaise: initialBalancePaise,
            newBalancePaise: balanceAfterRun1,
            expectedBalancePaise: expectedBalanceAfterPaise,
            upiRef: run1Receipt.debitInstruction?.upiRef,
            instructionId: run1Receipt.debitInstruction?.id,
            passed: proof1Success,
          },
          {
            step: 2,
            name: 'Idempotency Replay Verification',
            description: 'Replayed identical payout reference. Verified no duplicate debit occurs.',
            replayedReference: demoRef,
            backendMessage: run2Receipt.message,
            balanceAfterReplayPaise: balanceAfterRun2,
            passed: proof2Idempotency,
          },
          {
            step: 3,
            name: 'Failed Debit Balance Invariance',
            description: 'Simulated insufficient funds debit failure. Verified loan balance remains ₹9,950.',
            failureType: 'INSUFFICIENT_FUNDS',
            debitInstructionStatus: run3Receipt.debitInstruction?.status,
            balanceAfterFailedDebitPaise: balanceAfterRun3,
            passed: proof3FailureBalancePreserved,
          },
        ],
        proofs: {
          proof1Success,
          proof2Idempotency,
          proof3FailureBalancePreserved,
          allPassed: proof1Success && proof2Idempotency && proof3FailureBalancePreserved,
        },
        audit: {
          safetyNote: 'MOCK SIMULATION ONLY — No real bank accounts debited, no UPI PINs collected.',
          verifiedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  });

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
