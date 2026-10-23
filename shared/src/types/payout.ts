export type PayoutStatus = 'DETECTED' | 'STREAM_TRIGGERED' | 'COMPLETED' | 'SKIPPED' | 'FAILED';

export interface PayoutEvent {
  id: string;
  did: string;
  platformId: string;
  amountPaise: number; // Integer paise e.g. ₹1,200 = 120000 paise
  reference: string;
  payoutDate: string;
  detectedAt: string;
  status: PayoutStatus;
  skipReason?: string;
  processedDeductionId?: string;
}

export interface SimulatePayoutRequest {
  did: string;
  platformId: string;
  amountPaise: number;
  reference?: string;
  payoutDate?: string;
}
