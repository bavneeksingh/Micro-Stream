import { WorkerProfile, CreditTier } from './user.js';
import { ConsentRecord, GrantConsentRequest } from './consent.js';
import { EarningsRecord, LogEarningsRequest, WorkerEarningsSummary } from './earnings.js';
import { Loan, IssueLoanRequest } from './loan.js';
import { PayoutEvent, SimulatePayoutRequest } from './payout.js';
import { DebitInstruction, ExecuteDebitRequest, DebitResult } from './debit.js';
import { Repayment } from './repayment.js';
import { AutoPayMandate, CreateMandateRequest } from './mandate.js';

/**
 * Adapter interface for interacting with the permissioned ledger
 * (Drunix / Hyperledger Fabric chaincode + YugabyteDB state queries).
 */
export interface ILedgerAdapter {
  readonly isMock: boolean;
  readonly providerName: string;

  // Identity & Consent
  registerWorkerDID(profile: Omit<WorkerProfile, 'joinedAt' | 'creditTier' | 'riskScore'> & { riskScore?: number }): Promise<{ did: string; txHash: string }>;
  getWorkerDID(did: string): Promise<WorkerProfile | null>;
  grantConsent(consent: GrantConsentRequest): Promise<ConsentRecord>;
  getConsent(did: string, grantee: string): Promise<ConsentRecord | null>;
  revokeConsent(consentId: string, did: string): Promise<ConsentRecord>;

  // Core Chaincode Methods (Matching README.md spec)
  logDailyEarnings(request: LogEarningsRequest): Promise<{ earningsId: string; txHash: string; blockNumber: number }>;
  recordDebitInstruction(params: {
    instructionId: string;
    loanId: string;
    did: string;
    amountPaise: number;
    idempotencyKey: string;
  }): Promise<DebitInstruction>;
  calculateDeduction(loanId: string, payoutAmountPaise: number, payoutRef: string): Promise<{
    deductionPaise: number;
    instructionId: string;
    idempotencyKey: string;
    outstandingBalancePaise: number;
    dailyCapPaise: number;
  }>;
  updateLoanBalance(params: {
    loanId: string;
    debitInstructionId: string;
    success: boolean;
    amountDebitedPaise: number;
    upiRef: string;
    failureReason?: string;
  }): Promise<{ loan: Loan; repayment?: Repayment; txHash: string }>;

  // Loan lifecycle
  issueLoan(request: IssueLoanRequest): Promise<Loan>;
  getLoan(loanId: string): Promise<Loan | null>;
  getActiveLoanByDid(did: string): Promise<Loan | null>;
  listLoans(filter?: { did?: string; status?: string }): Promise<Loan[]>;

  // Read & Risk Queries (YugabyteDB state queries)
  getEarningsSummary(did: string, days?: number): Promise<WorkerEarningsSummary>;
  listEarnings(did: string, limit?: number): Promise<EarningsRecord[]>;
  listRepayments(loanId?: string): Promise<Repayment[]>;
}

/**
 * Adapter interface for gig platform payout events (Zomato, Swiggy, Uber).
 */
export interface IPayoutProviderAdapter {
  readonly isMock: boolean;
  readonly providerName: string;

  simulatePayout(request: SimulatePayoutRequest): Promise<PayoutEvent>;
  getPayout(payoutId: string): Promise<PayoutEvent | null>;
  listPayouts(did?: string, limit?: number): Promise<PayoutEvent[]>;
}

/**
 * Adapter interface for UPI AutoPay variable e-mandate execution.
 * Mock implementation guarantees safe simulated operations without real monetary debits.
 */
export interface IPaymentProviderAdapter {
  readonly isMock: boolean;
  readonly providerName: string;

  createMandate(request: CreateMandateRequest): Promise<AutoPayMandate>;
  getMandate(mandateId: string): Promise<AutoPayMandate | null>;
  getMandateByDid(did: string): Promise<AutoPayMandate | null>;
  executeDebit(request: ExecuteDebitRequest): Promise<DebitResult>;
  cancelMandate(mandateId: string): Promise<AutoPayMandate>;
}
