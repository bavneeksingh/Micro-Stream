import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/db.js';
import { parsePagination } from '../utils/pagination.js';
import { validateBody } from '../middleware/validate.js';

const simulatePayoutSchema = z.object({
  workerId: z.string().optional(),
  did: z.string().optional(),
  platformId: z.string().default('zomato-in'),
  amountPaise: z.number().int().positive().optional(),
  amountRupees: z.number().positive().optional(),
  reference: z.string().optional(),
  payoutDate: z.string().optional(),
  failureType: z.enum(['NONE', 'INSUFFICIENT_FUNDS', 'MANDATE_EXCEEDED', 'NETWORK_ERROR']).default('NONE').optional(),
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

  // Handler for payout simulation streaming loop
  const handleSimulatePayout = async (req: Request, res: Response, next: any) => {
    try {
      const body = req.body;
      const amountPaise = body.amountPaise ?? (body.amountRupees ? Math.round(body.amountRupees * 100) : 100000);
      const platformId = body.platformId || 'zomato-in';
      const today = body.payoutDate || new Date().toISOString().split('T')[0];
      const timestamp = new Date().toISOString();
      const failureType = body.failureType || 'NONE';

      // Reference unique constraint check
      const reference = body.reference || `PAY-${platformId.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Execute entire streaming loop inside an ACID transaction
      const receipt = await db.transaction(async (tx) => {
        // 1. Resolve Worker
        let workerQuery = `SELECT * FROM worker_profiles LIMIT 1`;
        let workerParams: any[] = [];

        if (body.workerId) {
          workerQuery = `SELECT * FROM worker_profiles WHERE id = $1`;
          workerParams = [body.workerId];
        } else if (body.did) {
          workerQuery = `SELECT * FROM worker_profiles WHERE did = $1`;
          workerParams = [body.did];
        } else if (req.user?.workerId) {
          workerQuery = `SELECT * FROM worker_profiles WHERE id = $1`;
          workerParams = [req.user.workerId];
        }

        const workerRes = await tx.query(workerQuery, workerParams);
        if (workerRes.rows.length === 0) {
          const err: any = new Error('Worker not found for payout simulation');
          err.statusCode = 404;
          err.code = 'WORKER_NOT_FOUND';
          throw err;
        }
        const worker = workerRes.rows[0];

        // 2. Insert Daily Earnings Record with unique reference
        const earningsRef = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        await tx.query(
          `INSERT INTO earnings_records (
             id, worker_id, platform_id, date, gross_earnings_paise,
             net_earnings_paise, orders_count, reference, status, recorded_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'RECORDED', $9)`,
          [
            `ern_${Date.now()}`,
            worker.id,
            platformId,
            today,
            amountPaise,
            Math.round(amountPaise * 0.92),
            Math.max(1, Math.round(amountPaise / 7000)),
            earningsRef,
            timestamp,
          ]
        );

        // 3. Check for Active Loan
        const loanRes = await tx.query(
          `SELECT * FROM loans WHERE worker_id = $1 AND status = 'ACTIVE' LIMIT 1`,
          [worker.id]
        );
        const targetLoan = loanRes.rows[0] || null;

        // 4. Check Payment Mandate
        const mandateRes = await tx.query(
          `SELECT * FROM payment_mandates WHERE worker_id = $1 AND status = 'ACTIVE' LIMIT 1`,
          [worker.id]
        );
        const targetMandate = mandateRes.rows[0] || null;

        // If no active loan, record payout and return
        if (!targetLoan) {
          const payoutId = `pay_${Date.now()}`;
          await tx.query(
            `INSERT INTO payout_events (id, worker_id, platform_id, amount_paise, reference, payout_date, status, skip_reason)
             VALUES ($1, $2, $3, $4, $5, $6, 'SKIPPED', 'NO_ACTIVE_LOAN')`,
            [payoutId, worker.id, platformId, amountPaise, reference, today]
          );

          return {
            payoutId,
            did: worker.did,
            workerId: worker.id,
            platformId,
            amountPaise,
            reference,
            hasActiveLoan: false,
            deductionCalculatedPaise: 0,
            debitResult: {
              success: false,
              amountDebitedPaise: 0,
              reason: 'NO_ACTIVE_LOAN',
            },
            message: 'Daily payout recorded. Worker has no active micro-loan.',
            timestamp,
          };
        }

        // 5. Calculate Streaming Deduction
        // Formula: min(amountPaise * deductionRateBps / 10000, outstandingBalancePaise, dailyCapPaise)
        const rawDeductionPaise = Math.round((amountPaise * targetLoan.deduction_rate_bps) / 10000);
        let deductionPaise = rawDeductionPaise;

        if (deductionPaise > targetLoan.outstanding_balance_paise) {
          deductionPaise = targetLoan.outstanding_balance_paise;
        }
        if (targetLoan.daily_cap_paise > 0 && deductionPaise > targetLoan.daily_cap_paise) {
          deductionPaise = targetLoan.daily_cap_paise;
        }

        // 6. Handle Simulated Failures
        if (failureType === 'INSUFFICIENT_FUNDS') {
          const payoutId = `pay_${Date.now()}`;
          const instructionId = `ins_${Date.now()}`;
          const idempotencyKey = `IDEM-${Date.now()}-${Math.random()}`;

          await tx.query(
            `INSERT INTO payout_events (id, worker_id, platform_id, amount_paise, reference, payout_date, status, skip_reason)
             VALUES ($1, $2, $3, $4, $5, $6, 'FAILED', 'BANK_INSUFFICIENT_FUNDS')`,
            [payoutId, worker.id, platformId, amountPaise, reference, today]
          );

          await tx.query(
            `INSERT INTO debit_instructions (
               id, loan_id, worker_id, payout_event_id, amount_paise,
               status, idempotency_key, failure_reason
             ) VALUES ($1, $2, $3, $4, $5, 'FAILED', $6, 'Bank insufficient funds')`,
            [instructionId, targetLoan.id, worker.id, payoutId, deductionPaise, idempotencyKey]
          );

          return {
            payoutId,
            did: worker.did,
            workerId: worker.id,
            platformId,
            amountPaise,
            reference,
            hasActiveLoan: true,
            deductionCalculatedPaise: deductionPaise,
            debitResult: {
              success: false,
              amountDebitedPaise: 0,
              reason: 'INSUFFICIENT_FUNDS',
              failureReason: 'Worker bank balance insufficient. Carried forward to next payout.',
            },
            message: 'AutoPay Debit Failed: Worker bank balance insufficient.',
            timestamp,
          };
        }

        if (failureType === 'MANDATE_EXCEEDED' || (targetMandate && deductionPaise > targetMandate.max_amount_paise)) {
          const payoutId = `pay_${Date.now()}`;
          const instructionId = `ins_${Date.now()}`;
          const idempotencyKey = `IDEM-${Date.now()}-${Math.random()}`;

          await tx.query(
            `INSERT INTO payout_events (id, worker_id, platform_id, amount_paise, reference, payout_date, status, skip_reason)
             VALUES ($1, $2, $3, $4, $5, $6, 'FAILED', 'EXCEEDS_MANDATE_CAP')`,
            [payoutId, worker.id, platformId, amountPaise, reference, today]
          );

          await tx.query(
            `INSERT INTO debit_instructions (
               id, loan_id, worker_id, payout_event_id, amount_paise,
               status, idempotency_key, failure_reason
             ) VALUES ($1, $2, $3, $4, $5, 'FAILED', $6, 'Exceeds mandate safety cap')`,
            [instructionId, targetLoan.id, worker.id, payoutId, deductionPaise, idempotencyKey]
          );

          return {
            payoutId,
            did: worker.did,
            workerId: worker.id,
            platformId,
            amountPaise,
            reference,
            hasActiveLoan: true,
            deductionCalculatedPaise: deductionPaise,
            debitResult: {
              success: false,
              amountDebitedPaise: 0,
              reason: 'EXCEEDS_MANDATE_CAP',
              failureReason: 'Calculated deduction exceeds mandate safety cap.',
            },
            message: 'AutoPay Debit Failed: Calculated deduction exceeds mandate safety cap.',
            timestamp,
          };
        }

        // 7. Successful Debit Execution
        const yyyymmdd = today.replace(/-/g, '');
        const random10 = Math.floor(1000000000 + Math.random() * 9000000000);
        const upiRef = `UPI/${yyyymmdd}/${random10}`;

        const payoutId = `pay_${Date.now()}`;
        const instructionId = `ins_${Date.now()}`;
        const idempotencyKey = `IDEM-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

        // Insert Payout Event
        await tx.query(
          `INSERT INTO payout_events (id, worker_id, platform_id, amount_paise, reference, payout_date, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED')`,
          [payoutId, worker.id, platformId, amountPaise, reference, today]
        );

        // Insert Debit Instruction (with unique constraint on id and idempotency_key)
        await tx.query(
          `INSERT INTO debit_instructions (
             id, loan_id, worker_id, payout_event_id, amount_paise,
             status, idempotency_key, upi_ref, executed_at
           ) VALUES ($1, $2, $3, $4, $5, 'SUCCESS', $6, $7, CURRENT_TIMESTAMP)`,
          [instructionId, targetLoan.id, worker.id, payoutId, deductionPaise, idempotencyKey, upiRef]
        );

        // Update Loan Balances
        const newOutstanding = Math.max(0, targetLoan.outstanding_balance_paise - deductionPaise);
        const newTotalRepaid = targetLoan.total_repaid_paise + deductionPaise;
        const isSettled = newOutstanding === 0;

        await tx.query(
          `UPDATE loans
           SET outstanding_balance_paise = $1,
               total_repaid_paise = $2,
               status = $3,
               settled_at = $4
           WHERE id = $5`,
          [
            newOutstanding,
            newTotalRepaid,
            isSettled ? 'SETTLED' : 'ACTIVE',
            isSettled ? new Date().toISOString() : null,
            targetLoan.id,
          ]
        );

        // Insert Repayment Record
        const repaymentId = `rep_${Date.now()}`;
        await tx.query(
          `INSERT INTO repayments (
             id, loan_id, debit_instruction_id, worker_id, amount_paise,
             previous_balance_paise, new_outstanding_balance_paise,
             is_final_settlement, settled_at, upi_ref
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9)`,
          [
            repaymentId,
            targetLoan.id,
            instructionId,
            worker.id,
            deductionPaise,
            targetLoan.outstanding_balance_paise,
            newOutstanding,
            isSettled,
            upiRef,
          ]
        );

        // Insert Audit Event
        await tx.query(
          `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            `aud_${Date.now()}`,
            worker.user_id,
            'STREAMING_DEDUCTION_EXECUTED',
            'REPAYMENT',
            repaymentId,
            `Deducted ₹${(deductionPaise / 100).toFixed(2)} from ₹${(amountPaise / 100).toFixed(2)} platform payout via AutoPay`,
          ]
        );

        return {
          payoutId,
          did: worker.did,
          workerId: worker.id,
          platformId,
          amountPaise,
          reference,
          hasActiveLoan: true,
          deductionCalculatedPaise: deductionPaise,
          debitResult: {
            success: true,
            amountDebitedPaise: deductionPaise,
            upiRef,
            instructionId,
          },
          repayment: {
            id: repaymentId,
            loanId: targetLoan.id,
            amountPaise: deductionPaise,
            previousBalancePaise: targetLoan.outstanding_balance_paise,
            newOutstandingBalancePaise: newOutstanding,
            isFinalSettlement: isSettled,
            upiRef,
            settledAt: timestamp,
          },
          updatedLoan: {
            id: targetLoan.id,
            outstandingBalancePaise: newOutstanding,
            totalRepaidPaise: newTotalRepaid,
            status: isSettled ? 'SETTLED' : 'ACTIVE',
          },
          message: `Streamed ₹${(deductionPaise / 100).toFixed(2)} deduction from ₹${(amountPaise / 100).toFixed(2)} daily payout.`,
          timestamp,
        };
      });

      res.status(200).json(receipt);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/simulator/payouts (Specified in user requirements)
  router.post('/simulator/payouts', validateBody(simulatePayoutSchema), handleSimulatePayout);

  // POST /api/payouts/simulate (Aliased for frontend / test backward-compatibility)
  router.post('/simulate', validateBody(simulatePayoutSchema), handleSimulatePayout);

  return router;
}
