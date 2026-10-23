export type EarningsStatus = 'RECORDED' | 'VERIFIED' | 'DISPUTED';

export interface EarningsRecord {
  id: string;
  did: string;
  platformId: string; // e.g. "zomato-in", "swiggy-in", "uber-in"
  date: string; // YYYY-MM-DD
  grossEarningsPaise: number; // Integer paise (e.g. 150000 = ₹1,500.00)
  netEarningsPaise: number; // Integer paise
  ordersOrTripsCount?: number;
  reference: string; // External transaction/settlement reference
  status: EarningsStatus;
  recordedAt: string;
  blockNumber?: number;
  txHash?: string;
}

export interface LogEarningsRequest {
  did: string;
  platformId: string;
  date: string;
  grossEarningsPaise: number;
  netEarningsPaise?: number;
  ordersOrTripsCount?: number;
  reference: string;
}

export interface WorkerEarningsSummary {
  did: string;
  totalEarningsPaise: number;
  averageDailyEarningsPaise: number;
  activeDaysCount: number;
  daysEvaluated: number;
  volatilityPaise: number; // Standard deviation of daily earnings in paise
  periodStart: string;
  periodEnd: string;
}
