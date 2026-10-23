import { db, TransactionClient } from '../db/db.js';
import { calculateDeduction } from '@microstream/shared';

export interface RepaymentEngineConfig {
  defaultRepaymentRateBps: number; // e.g. 500 = 5.00%
  defaultDailyCapPaise: number;    // e.g. 20000 = ₹200.00
  minimumDeductionThresholdPaise: number; // e.g. 100 = ₹1.00
  maxRetries: number;             // e.g. 3
}

export interface PayoutProcessRequest {
  workerId: string;
  amountPaise: number;
  reference: string;
  timestamp?: string;
  platformId?: string;
  failureType?: 'NONE' | 'INSUFFICIENT_FUNDS' | 'MANDATE_EXCEEDED' | 'NETWORK_ERROR';
  autoConfirm?: boolean; // When true, immediately simulates confirmation loop
}

export interface DebitCallbackRequest {
  instructionId: string;
  reference: string;
  amountPaise: number;
  success: boolean;
  upiRef?: string;
  failureReason?: string;
}

export interface EngineExecutionReceipt {
  payoutId: string;
  reference: string;
  payoutStatus: 'RECEIVED' | 'PROCESSED' | 'REJECTED';
  workerId: string;
  platformId: string;
  amountPaise: number;
  hasActiveLoan: boolean;
  loanId?: string;
  debitInstruction?: {
    id: string;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'RETRY_PENDING';
    amountPaise: number;
    idempotencyKey: string;
    retryCount: number;
    maxRetries: number;
    upiRef?: string;
    failureReason?: string;
  };
  repayment?: {
    id: string;
    loanId: string;
    amountPaise: number;
    previousBalancePaise: number;
    newOutstandingBalancePaise: number;
    isFinalSettlement: boolean;
    settledAt: string;
    upiRef: string;
  };
  loanState?: {
    id: string;
    outstandingBalancePaise: number;
    totalRepaidPaise: number;
    status: 'PENDING' | 'ACTIVE' | 'PAID' | 'REJECTED';
  };
  message: string;
  timestamp: string;
}

export class DeterministicRepaymentEngine {
  private config: RepaymentEngineConfig;

  constructor(customConfig?: Partial<RepaymentEngineConfig>) {
    this.config = {
      defaultRepaymentRateBps: 500, // 5% default
      defaultDailyCapPaise: 20000,  // ₹200 daily cap
      minimumDeductionThresholdPaise: 100, // ₹1 minimum threshold
      maxRetries: 3,
      ...customConfig,
    };
  }

  public updateConfig(newConfig: Partial<RepaymentEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): RepaymentEngineConfig {
    return { ...this.config };
  }

  /**
   * Process a payout through the deterministic repayment engine:
   * 1. Validate & check duplicate payout reference
   * 2. Identify active loan using FIFO allocation policy
   * 3. Calculate deduction using overflow-safe integer floor arithmetic
   * 4. Create debit instruction with stable idempotency key in PENDING state
   * 5. If autoConfirm is enabled, confirm payment outcome atomically
   */
  async processPayout(request: PayoutProcessRequest): Promise<EngineExecutionReceipt> {
    const timestamp = request.timestamp || new Date().toISOString();
    const today = timestamp.split('T')[0];
    const platformId = request.platformId || 'zomato-in';
    const amountPaise = Math.max(0, Math.floor(request.amountPaise));

    return await db.transaction(async (tx: TransactionClient) => {
      // Step 3: Check duplicate payout reference safely
      const existingPayout = await tx.query(
        `SELECT * FROM payout_events WHERE reference = $1`,
        [request.reference]
      );

      if (existingPayout.rows.length > 0) {
        const prev = existingPayout.rows[0];
        // Fetch linked instruction if any
        const linkedDebit = await tx.query(
          `SELECT * FROM debit_instructions WHERE payout_event_id = $1 LIMIT 1`,
          [prev.id]
        );
        const linkedRep = linkedDebit.rows[0]
          ? await tx.query(`SELECT * FROM repayments WHERE debit_instruction_id = $1 LIMIT 1`, [linkedDebit.rows[0].id])
          : { rows: [] };

        return {
          payoutId: prev.id,
          reference: prev.reference,
          payoutStatus: prev.status as any,
          workerId: prev.worker_id,
          platformId: prev.platform_id,
          amountPaise: prev.amount_paise,
          hasActiveLoan: linkedDebit.rows.length > 0,
          loanId: linkedDebit.rows[0]?.loan_id,
          debitInstruction: linkedDebit.rows[0],
          repayment: linkedRep.rows[0],
          message: 'Duplicate payout reference acknowledged safely without re-debiting.',
          timestamp: prev.detected_at,
        };
      }

      // Step 1: Register Payout Event in RECEIVED state
      const payoutId = `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await tx.query(
        `INSERT INTO payout_events (id, worker_id, platform_id, amount_paise, reference, payout_date, status, detected_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'RECEIVED', $7)`,
        [payoutId, request.workerId, platformId, amountPaise, request.reference, today, timestamp]
      );

      // Record daily earnings record
      const earningsRef = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      await tx.query(
        `INSERT INTO earnings_records (id, worker_id, platform_id, date, gross_earnings_paise, net_earnings_paise, orders_count, reference, status, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'RECORDED', $9)
         ON CONFLICT (reference) DO NOTHING`,
        [
          `ern_${Date.now()}`,
          request.workerId,
          platformId,
          today,
          amountPaise,
          Math.round(amountPaise * 0.92),
          Math.max(1, Math.round(amountPaise / 7000)),
          earningsRef,
          timestamp,
        ]
      );

      // Step 4: Loan Allocation Policy - Select oldest active loan (FIFO) with row lock
      const loanRes = await tx.query(
        `SELECT l.*, w.user_id
         FROM loans l
         JOIN worker_profiles w ON w.id = l.worker_id
         WHERE l.worker_id = $1 AND l.status = 'ACTIVE'
         ORDER BY l.issued_at ASC
         LIMIT 1
         FOR UPDATE`,
        [request.workerId]
      );

      if (loanRes.rows.length === 0) {
        // No active loan: mark PROCESSED with skip reason
        await tx.query(
          `UPDATE payout_events SET status = 'PROCESSED', skip_reason = 'NO_ACTIVE_LOAN' WHERE id = $1`,
          [payoutId]
        );

        return {
          payoutId,
          reference: request.reference,
          payoutStatus: 'PROCESSED',
          workerId: request.workerId,
          platformId,
          amountPaise,
          hasActiveLoan: false,
          message: 'Zero or no active loan found for worker. Payout processed with zero deduction.',
          timestamp,
        };
      }

      const activeLoan = loanRes.rows[0];

      // Step 5: Query already deducted today for remaining daily cap
      const startOfToday = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
      const todayDeductionsRes = await tx.query(
        `SELECT COALESCE(SUM(amount_paise), 0) as total_today
         FROM debit_instructions
         WHERE worker_id = $1
           AND created_at >= $2
           AND status = 'SUCCEEDED'`,
        [request.workerId, startOfToday]
      );
      const alreadyDeductedTodayPaise = parseInt(todayDeductionsRes.rows[0]?.total_today || '0', 10);

      const loanDailyCapPaise = activeLoan.daily_cap_paise > 0 ? activeLoan.daily_cap_paise : this.config.defaultDailyCapPaise;
      const deductionRateBps = activeLoan.deduction_rate_bps > 0 ? activeLoan.deduction_rate_bps : this.config.defaultRepaymentRateBps;

      // Calculate deduction via deterministic integer floor formula
      const calcResult = calculateDeduction({
        payoutAmountPaise: amountPaise,
        deductionRateBps,
        outstandingBalancePaise: activeLoan.outstanding_balance_paise,
        dailyCapPaise: loanDailyCapPaise,
        alreadyDeductedTodayPaise,
        minimumDeductionThresholdPaise: this.config.minimumDeductionThresholdPaise,
      });

      // If zero payout or calculated deduction is zero
      if (calcResult.deductionPaise === 0) {
        const reason = amountPaise === 0 ? 'ZERO_INCOME' : calcResult.isBelowThreshold ? 'BELOW_MIN_THRESHOLD' : 'DAILY_CAP_REACHED';
        await tx.query(
          `UPDATE payout_events SET status = 'PROCESSED', skip_reason = $1 WHERE id = $2`,
          [reason, payoutId]
        );

        return {
          payoutId,
          reference: request.reference,
          payoutStatus: 'PROCESSED',
          workerId: request.workerId,
          platformId,
          amountPaise,
          hasActiveLoan: true,
          loanId: activeLoan.id,
          loanState: {
            id: activeLoan.id,
            outstandingBalancePaise: activeLoan.outstanding_balance_paise,
            totalRepaidPaise: activeLoan.total_repaid_paise,
            status: activeLoan.status,
          },
          message: `Zero deduction calculated (${reason}). Loan balance unchanged.`,
          timestamp,
        };
      }

      // Step 6: Create Debit Instruction with stable idempotency key in PENDING state
      const instructionId = `ins_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const idempotencyKey = `IDEM-PAYOUT-${request.reference}-${activeLoan.id}`;

      await tx.query(
        `INSERT INTO debit_instructions (
           id, loan_id, worker_id, payout_event_id, amount_paise,
           status, idempotency_key, retry_count, max_retries, created_at
         ) VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, 0, $7, $8)`,
        [instructionId, activeLoan.id, request.workerId, payoutId, calcResult.deductionPaise, idempotencyKey, this.config.maxRetries, timestamp]
      );

      // If autoConfirm is requested (standard simulator flow)
      const shouldConfirm = request.autoConfirm !== false;
      if (shouldConfirm) {
        const failureType = request.failureType || 'NONE';

        if (failureType === 'INSUFFICIENT_FUNDS' || failureType === 'NETWORK_ERROR') {
          // Record failure without reducing loan balance
          const isRetrySafe = this.config.maxRetries > 0;
          const status = isRetrySafe ? 'RETRY_PENDING' : 'FAILED';

          await tx.query(
            `UPDATE debit_instructions
             SET status = $1, retry_count = retry_count + 1, failure_reason = $2
             WHERE id = $3`,
            [status, failureType, instructionId]
          );

          await tx.query(
            `UPDATE payout_events SET status = 'PROCESSED', skip_reason = $1 WHERE id = $2`,
            [failureType, payoutId]
          );

          return {
            payoutId,
            reference: request.reference,
            payoutStatus: 'PROCESSED',
            workerId: request.workerId,
            platformId,
            amountPaise,
            hasActiveLoan: true,
            loanId: activeLoan.id,
            debitInstruction: {
              id: instructionId,
              status,
              amountPaise: calcResult.deductionPaise,
              idempotencyKey,
              retryCount: 1,
              maxRetries: this.config.maxRetries,
              failureReason: failureType,
            },
            loanState: {
              id: activeLoan.id,
              outstandingBalancePaise: activeLoan.outstanding_balance_paise,
              totalRepaidPaise: activeLoan.total_repaid_paise,
              status: activeLoan.status,
            },
            message: `Debit failed (${failureType}). Loan balance retained.`,
            timestamp,
          };
        }

        // Confirmed Success: Atomically execute Step 8 & 12
        const yyyymmdd = today.replace(/-/g, '');
        const upiRef = `UPI/${yyyymmdd}/${Math.floor(1000000000 + Math.random() * 9000000000)}`;

        // Update instruction to SUCCEEDED
        await tx.query(
          `UPDATE debit_instructions
           SET status = 'SUCCEEDED', upi_ref = $1, executed_at = $2
           WHERE id = $3`,
          [upiRef, timestamp, instructionId]
        );

        // Calculate new loan balance (capped so never over-repays)
        const deductionPaise = calcResult.deductionPaise;
        const newOutstanding = Math.max(0, activeLoan.outstanding_balance_paise - deductionPaise);
        const newTotalRepaid = activeLoan.total_repaid_paise + deductionPaise;
        const isPaid = newOutstanding === 0;
        const newStatus = isPaid ? 'PAID' : 'ACTIVE';

        await tx.query(
          `UPDATE loans
           SET outstanding_balance_paise = $1,
               total_repaid_paise = $2,
               status = $3,
               settled_at = $4
           WHERE id = $5`,
          [newOutstanding, newTotalRepaid, newStatus, isPaid ? timestamp : null, activeLoan.id]
        );

        // Record Repayment
        const repaymentId = `rep_${instructionId}`;
        await tx.query(
          `INSERT INTO repayments (
             id, loan_id, debit_instruction_id, worker_id, amount_paise,
             previous_balance_paise, new_outstanding_balance_paise,
             is_final_settlement, settled_at, upi_ref
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            repaymentId,
            activeLoan.id,
            instructionId,
            request.workerId,
            deductionPaise,
            activeLoan.outstanding_balance_paise,
            newOutstanding,
            isPaid,
            timestamp,
            upiRef,
          ]
        );

        // Mark payout PROCESSED
        await tx.query(
          `UPDATE payout_events SET status = 'PROCESSED' WHERE id = $1`,
          [payoutId]
        );

        // Record Audit Event
        await tx.query(
          `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            `aud_${Date.now()}`,
            activeLoan.user_id || activeLoan.lender_id,
            'REPAYMENT_STREAMED',
            'REPAYMENT',
            repaymentId,
            `Deducted ₹${(deductionPaise / 100).toFixed(2)} from ₹${(amountPaise / 100).toFixed(2)} payout. Loan status: ${newStatus}`,
          ]
        );

        return {
          payoutId,
          reference: request.reference,
          payoutStatus: 'PROCESSED',
          workerId: request.workerId,
          platformId,
          amountPaise,
          hasActiveLoan: true,
          loanId: activeLoan.id,
          debitInstruction: {
            id: instructionId,
            status: 'SUCCEEDED',
            amountPaise: deductionPaise,
            idempotencyKey,
            retryCount: 0,
            maxRetries: this.config.maxRetries,
            upiRef,
          },
          repayment: {
            id: repaymentId,
            loanId: activeLoan.id,
            amountPaise: deductionPaise,
            previousBalancePaise: activeLoan.outstanding_balance_paise,
            newOutstandingBalancePaise: newOutstanding,
            isFinalSettlement: isPaid,
            settledAt: timestamp,
            upiRef,
          },
          loanState: {
            id: activeLoan.id,
            outstandingBalancePaise: newOutstanding,
            totalRepaidPaise: newTotalRepaid,
            status: newStatus,
          },
          message: isPaid
            ? `Loan ${activeLoan.id} has reached zero balance and is now PAID in full!`
            : `Streamed ₹${(deductionPaise / 100).toFixed(2)} deduction. Remaining balance: ₹${(newOutstanding / 100).toFixed(2)}`,
          timestamp,
        };
      }

      // If autoConfirm = false, return PENDING instruction receipt
      return {
        payoutId,
        reference: request.reference,
        payoutStatus: 'RECEIVED',
        workerId: request.workerId,
        platformId,
        amountPaise,
        hasActiveLoan: true,
        loanId: activeLoan.id,
        debitInstruction: {
          id: instructionId,
          status: 'PENDING',
          amountPaise: calcResult.deductionPaise,
          idempotencyKey,
          retryCount: 0,
          maxRetries: this.config.maxRetries,
        },
        loanState: {
          id: activeLoan.id,
          outstandingBalancePaise: activeLoan.outstanding_balance_paise,
          totalRepaidPaise: activeLoan.total_repaid_paise,
          status: activeLoan.status,
        },
        message: 'Debit instruction created in PENDING state. Awaiting payment confirmation.',
        timestamp,
      };
    });
  }

  /**
   * Payment Provider Callback Confirmation Handler
   * Validates:
   * - Step 11: Rejects callbacks with mismatched amounts, references or instruction IDs
   * - Step 6 & 11: Duplicate callbacks do not create duplicate repayments
   * - Step 8: On confirmed success, atomically creates repayment and reduces loan balance
   * - Step 9: On failure, retains outstanding balance
   * - Step 12: Closes loan (status = 'PAID') when outstanding reaches zero
   */
  async processPaymentCallback(callback: DebitCallbackRequest): Promise<{
    success: boolean;
    instructionId: string;
    status: 'SUCCEEDED' | 'FAILED' | 'RETRY_PENDING';
    repaymentId?: string;
    newOutstandingBalancePaise?: number;
    loanStatus?: 'ACTIVE' | 'PAID';
    message: string;
  }> {
    return await db.transaction(async (tx: TransactionClient) => {
      // 1. Fetch instruction
      const insRes = await tx.query(
        `SELECT di.*, pe.reference as payout_reference
         FROM debit_instructions di
         JOIN payout_events pe ON pe.id = di.payout_event_id
         WHERE di.id = $1
         FOR UPDATE`,
        [callback.instructionId]
      );

      if (insRes.rows.length === 0) {
        const err: any = new Error(`Debit instruction ${callback.instructionId} not found.`);
        err.statusCode = 404;
        err.code = 'INSTRUCTION_NOT_FOUND';
        throw err;
      }

      const instruction = insRes.rows[0];

      // 2. Step 11: Reject mismatched callbacks
      if (instruction.amount_paise !== callback.amountPaise) {
        const err: any = new Error(
          `Callback amount mismatch: expected ${instruction.amount_paise} paise, received ${callback.amountPaise} paise.`
        );
        err.statusCode = 400;
        err.code = 'AMOUNT_MISMATCH';
        throw err;
      }

      if (callback.reference && callback.reference !== instruction.payout_reference) {
        const err: any = new Error(
          `Callback reference mismatch: expected ${instruction.payout_reference}, received ${callback.reference}.`
        );
        err.statusCode = 400;
        err.code = 'REFERENCE_MISMATCH';
        throw err;
      }

      // 3. Duplicate callback check: If already SUCCEEDED, acknowledge safely without re-crediting!
      if (instruction.status === 'SUCCEEDED') {
        const repRes = await tx.query(
          `SELECT * FROM repayments WHERE debit_instruction_id = $1 LIMIT 1`,
          [instruction.id]
        );
        const existingRep = repRes.rows[0];

        return {
          success: true,
          instructionId: instruction.id,
          status: 'SUCCEEDED',
          repaymentId: existingRep?.id,
          newOutstandingBalancePaise: existingRep?.new_outstanding_balance_paise,
          message: 'Duplicate callback safely acknowledged. Repayment already settled.',
        };
      }

      const timestamp = new Date().toISOString();

      // 4. Handle Success
      if (callback.success) {
        const upiRef = callback.upiRef || `UPI/${Date.now()}/${Math.floor(1000000000 + Math.random() * 9000000000)}`;

        // Lock loan
        const loanRes = await tx.query(
          `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
          [instruction.loan_id]
        );
        const loan = loanRes.rows[0];

        // Deduct without over-repayment
        const deductionPaise = Math.min(instruction.amount_paise, loan.outstanding_balance_paise);
        const newOutstanding = Math.max(0, loan.outstanding_balance_paise - deductionPaise);
        const newTotalRepaid = loan.total_repaid_paise + deductionPaise;
        const isPaid = newOutstanding === 0;
        const newStatus = isPaid ? 'PAID' : 'ACTIVE';

        // Update Loan
        await tx.query(
          `UPDATE loans
           SET outstanding_balance_paise = $1,
               total_repaid_paise = $2,
               status = $3,
               settled_at = $4
           WHERE id = $5`,
          [newOutstanding, newTotalRepaid, newStatus, isPaid ? timestamp : null, loan.id]
        );

        // Update instruction
        await tx.query(
          `UPDATE debit_instructions
           SET status = 'SUCCEEDED', upi_ref = $1, executed_at = $2
           WHERE id = $3`,
          [upiRef, timestamp, instruction.id]
        );

        // Create repayment record
        const repaymentId = `rep_${instruction.id}`;
        await tx.query(
          `INSERT INTO repayments (
             id, loan_id, debit_instruction_id, worker_id, amount_paise,
             previous_balance_paise, new_outstanding_balance_paise,
             is_final_settlement, settled_at, upi_ref
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            repaymentId,
            loan.id,
            instruction.id,
            instruction.worker_id,
            deductionPaise,
            loan.outstanding_balance_paise,
            newOutstanding,
            isPaid,
            timestamp,
            upiRef,
          ]
        );

        // Mark payout PROCESSED
        await tx.query(
          `UPDATE payout_events SET status = 'PROCESSED' WHERE id = $1`,
          [instruction.payout_event_id]
        );

        return {
          success: true,
          instructionId: instruction.id,
          status: 'SUCCEEDED',
          repaymentId,
          newOutstandingBalancePaise: newOutstanding,
          loanStatus: newStatus,
          message: isPaid
            ? `Repayment settled in full. Loan ${loan.id} is now PAID.`
            : `Repayment of ₹${(deductionPaise / 100).toFixed(2)} recorded.`,
        };
      }

      // 5. Handle Failure: Step 9 & 10
      const currentRetries = instruction.retry_count;
      const canRetry = currentRetries < instruction.max_retries;
      const nextStatus = canRetry ? 'RETRY_PENDING' : 'FAILED';

      await tx.query(
        `UPDATE debit_instructions
         SET status = $1, retry_count = retry_count + 1, failure_reason = $2
         WHERE id = $3`,
        [nextStatus, callback.failureReason || 'Payment provider callback reported failure', instruction.id]
      );

      return {
        success: false,
        instructionId: instruction.id,
        status: nextStatus,
        message: canRetry
          ? `Debit failed, marked RETRY_PENDING (attempt ${currentRetries + 1} of ${instruction.max_retries}). Loan balance retained.`
          : `Debit failed and retries exhausted. Status marked FAILED. Loan balance retained.`,
      };
    });
  }

  /**
   * Retry a debit instruction that is in RETRY_PENDING state
   */
  async retryDebitInstruction(instructionId: string): Promise<EngineExecutionReceipt> {
    return await db.transaction(async (tx: TransactionClient) => {
      const insRes = await tx.query(
        `SELECT di.*, pe.reference as payout_reference, pe.platform_id, pe.amount_paise as payout_amount
         FROM debit_instructions di
         JOIN payout_events pe ON pe.id = di.payout_event_id
         WHERE di.id = $1
         FOR UPDATE`,
        [instructionId]
      );

      if (insRes.rows.length === 0) {
        const err: any = new Error('Debit instruction not found');
        err.statusCode = 404;
        throw err;
      }

      const instruction = insRes.rows[0];
      if (instruction.status !== 'RETRY_PENDING') {
        const err: any = new Error(`Cannot retry instruction in status ${instruction.status}. Only RETRY_PENDING allowed.`);
        err.statusCode = 400;
        throw err;
      }

      if (instruction.retry_count >= instruction.max_retries) {
        await tx.query(`UPDATE debit_instructions SET status = 'FAILED' WHERE id = $1`, [instructionId]);
        const err: any = new Error(`Max retries (${instruction.max_retries}) exhausted for instruction.`);
        err.statusCode = 400;
        throw err;
      }

      // Simulate successful retry execution
      const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const upiRef = `UPI/${yyyymmdd}/${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const timestamp = new Date().toISOString();

      const loanRes = await tx.query(`SELECT * FROM loans WHERE id = $1 FOR UPDATE`, [instruction.loan_id]);
      const loan = loanRes.rows[0];

      const deductionPaise = Math.min(instruction.amount_paise, loan.outstanding_balance_paise);
      const newOutstanding = Math.max(0, loan.outstanding_balance_paise - deductionPaise);
      const newTotalRepaid = loan.total_repaid_paise + deductionPaise;
      const isPaid = newOutstanding === 0;
      const newStatus = isPaid ? 'PAID' : 'ACTIVE';

      await tx.query(
        `UPDATE loans
         SET outstanding_balance_paise = $1, total_repaid_paise = $2, status = $3, settled_at = $4
         WHERE id = $5`,
        [newOutstanding, newTotalRepaid, newStatus, isPaid ? timestamp : null, loan.id]
      );

      await tx.query(
        `UPDATE debit_instructions
         SET status = 'SUCCEEDED', upi_ref = $1, executed_at = $2
         WHERE id = $3`,
        [upiRef, timestamp, instruction.id]
      );

      const repaymentId = `rep_${instruction.id}_retry`;
      await tx.query(
        `INSERT INTO repayments (
           id, loan_id, debit_instruction_id, worker_id, amount_paise,
           previous_balance_paise, new_outstanding_balance_paise,
           is_final_settlement, settled_at, upi_ref
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          repaymentId,
          loan.id,
          instruction.id,
          instruction.worker_id,
          deductionPaise,
          loan.outstanding_balance_paise,
          newOutstanding,
          isPaid,
          timestamp,
          upiRef,
        ]
      );

      return {
        payoutId: instruction.payout_event_id,
        reference: instruction.payout_reference,
        payoutStatus: 'PROCESSED',
        workerId: instruction.worker_id,
        platformId: instruction.platform_id,
        amountPaise: instruction.payout_amount,
        hasActiveLoan: true,
        loanId: loan.id,
        debitInstruction: {
          id: instruction.id,
          status: 'SUCCEEDED',
          amountPaise: deductionPaise,
          idempotencyKey: instruction.idempotency_key,
          retryCount: instruction.retry_count + 1,
          maxRetries: instruction.max_retries,
          upiRef,
        },
        repayment: {
          id: repaymentId,
          loanId: loan.id,
          amountPaise: deductionPaise,
          previousBalancePaise: loan.outstanding_balance_paise,
          newOutstandingBalancePaise: newOutstanding,
          isFinalSettlement: isPaid,
          settledAt: timestamp,
          upiRef,
        },
        loanState: {
          id: loan.id,
          outstandingBalancePaise: newOutstanding,
          totalRepaidPaise: newTotalRepaid,
          status: newStatus,
        },
        message: `Retry succeeded on attempt ${instruction.retry_count + 1}. Deduction settled.`,
        timestamp,
      };
    });
  }

  /**
   * Get detailed transaction history showing complete lifecycle:
   * Payout Event -> Debit Instruction -> Repayment -> Loan State
   */
  async getTransactionHistory(params: {
    workerId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    transactions: any[];
    total: number;
  }> {
    const conditions: string[] = [];
    const sqlParams: any[] = [];
    let paramIdx = 1;

    if (params.workerId) {
      conditions.push(`pe.worker_id = $${paramIdx++}`);
      sqlParams.push(params.workerId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const countRes = await db.query(
      `SELECT COUNT(*) as total FROM payout_events pe ${where}`,
      sqlParams
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const query = `
      SELECT 
        pe.id as payout_id,
        pe.reference as payout_reference,
        pe.amount_paise as payout_amount_paise,
        pe.payout_date,
        pe.status as payout_status,
        pe.skip_reason,
        pe.detected_at,
        di.id as debit_instruction_id,
        di.status as debit_status,
        di.amount_paise as deduction_paise,
        di.retry_count,
        di.max_retries,
        di.upi_ref,
        di.failure_reason,
        di.idempotency_key,
        rep.id as repayment_id,
        rep.previous_balance_paise,
        rep.new_outstanding_balance_paise,
        rep.is_final_settlement,
        rep.settled_at,
        l.id as loan_id,
        l.status as loan_status,
        l.outstanding_balance_paise as current_loan_balance_paise,
        w.did as worker_did,
        u.name as worker_name
      FROM payout_events pe
      JOIN worker_profiles w ON w.id = pe.worker_id
      JOIN users u ON u.id = w.user_id
      LEFT JOIN debit_instructions di ON di.payout_event_id = pe.id
      LEFT JOIN repayments rep ON rep.debit_instruction_id = di.id
      LEFT JOIN loans l ON l.id = di.loan_id
      ${where}
      ORDER BY pe.detected_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    const res = await db.query(query, [...sqlParams, limit, offset]);
    return {
      transactions: res.rows,
      total,
    };
  }
}

export const repaymentEngine = new DeterministicRepaymentEngine();
