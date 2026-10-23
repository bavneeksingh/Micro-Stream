export type MandateStatus = 'ACTIVE' | 'AWAITING_AUTHORIZATION' | 'PENDING_AUTH' | 'PAUSED' | 'REVOKED' | 'EXPIRED';

export type MandateFrequency = 'AS_PRESENTED' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface AutoPayMandate {
  mandateId: string;
  umrn: string; // Unique Mandate Reference Number assigned by NPCI
  did: string;
  vpa: string; // UPI VPA
  bankAccountMasked: string; // e.g. "XX1234"
  ifscCode: string;
  maxAmountPaise: number; // Maximum single debit cap in paise (e.g. ₹2,000 = 200000 paise)
  frequency: MandateFrequency;
  status: MandateStatus;
  startDate: string;
  endDate: string;
  authorizedAt?: string;
  revokedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateMandateRequest {
  did: string;
  vpa: string;
  bankAccountMasked: string;
  ifscCode: string;
  maxAmountPaise: number;
  frequency?: MandateFrequency;
  durationMonths?: number;
}
