export type UserRole = 'WORKER' | 'LENDER' | 'PLATFORM_ORACLE' | 'ADMIN';

export type CreditTier = 'PRIME_A' | 'STANDARD_B' | 'EMERGING_C' | 'UNRATED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface WorkerProfile {
  did: string;
  userId: string;
  name: string;
  phone: string;
  primaryPlatform: 'ZOMATO' | 'SWIGGY' | 'UBER' | 'URBAN_COMPANY' | 'ZEPTO' | 'OTHER';
  vpa: string; // UPI ID: e.g. ravi@okhdfcbank
  activeMandateId?: string;
  creditTier: CreditTier;
  riskScore: number; // 0-100 scale (100 = lowest risk)
  joinedAt: string;
  publicKey: string;
  status: 'ACTIVE' | 'SUSPENDED';
}
