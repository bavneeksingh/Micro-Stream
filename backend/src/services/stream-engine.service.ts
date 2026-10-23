import {
  ILedgerAdapter,
  IPayoutProviderAdapter,
  IPaymentProviderAdapter,
  SimulatePayoutRequest,
  PayoutEvent,
  Loan,
  Repayment,
  DebitResult,
} from '@microstream/shared';

export interface StreamExecutionReceipt {
  payout: PayoutEvent;
  earningsId?: string;
  hasActiveLoan: boolean;
  deductionCalculatedPaise: number;
  debitResult?: DebitResult;
  updatedLoan?: Loan;
  repayment?: Repayment;
  isLoanSettled: boolean;
  message: string;
  timestamp: string;
}

export class StreamEngineService {
  constructor(
    private readonly ledgerAdapter: ILedgerAdapter,
    private readonly payoutAdapter: IPayoutProviderAdapter,
    private readonly paymentAdapter: IPaymentProviderAdapter
  ) {}

  /**
   * Process a payout through the complete MicroStream streaming loop:
   * 1. Register Payout Event
   * 2. Log Earnings on Ledger
   * 3. Calculate Deduction via Chaincode
   * 4. Trigger Variable UPI AutoPay Debit
   * 5. Settle Repayment on Ledger
   */
  async processPayout(request: SimulatePayoutRequest): Promise<StreamExecutionReceipt> {
    const timestamp = new Date().toISOString();
    const today = request.payoutDate || timestamp.split('T')[0];
    const reference = request.reference || `PAY-${request.platformId.toUpperCase()}-${Date.now()}`;

    // Step 1: Record payout event
    const payout = await this.payoutAdapter.simulatePayout({
      did: request.did,
      platformId: request.platformId,
      amountPaise: request.amountPaise,
      reference,
      payoutDate: today,
    });

    // Step 2: Log daily earnings on permissioned ledger
    let earningsId: string | undefined;
    try {
      const earningsRes = await this.ledgerAdapter.logDailyEarnings({
        did: request.did,
        platformId: request.platformId,
        date: today,
        grossEarningsPaise: request.amountPaise,
        reference,
      });
      earningsId = earningsRes.earningsId;
    } catch (err) {
      console.error('[StreamEngine] Error logging earnings to ledger:', err);
    }

    // Step 3: Check for active micro-loan
    const activeLoan = await this.ledgerAdapter.getActiveLoanByDid(request.did);
    if (!activeLoan) {
      payout.status = 'SKIPPED';
      payout.skipReason = 'NO_ACTIVE_LOAN';
      return {
        payout,
        earningsId,
        hasActiveLoan: false,
        deductionCalculatedPaise: 0,
        isLoanSettled: false,
        message: 'No active loan found for worker DID. Payout recorded without deduction.',
        timestamp,
      };
    }

    // Step 4: Calculate deduction on ledger using chaincode logic
    const calcResult = await this.ledgerAdapter.calculateDeduction(
      activeLoan.loanId,
      request.amountPaise,
      reference
    );

    if (calcResult.deductionPaise <= 0) {
      payout.status = 'SKIPPED';
      payout.skipReason = 'ZERO_DEDUCTION';
      return {
        payout,
        earningsId,
        hasActiveLoan: true,
        deductionCalculatedPaise: 0,
        updatedLoan: activeLoan,
        isLoanSettled: activeLoan.outstandingBalancePaise === 0,
        message: 'Calculated deduction is zero (zero payout or loan already settled).',
        timestamp,
      };
    }

    // Step 5: Lookup active UPI AutoPay mandate
    const mandate = await this.paymentAdapter.getMandateByDid(request.did);
    if (!mandate) {
      payout.status = 'FAILED';
      payout.skipReason = 'NO_ACTIVE_MANDATE';
      return {
        payout,
        earningsId,
        hasActiveLoan: true,
        deductionCalculatedPaise: calcResult.deductionPaise,
        updatedLoan: activeLoan,
        isLoanSettled: false,
        message: 'Active UPI AutoPay mandate not found for worker DID.',
        timestamp,
      };
    }

    // Step 6: Trigger simulated variable UPI AutoPay debit
    const debitResult = await this.paymentAdapter.executeDebit({
      instructionId: calcResult.instructionId,
      loanId: activeLoan.loanId,
      mandateId: mandate.mandateId,
      amountPaise: calcResult.deductionPaise,
      idempotencyKey: calcResult.idempotencyKey,
      payerVpa: mandate.vpa,
    });

    // Step 7: Apply debit outcome to loan balance on ledger
    const updateResult = await this.ledgerAdapter.updateLoanBalance({
      loanId: activeLoan.loanId,
      debitInstructionId: calcResult.instructionId,
      success: debitResult.success,
      amountDebitedPaise: debitResult.amountDebitedPaise,
      upiRef: debitResult.upiRef || '',
      failureReason: debitResult.errorMessage,
    });

    if (debitResult.success) {
      payout.status = 'COMPLETED';
      payout.processedDeductionId = calcResult.instructionId;
    } else {
      payout.status = 'FAILED';
      payout.skipReason = debitResult.errorMessage || 'UPI_DEBIT_FAILED';
    }

    return {
      payout,
      earningsId,
      hasActiveLoan: true,
      deductionCalculatedPaise: calcResult.deductionPaise,
      debitResult,
      updatedLoan: updateResult.loan,
      repayment: updateResult.repayment,
      isLoanSettled: updateResult.loan.status === 'SETTLED',
      message: debitResult.success
        ? `Successfully streamed deduction of ₹${(calcResult.deductionPaise / 100).toFixed(2)} toward loan ${activeLoan.loanId}`
        : `Debit failed: ${debitResult.errorMessage}`,
      timestamp,
    };
  }
}
