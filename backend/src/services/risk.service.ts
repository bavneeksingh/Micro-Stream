import { inMemoryStore } from '../db/in-memory-store.js';
import { WorkerEarningsSummary } from '@microstream/shared';

export interface WorkerRiskProfile {
  did: string;
  name: string;
  primaryPlatform: string;
  creditTier: string;
  riskScore: number;
  activeEarningDays: number;
  avgDailyGrossPaise: number;
  volatilityPaise: number;
  totalGrossEarningsPaise: number;
  totalRepaidToDatePaise: number;
  hasActiveLoan: boolean;
  activeLoanId?: string;
  recommendedCreditLimitPaise: number;
  recommendedDeductionRateBps: number;
}

export interface PortfolioSummary {
  totalPrincipalPaise: number;
  totalRepaidPaise: number;
  totalOutstandingPaise: number;
  activeLoansCount: number;
  settledLoansCount: number;
  repaymentProgressPct: number;
  averageDeductionRateBps: number;
}

export class RiskService {
  async getWorkerRiskProfile(did: string): Promise<WorkerRiskProfile | null> {
    const worker = inMemoryStore.workers.get(did);
    if (!worker) return null;

    const earnings = Array.from(inMemoryStore.earnings.values()).filter((e) => e.did === did);
    const repayments = Array.from(inMemoryStore.repayments.values()).filter((r) => r.did === did);
    const activeLoan = Array.from(inMemoryStore.loans.values()).find(
      (l) => l.did === did && l.status === 'ACTIVE'
    );

    const totalGross = earnings.reduce((sum, e) => sum + e.grossEarningsPaise, 0);
    const avgDaily = earnings.length > 0 ? Math.round(totalGross / earnings.length) : 0;

    const squareDiffs = earnings.map((e) => Math.pow(e.grossEarningsPaise - avgDaily, 2));
    const variance = earnings.length > 0 ? squareDiffs.reduce((a, b) => a + b, 0) / earnings.length : 0;
    const volatility = Math.round(Math.sqrt(variance));

    const totalRepaid = repayments.reduce((sum, r) => sum + r.amountPaise, 0);

    // Recommended underwriting parameters based on cash flow health
    let recommendedLimit = 800000; // ₹8,000 default
    let recommendedRateBps = 750;   // 7.5% default

    if (worker.riskScore >= 85 && earnings.length >= 7) {
      recommendedLimit = 2500000; // ₹25,000
      recommendedRateBps = 500;   // 5.0%
    } else if (worker.riskScore >= 70 && earnings.length >= 5) {
      recommendedLimit = 1500000; // ₹15,000
      recommendedRateBps = 600;   // 6.0%
    }

    return {
      did: worker.did,
      name: worker.name,
      primaryPlatform: worker.primaryPlatform,
      creditTier: worker.creditTier,
      riskScore: worker.riskScore,
      activeEarningDays: earnings.length,
      avgDailyGrossPaise: avgDaily,
      volatilityPaise: volatility,
      totalGrossEarningsPaise: totalGross,
      totalRepaidToDatePaise: totalRepaid,
      hasActiveLoan: !!activeLoan,
      activeLoanId: activeLoan?.loanId,
      recommendedCreditLimitPaise: recommendedLimit,
      recommendedDeductionRateBps: recommendedRateBps,
    };
  }

  async getAllWorkersRiskProfiles(): Promise<WorkerRiskProfile[]> {
    const profiles: WorkerRiskProfile[] = [];
    for (const did of inMemoryStore.workers.keys()) {
      const p = await this.getWorkerRiskProfile(did);
      if (p) profiles.push(p);
    }
    return profiles.sort((a, b) => b.avgDailyGrossPaise - a.avgDailyGrossPaise);
  }

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const loans = Array.from(inMemoryStore.loans.values());
    const totalPrincipal = loans.reduce((sum, l) => sum + l.principalPaise, 0);
    const totalRepaid = loans.reduce((sum, l) => sum + l.totalRepaidPaise, 0);
    const totalOutstanding = loans.reduce((sum, l) => sum + l.outstandingBalancePaise, 0);
    const activeLoans = loans.filter((l) => l.status === 'ACTIVE').length;
    const settledLoans = loans.filter((l) => l.status === 'SETTLED').length;

    const progressPct =
      totalPrincipal > 0 ? Math.round((totalRepaid / totalPrincipal) * 10000) / 100 : 0;

    const avgRateBps =
      loans.length > 0
        ? Math.round(loans.reduce((sum, l) => sum + l.deductionRateBps, 0) / loans.length)
        : 500;

    return {
      totalPrincipalPaise: totalPrincipal,
      totalRepaidPaise: totalRepaid,
      totalOutstandingPaise: totalOutstanding,
      activeLoansCount: activeLoans,
      settledLoansCount: settledLoans,
      repaymentProgressPct: progressPct,
      averageDeductionRateBps: avgRateBps,
    };
  }
}
