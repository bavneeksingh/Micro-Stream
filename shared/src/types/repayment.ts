export interface Repayment {
  id: string;
  loanId: string;
  debitInstructionId: string;
  did: string;
  amountPaise: number; // Integer paise
  settledAt: string;
  upiRef: string;
  txHash: string;
  previousBalancePaise: number;
  newOutstandingBalancePaise: number;
  isFinalSettlement: boolean;
}
