export type DebitInstructionStatus = 
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRYING'
  | 'CARRIED_FORWARD';

export interface DebitInstruction {
  instructionId: string;
  loanId: string;
  did: string;
  payoutId: string;
  amountPaise: number; // Integer paise
  status: DebitInstructionStatus;
  idempotencyKey: string;
  upiRef?: string;
  retryCount: number;
  maxRetries: number;
  failureReason?: string;
  createdAt: string;
  executedAt?: string;
  txHash?: string;
}

export interface ExecuteDebitRequest {
  instructionId: string;
  loanId: string;
  mandateId: string;
  amountPaise: number;
  idempotencyKey: string;
  payerVpa: string;
}

export interface DebitResult {
  success: boolean;
  instructionId: string;
  amountDebitedPaise: number;
  upiRef?: string;
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
}
