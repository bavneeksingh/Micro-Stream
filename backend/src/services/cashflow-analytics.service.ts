import { db } from '../db/db.js';

export interface CashFlowAnalyticsResult {
  workerId: string;
  pseudonymId: string;
  platform: string;
  windowDays: number; // 30 or 60
  startDate: string;
  endDate: string;

  // 1. Core Cash-Flow Metrics
  activeEarningDays: number;
  zeroIncomeDays: number;
  missingDataDays: number;
  sampleCompletenessPct: number;

  totalGrossEarningsPaise: number;
  avgDailyEarningsPaise: number; // Total gross / active days
  calendarAvgDailyEarningsPaise: number; // Total gross / windowDays
  medianDailyEarningsPaise: number;

  volatilityPaise: number;
  volatilityCoefficient: number; // CV = sigma / mu
  volatilityTier: 'LOW' | 'MODERATE' | 'HIGH';

  payoutFrequencyDays: number;
  payoutsCount: number;

  recentTrend: {
    firstHalfAvgPaise: number;
    secondHalfAvgPaise: number;
    changePct: number;
    trend: 'RISING' | 'STABLE' | 'FALLING';
    explanation: string;
  };

  // 2. Loan & Repayment Metrics
  outstandingLoanBalancePaise: number;
  totalRepaymentsPaise: number;
  repaymentToEarningsRatioPct: number;

  // 3. AutoPay Debit Reliability Metrics
  totalDebitAttempts: number;
  successfulDebitsCount: number;
  failedDebitsCount: number;
  debitSuccessRatePct: number;
  debitFailureRatePct: number;

  // 4. Daily series for chart rendering
  dailySeries: Array<{
    date: string;
    grossEarningsPaise: number;
    status: 'ACTIVE_EARNING' | 'ZERO_INCOME' | 'MISSING_DATA';
    ordersCount: number;
  }>;
}

export interface RiskIndicator {
  indicator: string;
  name: string;
  measuredValue: string;
  benchmark: string;
  level: 'POSITIVE' | 'NEUTRAL' | 'CAUTION' | 'INSUFFICIENT_DATA';
  scoreImpact: number;
  contributingFactors: string;
}

export interface TransparentRiskAssessment {
  workerId: string;
  pseudonymId: string;
  evaluatedAt: string;
  dataWindowDays: number;
  sampleSizeDays: number;
  status: 'EVALUATED' | 'INSUFFICIENT_DATA';
  riskCategory: 'LOW_RISK' | 'MODERATE_RISK' | 'ELEVATED_RISK' | 'INSUFFICIENT_DATA';

  indicators: RiskIndicator[];

  underwritingRecommendation: {
    recommendedCreditLimitPaise: number;
    recommendedDeductionRateBps: number;
    recommendedDailyCapPaise: number;
    rationale: string;
  };

  methodologyAndAssumptions: {
    rulesEngineType: 'TRANSPARENT_DETERMINISTIC_RULES';
    windowDays: number;
    sampleSizeActiveDays: number;
    minSampleSizeRequired: number;
    assumptions: string[];
    regulatoryDisclaimer: string;
  };
}

export class CashFlowAnalyticsService {
  /**
   * Helper to derive pseudonymous ID for privacy-compliant lender underwriting.
   * Example: "wrk_ravi_01" -> "GIG-WRK-B89F"
   */
  public generatePseudonym(workerId: string, platform?: string): string {
    let hash = 0;
    const str = `${workerId}-${platform || 'gig'}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, '0').slice(-4);
    const prefix = platform ? platform.slice(0, 3).toUpperCase() : 'GIG';
    return `${prefix}-WRK-${hex}`;
  }

  /**
   * Calculate Cash-Flow Analytics for a rolling 30-day or 60-day period.
   * PostgreSQL-compatible SQL queries with explicit handling of missing data vs zero income.
   */
  async calculateWorkerAnalytics(
    workerId: string,
    windowDays: 30 | 60 = 30
  ): Promise<CashFlowAnalyticsResult> {
    // 1. Resolve Worker
    const workerRes = await db.query(
      `SELECT w.*, u.name as real_name FROM worker_profiles w JOIN users u ON u.id = w.user_id WHERE w.id = $1 OR w.did = $1`,
      [workerId]
    );

    if (workerRes.rows.length === 0) {
      const err: any = new Error(`Worker ${workerId} not found`);
      err.statusCode = 404;
      throw err;
    }

    const worker = workerRes.rows[0];
    const actualWorkerId = worker.id;
    const platform = worker.primary_platform || 'ZOMATO';
    const pseudonymId = this.generatePseudonym(actualWorkerId, platform);

    // 2. Determine Calendar Date Window
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const startDateObj = new Date(today.getTime() - windowDays * 86400000);
    const startDate = startDateObj.toISOString().split('T')[0];

    // 3. PostgreSQL-Compatible SQL Query for Recorded Earnings
    const earningsRes = await db.query(
      `SELECT
         date,
         gross_earnings_paise,
         net_earnings_paise,
         orders_count,
         status
       FROM earnings_records
       WHERE worker_id = $1
         AND date >= $2
         AND date <= $3
       ORDER BY date ASC`,
      [actualWorkerId, startDate, endDate]
    );

    const recordedRows = earningsRes.rows;
    const recordedMap = new Map<string, any>();
    for (const r of recordedRows) {
      const dStr = typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0];
      recordedMap.set(dStr, {
        gross: Number(r.gross_earnings_paise),
        net: Number(r.net_earnings_paise),
        orders: Number(r.orders_count || 0),
      });
    }

    // 4. Construct complete daily series across all windowDays calendar days
    // Clearly distinguishes ACTIVE_EARNING (> 0), ZERO_INCOME (== 0), and MISSING_DATA (no row).
    const dailySeries: CashFlowAnalyticsResult['dailySeries'] = [];
    let activeEarningDays = 0;
    let zeroIncomeDays = 0;
    let missingDataDays = 0;
    let totalGrossPaise = 0;
    const activeGrossAmounts: number[] = [];

    for (let i = windowDays; i >= 1; i--) {
      const d = new Date(today.getTime() - i * 86400000).toISOString().split('T')[0];
      if (recordedMap.has(d)) {
        const item = recordedMap.get(d)!;
        if (item.gross > 0) {
          activeEarningDays++;
          totalGrossPaise += item.gross;
          activeGrossAmounts.push(item.gross);
          dailySeries.push({
            date: d,
            grossEarningsPaise: item.gross,
            status: 'ACTIVE_EARNING',
            ordersCount: item.orders,
          });
        } else {
          zeroIncomeDays++;
          dailySeries.push({
            date: d,
            grossEarningsPaise: 0,
            status: 'ZERO_INCOME',
            ordersCount: 0,
          });
        }
      } else {
        missingDataDays++;
        dailySeries.push({
          date: d,
          grossEarningsPaise: 0,
          status: 'MISSING_DATA',
          ordersCount: 0,
        });
      }
    }

    // 5. Averages & Median
    const avgDailyEarningsPaise = activeEarningDays > 0 ? Math.round(totalGrossPaise / activeEarningDays) : 0;
    const calendarAvgDailyEarningsPaise = Math.round(totalGrossPaise / windowDays);

    let medianDailyEarningsPaise = 0;
    if (activeGrossAmounts.length > 0) {
      const sorted = [...activeGrossAmounts].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianDailyEarningsPaise = sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
    }

    // 6. Volatility (Standard Deviation & Coefficient of Variation)
    let variance = 0;
    if (activeGrossAmounts.length > 0 && avgDailyEarningsPaise > 0) {
      const sqDiffSum = activeGrossAmounts.reduce((acc, val) => acc + Math.pow(val - avgDailyEarningsPaise, 2), 0);
      variance = sqDiffSum / activeGrossAmounts.length;
    }
    const volatilityPaise = Math.round(Math.sqrt(variance));
    const volatilityCoefficient = avgDailyEarningsPaise > 0
      ? Number((volatilityPaise / avgDailyEarningsPaise).toFixed(3))
      : 0;

    let volatilityTier: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
    if (volatilityCoefficient > 0.55) volatilityTier = 'HIGH';
    else if (volatilityCoefficient > 0.30) volatilityTier = 'MODERATE';

    // 7. Payout Frequency
    const payoutsCount = activeEarningDays;
    const payoutFrequencyDays = activeEarningDays > 0 ? Number((windowDays / activeEarningDays).toFixed(1)) : windowDays;

    // 8. Recent Earnings Trend (First Half vs Second Half)
    const halfDays = Math.floor(windowDays / 2);
    const firstHalfSeries = dailySeries.slice(0, halfDays);
    const secondHalfSeries = dailySeries.slice(halfDays);

    const firstHalfGross = firstHalfSeries.reduce((s, d) => s + d.grossEarningsPaise, 0);
    const firstHalfActive = firstHalfSeries.filter((d) => d.status === 'ACTIVE_EARNING').length || 1;
    const firstHalfAvgPaise = Math.round(firstHalfGross / firstHalfActive);

    const secondHalfGross = secondHalfSeries.reduce((s, d) => s + d.grossEarningsPaise, 0);
    const secondHalfActive = secondHalfSeries.filter((d) => d.status === 'ACTIVE_EARNING').length || 1;
    const secondHalfAvgPaise = Math.round(secondHalfGross / secondHalfActive);

    let changePct = 0;
    if (firstHalfAvgPaise > 0) {
      changePct = Number((((secondHalfAvgPaise - firstHalfAvgPaise) / firstHalfAvgPaise) * 100).toFixed(1));
    }

    let trend: 'RISING' | 'STABLE' | 'FALLING' = 'STABLE';
    if (changePct > 5.0) trend = 'RISING';
    else if (changePct < -5.0) trend = 'FALLING';

    const explanation = trend === 'RISING'
      ? `Recent daily earnings increased by +${changePct}% over the prior period.`
      : trend === 'FALLING'
      ? `Recent daily earnings decreased by ${changePct}% compared to the prior period.`
      : `Daily earnings remained stable (${changePct >= 0 ? '+' : ''}${changePct}%) across both periods.`;

    // 9. Query Outstanding Loan Balance
    const loanRes = await db.query(
      `SELECT COALESCE(SUM(outstanding_balance_paise), 0) as total_outstanding
       FROM loans
       WHERE worker_id = $1 AND status = 'ACTIVE'`,
      [actualWorkerId]
    );
    const outstandingLoanBalancePaise = Number(loanRes.rows[0]?.total_outstanding || 0);

    // 10. Query Repayments in Window
    const repRes = await db.query(
      `SELECT COALESCE(SUM(amount_paise), 0) as total_repaid
       FROM repayments
       WHERE worker_id = $1 AND settled_at >= $2`,
      [actualWorkerId, startDateObj.toISOString()]
    );
    const totalRepaymentsPaise = Number(repRes.rows[0]?.total_repaid || 0);
    const repaymentToEarningsRatioPct = totalGrossPaise > 0
      ? Number(((totalRepaymentsPaise / totalGrossPaise) * 100).toFixed(2))
      : 0;

    // 11. Query Debit Success and Failure Rates
    const debitRes = await db.query(
      `SELECT
         COUNT(*) as total_debits,
         COUNT(CASE WHEN status = 'SUCCEEDED' THEN 1 END) as succeeded_count,
         COUNT(CASE WHEN status IN ('FAILED', 'RETRY_PENDING') THEN 1 END) as failed_count
       FROM debit_instructions
       WHERE worker_id = $1 AND created_at >= $2`,
      [actualWorkerId, startDateObj.toISOString()]
    );
    const totalDebitAttempts = Number(debitRes.rows[0]?.total_debits || 0);
    const successfulDebitsCount = Number(debitRes.rows[0]?.succeeded_count || 0);
    const failedDebitsCount = Number(debitRes.rows[0]?.failed_count || 0);

    const debitSuccessRatePct = totalDebitAttempts > 0
      ? Number(((successfulDebitsCount / totalDebitAttempts) * 100).toFixed(1))
      : 100;
    const debitFailureRatePct = totalDebitAttempts > 0
      ? Number(((failedDebitsCount / totalDebitAttempts) * 100).toFixed(1))
      : 0;

    const sampleCompletenessPct = Number(
      (((activeEarningDays + zeroIncomeDays) / windowDays) * 100).toFixed(1)
    );

    return {
      workerId: actualWorkerId,
      pseudonymId,
      platform,
      windowDays,
      startDate,
      endDate,
      activeEarningDays,
      zeroIncomeDays,
      missingDataDays,
      sampleCompletenessPct,
      totalGrossEarningsPaise: totalGrossPaise,
      avgDailyEarningsPaise,
      calendarAvgDailyEarningsPaise,
      medianDailyEarningsPaise,
      volatilityPaise,
      volatilityCoefficient,
      volatilityTier,
      payoutFrequencyDays,
      payoutsCount,
      recentTrend: {
        firstHalfAvgPaise,
        secondHalfAvgPaise,
        changePct,
        trend,
        explanation,
      },
      outstandingLoanBalancePaise,
      totalRepaymentsPaise,
      repaymentToEarningsRatioPct,
      totalDebitAttempts,
      successfulDebitsCount,
      failedDebitsCount,
      debitSuccessRatePct,
      debitFailureRatePct,
      dailySeries,
    };
  }

  /**
   * Transparent Rules-Based Risk Assessment Engine.
   * Explicitly avoids opaque AI scores and sensitive personal attributes.
   * Displays INSUFFICIENT_DATA status for workers with < 10 active days.
   */
  async evaluateRulesBasedRisk(
    workerId: string,
    windowDays: 30 | 60 = 30
  ): Promise<TransparentRiskAssessment> {
    const analytics = await this.calculateWorkerAnalytics(workerId, windowDays);
    const MIN_SAMPLE_SIZE = 10;
    const indicators: RiskIndicator[] = [];

    // Check Rule 0: Sample Sufficiency
    if (analytics.activeEarningDays < MIN_SAMPLE_SIZE) {
      indicators.push({
        indicator: 'SAMPLE_SUFFICIENCY',
        name: 'Earnings Sample Size',
        measuredValue: `${analytics.activeEarningDays} active days in ${windowDays}d window`,
        benchmark: `Minimum ${MIN_SAMPLE_SIZE} active days required`,
        level: 'INSUFFICIENT_DATA',
        scoreImpact: 0,
        contributingFactors: `Insufficient earnings history: Worker has only ${analytics.activeEarningDays} recorded active days. Full underwriting requires minimum ${MIN_SAMPLE_SIZE} days of continuous gig history.`,
      });

      return {
        workerId: analytics.workerId,
        pseudonymId: analytics.pseudonymId,
        evaluatedAt: new Date().toISOString(),
        dataWindowDays: windowDays,
        sampleSizeDays: analytics.activeEarningDays,
        status: 'INSUFFICIENT_DATA',
        riskCategory: 'INSUFFICIENT_DATA',
        indicators,
        underwritingRecommendation: {
          recommendedCreditLimitPaise: 200000, // ₹2,000 starter micro-limit
          recommendedDeductionRateBps: 500,
          recommendedDailyCapPaise: 15000,
          rationale: `Insufficient earnings history (${analytics.activeEarningDays} days). Recommend starter tier or deferring credit until 10+ days of earnings are established.`,
        },
        methodologyAndAssumptions: {
          rulesEngineType: 'TRANSPARENT_DETERMINISTIC_RULES',
          windowDays,
          sampleSizeActiveDays: analytics.activeEarningDays,
          minSampleSizeRequired: MIN_SAMPLE_SIZE,
          assumptions: [
            'Evaluates single-platform primary payout streams only.',
            'Assumes worker is actively registered on gig dispatch platform.',
            'Does not ingest personal attributes (age, gender, location, religion).',
          ],
          regulatoryDisclaimer:
            'This transparent rules-based assessment is based solely on recorded gig cash flow and debit success. It does not predict general creditworthiness or guarantee against loan default. It is not an automated AI decision.',
        },
      };
    }

    // 1. Indicator: Earnings Volatility (CV)
    let volLevel: RiskIndicator['level'] = 'POSITIVE';
    let volImpact = 25;
    if (analytics.volatilityCoefficient > 0.55) {
      volLevel = 'CAUTION';
      volImpact = -15;
    } else if (analytics.volatilityCoefficient > 0.30) {
      volLevel = 'NEUTRAL';
      volImpact = 10;
    }

    indicators.push({
      indicator: 'EARNINGS_VOLATILITY',
      name: 'Cash-Flow Volatility (CV)',
      measuredValue: `CV: ${analytics.volatilityCoefficient} (σ: ₹${(analytics.volatilityPaise / 100).toFixed(0)})`,
      benchmark: 'Low: ≤ 0.30 | Moderate: 0.31-0.55 | High: > 0.55',
      level: volLevel,
      scoreImpact: volImpact,
      contributingFactors: volLevel === 'POSITIVE'
        ? 'Earnings demonstrate strong day-to-day stability with minimal dispersion.'
        : volLevel === 'NEUTRAL'
        ? 'Moderate day-to-day fluctuation in daily delivery earnings.'
        : 'High volatility in earnings: large swings between peak weekend orders and off-peak days.',
    });

    // 2. Indicator: Recent Earnings Trend
    let trendLevel: RiskIndicator['level'] = 'POSITIVE';
    let trendImpact = 20;
    if (analytics.recentTrend.trend === 'FALLING') {
      trendLevel = 'CAUTION';
      trendImpact = -15;
    } else if (analytics.recentTrend.trend === 'STABLE') {
      trendLevel = 'NEUTRAL';
      trendImpact = 10;
    }

    indicators.push({
      indicator: 'EARNINGS_TREND',
      name: 'Recent Income Momentum',
      measuredValue: `${analytics.recentTrend.changePct >= 0 ? '+' : ''}${analytics.recentTrend.changePct}% (${analytics.recentTrend.trend})`,
      benchmark: 'Rising: > +5% | Stable: -5% to +5% | Falling: < -5%',
      level: trendLevel,
      scoreImpact: trendImpact,
      contributingFactors: analytics.recentTrend.explanation,
    });

    // 3. Indicator: AutoPay Debit Success Rate
    let debitLevel: RiskIndicator['level'] = 'POSITIVE';
    let debitImpact = 30;
    if (analytics.debitSuccessRatePct < 75.0) {
      debitLevel = 'CAUTION';
      debitImpact = -25;
    } else if (analytics.debitSuccessRatePct < 90.0) {
      debitLevel = 'NEUTRAL';
      debitImpact = 15;
    }

    indicators.push({
      indicator: 'DEBIT_SUCCESS_RATE',
      name: 'UPI AutoPay Debit Reliability',
      measuredValue: `${analytics.debitSuccessRatePct}% (${analytics.successfulDebitsCount}/${analytics.totalDebitAttempts} debits)`,
      benchmark: 'Excellent: ≥ 90% | Moderate: 75-89% | Caution: < 75%',
      level: debitLevel,
      scoreImpact: debitImpact,
      contributingFactors: analytics.failedDebitsCount === 0
        ? '100% debit success rate with zero insufficient-funds occurrences.'
        : `${analytics.failedDebitsCount} failed or timeout debit attempt(s) recorded in window.`,
    });

    // 4. Indicator: Repayment-to-Earnings Ratio
    let repLevel: RiskIndicator['level'] = 'POSITIVE';
    let repImpact = 20;
    if (analytics.repaymentToEarningsRatioPct > 20.0) {
      repLevel = 'CAUTION';
      repImpact = -20;
    } else if (analytics.repaymentToEarningsRatioPct > 10.0) {
      repLevel = 'NEUTRAL';
      repImpact = 10;
    }

    indicators.push({
      indicator: 'REPAYMENT_BURDEN',
      name: 'Debt Service-to-Earnings Ratio',
      measuredValue: `${analytics.repaymentToEarningsRatioPct}% of gross income`,
      benchmark: 'Healthy: ≤ 10% | Moderate: 10.1-20% | Stressed: > 20%',
      level: repLevel,
      scoreImpact: repImpact,
      contributingFactors: `Total repayments of ₹${(analytics.totalRepaymentsPaise / 100).toFixed(0)} against ₹${(analytics.totalGrossEarningsPaise / 100).toFixed(0)} gross earnings.`,
    });

    // 5. Indicator: Data Completeness & Consistency
    let compLevel: RiskIndicator['level'] = 'POSITIVE';
    let compImpact = 15;
    if (analytics.sampleCompletenessPct < 60.0) {
      compLevel = 'CAUTION';
      compImpact = -10;
    } else if (analytics.sampleCompletenessPct < 80.0) {
      compLevel = 'NEUTRAL';
      compImpact = 5;
    }

    indicators.push({
      indicator: 'DATA_COMPLETENESS',
      name: 'Data Completeness & Zero Days',
      measuredValue: `${analytics.sampleCompletenessPct}% (${analytics.activeEarningDays} active, ${analytics.zeroIncomeDays} zero, ${analytics.missingDataDays} missing)`,
      benchmark: 'Good: ≥ 80% | Moderate: 60-79% | Low: < 60%',
      level: compLevel,
      scoreImpact: compImpact,
      contributingFactors: `Distinguishes ${analytics.zeroIncomeDays} genuine zero-earning days from ${analytics.missingDataDays} days with unsubmitted platform records.`,
    });

    // Overall Risk Classification
    const cautionCount = indicators.filter((i) => i.level === 'CAUTION').length;
    let riskCategory: TransparentRiskAssessment['riskCategory'] = 'LOW_RISK';
    if (cautionCount >= 2) riskCategory = 'ELEVATED_RISK';
    else if (cautionCount === 1) riskCategory = 'MODERATE_RISK';

    // Underwriting Recommendations
    const multiplier = riskCategory === 'LOW_RISK' ? 18 : riskCategory === 'MODERATE_RISK' ? 12 : 8;
    const recommendedLimit = Math.min(3000000, Math.max(500000, Math.round(analytics.avgDailyEarningsPaise * multiplier)));
    const recommendedRateBps = riskCategory === 'LOW_RISK' ? 500 : riskCategory === 'MODERATE_RISK' ? 600 : 750;
    const recommendedDailyCap = Math.round(analytics.avgDailyEarningsPaise * 0.25);

    return {
      workerId: analytics.workerId,
      pseudonymId: analytics.pseudonymId,
      evaluatedAt: new Date().toISOString(),
      dataWindowDays: windowDays,
      sampleSizeDays: analytics.activeEarningDays,
      status: 'EVALUATED',
      riskCategory,
      indicators,
      underwritingRecommendation: {
        recommendedCreditLimitPaise: recommendedLimit,
        recommendedDeductionRateBps: recommendedRateBps,
        recommendedDailyCapPaise: recommendedDailyCap,
        rationale: `Rules engine assigned ${riskCategory} based on ${analytics.activeEarningDays} active days, volatility CV of ${analytics.volatilityCoefficient}, and ${analytics.debitSuccessRatePct}% debit success rate.`,
      },
      methodologyAndAssumptions: {
        rulesEngineType: 'TRANSPARENT_DETERMINISTIC_RULES',
        windowDays,
        sampleSizeActiveDays: analytics.activeEarningDays,
        minSampleSizeRequired: MIN_SAMPLE_SIZE,
        assumptions: [
          'Evaluates single-platform primary payout streams only.',
          'Assumes worker is actively registered on gig dispatch platform.',
          'Does not ingest personal attributes (age, gender, location, religion).',
        ],
        regulatoryDisclaimer:
          'This transparent rules-based assessment is based solely on recorded gig cash flow and debit success. It does not predict general creditworthiness or guarantee against loan default. It is not an automated AI decision.',
      },
    };
  }
}

export const cashFlowAnalyticsService = new CashFlowAnalyticsService();
