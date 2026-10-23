export type ConsentStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export type ConsentScope = 
  | 'EARNINGS_READ'
  | 'EARNINGS_WRITE'
  | 'REPAYMENT_DEBIT'
  | 'CREDIT_ASSESSMENT';

export interface ConsentRecord {
  id: string;
  did: string;
  grantee: string; // e.g. "did:drunix:lender:kotak-micro" or "did:drunix:platform:zomato"
  scope: ConsentScope[];
  purpose: string;
  grantedAt: string;
  expiresAt: string;
  status: ConsentStatus;
  txHash?: string;
  blockNumber?: number;
}

export interface GrantConsentRequest {
  did: string;
  grantee: string;
  scope: ConsentScope[];
  purpose: string;
  durationDays: number;
}
