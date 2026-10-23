import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/db.js';
import { seedDatabase } from '../src/db/seed.js';
import { cashFlowAnalyticsService } from '../src/services/cashflow-analytics.service.js';

describe('Cash-Flow Analytics & Transparent Rules-Based Risk Engine', () => {
  let app: any;
  let lenderToken: string;

  beforeEach(async () => {
    await db.init();
    await seedDatabase(true); // force fresh seed
    const appInstance = createApp();
    app = appInstance.app;

    // Login as lender
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'underwriting@kotakmicro.in',
        password: 'Password123!',
      });
    lenderToken = loginRes.body.token;
  });

  describe('Rolling 30-Day and 60-Day Calculations', () => {
    it('calculates 30-day metrics and clearly distinguishes missing data from genuine zero-income days', async () => {
      const res30 = await cashFlowAnalyticsService.calculateWorkerAnalytics('wrk_ravi_01', 30);

      expect(res30.windowDays).toBe(30);
      expect(res30.activeEarningDays).toBeGreaterThan(20);
      expect(res30.zeroIncomeDays).toBeGreaterThanOrEqual(1);
      expect(res30.missingDataDays).toBeGreaterThanOrEqual(1);
      // Total days in dailySeries must equal exactly windowDays
      expect(res30.dailySeries.length).toBe(30);
      expect(res30.activeEarningDays + res30.zeroIncomeDays + res30.missingDataDays).toBe(30);

      // Verify series statuses
      const activeCount = res30.dailySeries.filter((d) => d.status === 'ACTIVE_EARNING').length;
      const zeroCount = res30.dailySeries.filter((d) => d.status === 'ZERO_INCOME').length;
      const missingCount = res30.dailySeries.filter((d) => d.status === 'MISSING_DATA').length;

      expect(activeCount).toBe(res30.activeEarningDays);
      expect(zeroCount).toBe(res30.zeroIncomeDays);
      expect(missingCount).toBe(res30.missingDataDays);
    });

    it('calculates 60-day metrics with higher sample size', async () => {
      const res60 = await cashFlowAnalyticsService.calculateWorkerAnalytics('wrk_ravi_01', 60);

      expect(res60.windowDays).toBe(60);
      expect(res60.dailySeries.length).toBe(60);
      expect(res60.activeEarningDays + res60.zeroIncomeDays + res60.missingDataDays).toBe(60);
      expect(res60.totalGrossEarningsPaise).toBeGreaterThan(res60.avgDailyEarningsPaise * 40);
    });

    it('computes average, median, volatility, and payout frequency correctly', async () => {
      const analytics = await cashFlowAnalyticsService.calculateWorkerAnalytics('wrk_ravi_01', 30);

      // Average daily earnings
      expect(analytics.avgDailyEarningsPaise).toBeGreaterThan(100000); // > ₹1,000
      expect(analytics.calendarAvgDailyEarningsPaise).toBeLessThanOrEqual(analytics.avgDailyEarningsPaise);

      // Median daily earnings
      expect(analytics.medianDailyEarningsPaise).toBeGreaterThan(100000);

      // Volatility (standard deviation and CV)
      expect(analytics.volatilityPaise).toBeGreaterThan(0);
      expect(analytics.volatilityCoefficient).toBeGreaterThan(0);
      expect(['LOW', 'MODERATE', 'HIGH']).toContain(analytics.volatilityTier);

      // Payout frequency
      expect(analytics.payoutsCount).toBe(analytics.activeEarningDays);
      expect(analytics.payoutFrequencyDays).toBeGreaterThan(0);
      expect(analytics.payoutFrequencyDays).toBeLessThanOrEqual(30);

      // Recent trend
      expect(['RISING', 'STABLE', 'FALLING']).toContain(analytics.recentTrend.trend);
      expect(typeof analytics.recentTrend.changePct).toBe('number');
      expect(analytics.recentTrend.explanation).toBeDefined();
    });

    it('computes outstanding balance, repayment ratio, and debit success/failure rates', async () => {
      const analytics = await cashFlowAnalyticsService.calculateWorkerAnalytics('wrk_ravi_01', 30);

      expect(analytics.outstandingLoanBalancePaise).toBeGreaterThan(0);
      expect(analytics.totalRepaymentsPaise).toBeGreaterThan(0);
      expect(analytics.repaymentToEarningsRatioPct).toBeGreaterThan(0);
      expect(analytics.repaymentToEarningsRatioPct).toBeLessThan(50); // reasonable deduction %

      // Debit analytics
      expect(analytics.totalDebitAttempts).toBeGreaterThan(0);
      expect(analytics.successfulDebitsCount).toBeGreaterThan(0);
      expect(analytics.debitSuccessRatePct).toBeGreaterThan(80);
      expect(analytics.debitSuccessRatePct + analytics.debitFailureRatePct).toBeCloseTo(100, 0);
    });
  });

  describe('Transparent Rules-Based Risk Engine', () => {
    it('evaluates steady earner (Ravi) with positive risk indicators and transparent explanations', async () => {
      const assessment = await cashFlowAnalyticsService.evaluateRulesBasedRisk('wrk_ravi_01', 30);

      expect(assessment.status).toBe('EVALUATED');
      expect(['LOW_RISK', 'MODERATE_RISK']).toContain(assessment.riskCategory);
      expect(assessment.sampleSizeDays).toBeGreaterThanOrEqual(10);

      // Check indicators
      const indicatorKeys = assessment.indicators.map((i) => i.indicator);
      expect(indicatorKeys).toContain('EARNINGS_VOLATILITY');
      expect(indicatorKeys).toContain('EARNINGS_TREND');
      expect(indicatorKeys).toContain('DEBIT_SUCCESS_RATE');
      expect(indicatorKeys).toContain('REPAYMENT_BURDEN');
      expect(indicatorKeys).toContain('DATA_COMPLETENESS');

      // Verify each indicator has benchmark, contributing factors, and measured value
      for (const ind of assessment.indicators) {
        expect(ind.measuredValue).toBeDefined();
        expect(ind.benchmark).toBeDefined();
        expect(ind.contributingFactors.length).toBeGreaterThan(10);
      }

      // Verify regulatory disclaimer and assumptions
      expect(assessment.methodologyAndAssumptions.rulesEngineType).toBe('TRANSPARENT_DETERMINISTIC_RULES');
      expect(assessment.methodologyAndAssumptions.regulatoryDisclaimer).toContain('transparent rules-based');
      expect(assessment.methodologyAndAssumptions.regulatoryDisclaimer).toContain('not an automated AI decision');
    });

    it('identifies volatile earner (Arif) with elevated volatility indicator', async () => {
      const assessment = await cashFlowAnalyticsService.evaluateRulesBasedRisk('wrk_arif_03', 30);

      expect(assessment.status).toBe('EVALUATED');
      const volIndicator = assessment.indicators.find((i) => i.indicator === 'EARNINGS_VOLATILITY');
      expect(volIndicator).toBeDefined();
      expect(['MODERATE', 'CAUTION']).toContain(volIndicator?.level);
    });

    it('displays INSUFFICIENT_DATA status for new worker with small history (Vikram)', async () => {
      const assessment = await cashFlowAnalyticsService.evaluateRulesBasedRisk('wrk_vikram_05', 30);

      expect(assessment.status).toBe('INSUFFICIENT_DATA');
      expect(assessment.riskCategory).toBe('INSUFFICIENT_DATA');
      expect(assessment.sampleSizeDays).toBeLessThan(10);

      const sampleInd = assessment.indicators.find((i) => i.indicator === 'SAMPLE_SUFFICIENCY');
      expect(sampleInd).toBeDefined();
      expect(sampleInd?.level).toBe('INSUFFICIENT_DATA');
      expect(sampleInd?.contributingFactors).toContain('Insufficient earnings history');

      // Recommended credit limit is capped/conservative
      expect(assessment.underwritingRecommendation.recommendedCreditLimitPaise).toBeLessThanOrEqual(500000); // <= ₹5,000
    });
  });

  describe('Privacy, Pseudonymization & Consent Enforcement', () => {
    it('uses pseudonymous worker IDs and masks PII on lender underwriting route', async () => {
      const res = await request(app)
        .get('/api/lender/workers/wrk_ravi_01/risk?window=30')
        .set('Authorization', `Bearer ${lenderToken}`)
        .expect(200);

      expect(res.body.worker.pseudonymId).toMatch(/^[A-Z]{3}-WRK-[0-9A-F]{4}$/);
      expect(res.body.worker.phoneMasked).toContain('******');
      expect(res.body.worker.email).toBeUndefined(); // PII redacted
      expect(res.body.analytics).toBeDefined();
      expect(res.body.riskAssessment).toBeDefined();
      expect(res.body.loans).toBeDefined();
      expect(res.body.recentDebits).toBeDefined();
    });

    it('enforces consent and rejects lender risk query when worker has not granted consent', async () => {
      // Vikram has no consent granted in seed data
      const res = await request(app)
        .get('/api/lender/workers/wrk_vikram_05/risk')
        .set('Authorization', `Bearer ${lenderToken}`)
        .expect(403);

      expect(res.body.code).toBe('CONSENT_REQUIRED');
      expect(res.body.error).toContain('Access Denied');
      expect(res.body.pseudonymId).toBeDefined();
    });

    it('GET /api/lender/portfolio returns aggregate repayment progress, debit analytics, and earnings trends', async () => {
      const res = await request(app)
        .get('/api/lender/portfolio')
        .set('Authorization', `Bearer ${lenderToken}`)
        .expect(200);

      expect(res.body.totalPrincipalPaise).toBeGreaterThan(0);
      expect(res.body.totalOutstandingPaise).toBeGreaterThan(0);
      expect(res.body.totalRepaidPaise).toBeGreaterThan(0);
      expect(res.body.repaymentProgressPct).toBeGreaterThan(0);

      expect(res.body.debitAnalytics.totalDebits).toBeGreaterThan(0);
      expect(res.body.debitAnalytics.debitSuccessRatePct).toBeGreaterThan(50);
      expect(res.body.portfolioEarningsTrend.length).toBeGreaterThan(0);
    });

    it('GET /api/lender/workers supports search and platform/tier filtering with pseudonyms', async () => {
      const res = await request(app)
        .get('/api/lender/workers?platform=ZOMATO')
        .set('Authorization', `Bearer ${lenderToken}`)
        .expect(200);

      expect(res.body.workers.length).toBeGreaterThanOrEqual(1);
      for (const w of res.body.workers) {
        expect(w.primaryPlatform).toBe('ZOMATO');
        expect(w.pseudonymId).toBeDefined();
      }
    });
  });
});
