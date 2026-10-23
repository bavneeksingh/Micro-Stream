export type LoanStatus = 'PENDING_APPROVAL' | 'PENDING' | 'ACTIVE' | 'SETTLED' | 'PAID' | 'REJECTED' | 'DEFAULTED' | 'CANCELLED';

export interface Loan {
  loanId: string;
  did: string;
  lenderId: string; // e.g. "lender-kotak-micro"
  lenderName: string;
  principalPaise: number; // e.g. ₹10,000 = 1000000 paise
  outstandingBalancePaise: number; // starts at principal + total interest or principal
  interestRateBps: number; // e.g. 1200 bps = 12.00%
  deductionRateBps: number; // e.g. 500 bps = 5.00% daily deduction
  dailyCapPaise: number; // e.g. ₹200 = 20000 paise maximum daily deduction cap
  totalRepaidPaise: number;
  mandateId: string;
  status: LoanStatus;
  purpose: string;
  issuedAt: string;
  settledAt?: string;
  txHash?: string;
}

export interface IssueLoanRequest {
  did: string;
  lenderId: string;
  lenderName?: string;
  principalPaise: number;
  deductionRateBps: number;
  dailyCapPaise?: number;
  mandateId: string;
  purpose?: string;
}
