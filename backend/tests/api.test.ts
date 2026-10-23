import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { inMemoryStore } from '../src/db/in-memory-store.js';

describe('MicroStream Backend API Integration Tests', () => {
  const { app } = createApp();

  beforeEach(() => {
    inMemoryStore.reset();
  });

  it('GET /api/health reports system status and active mock adapters', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.adapters.ledger.isMock).toBe(true);
    expect(res.body.adapters.payment.isMock).toBe(true);
    expect(res.body.currencyRepresentation).toContain('Integer paise');
  });

  it('GET /api/workers returns synthetic seed gig workers', async () => {
    const res = await request(app).get('/api/workers');
    expect(res.status).toBe(200);
    expect(res.body.workers.length).toBeGreaterThanOrEqual(5);

    const ravi = res.body.workers.find((w: any) => w.did === 'did:drunix:worker:ravi-kumar-01');
    expect(ravi).toBeDefined();
    expect(ravi.primaryPlatform).toBe('ZOMATO');
    expect(ravi.vpa).toBe('ravi.kumar@oksbi');
  });

  it('GET /api/workers/:did returns profile, earnings summary, and active loan', async () => {
    const res = await request(app).get('/api/workers/did:drunix:worker:ravi-kumar-01');
    expect(res.status).toBe(200);
    expect(res.body.worker.name).toBe('Ravi Kumar');
    expect(res.body.activeLoan.loanId).toBe('LN-2026-001');
    expect(res.body.mandate.status).toBe('ACTIVE');
    expect(res.body.earningsSummary.activeDaysCount).toBeGreaterThan(0);
  });

  it('POST /api/payouts/simulate runs complete real-time deduction streaming loop', async () => {
    // Before simulation, check initial loan balance
    const loanBefore = inMemoryStore.loans.get('LN-2026-001');
    expect(loanBefore).toBeDefined();
    const initialBalance = loanBefore!.outstandingBalancePaise;

    // Simulate daily payout of ₹1,000 (100,000 paise)
    // Deduction rate is 5% (500 bps) -> Expected deduction = 5,000 paise (₹50)
    const payoutRes = await request(app)
      .post('/api/payouts/simulate')
      .send({
        did: 'did:drunix:worker:ravi-kumar-01',
        platformId: 'zomato-in',
        amountPaise: 100000,
        reference: 'TEST-PAYOUT-001',
      });

    expect(payoutRes.status).toBe(200);
    expect(payoutRes.body.hasActiveLoan).toBe(true);
    expect(payoutRes.body.deductionCalculatedPaise).toBe(5000); // ₹50
    expect(payoutRes.body.debitResult.success).toBe(true);
    expect(payoutRes.body.debitResult.amountDebitedPaise).toBe(5000);
    expect(payoutRes.body.debitResult.upiRef).toMatch(/^UPI\/\d{8}\/\d{10}$/);

    // Verify loan balance was deducted on ledger
    const loanAfter = inMemoryStore.loans.get('LN-2026-001');
    expect(loanAfter!.outstandingBalancePaise).toBe(initialBalance - 5000);
    expect(loanAfter!.totalRepaidPaise).toBe(loanBefore!.totalRepaidPaise + 5000);

    // Verify repayment record was stored
    expect(payoutRes.body.repayment).toBeDefined();
    expect(payoutRes.body.repayment.amountPaise).toBe(5000);
    expect(payoutRes.body.repayment.newOutstandingBalancePaise).toBe(initialBalance - 5000);
  });

  it('GET /api/analytics/portfolio returns aggregate loan statistics', async () => {
    const res = await request(app).get('/api/analytics/portfolio');
    expect(res.status).toBe(200);
    expect(res.body.totalPrincipalPaise).toBeGreaterThan(0);
    expect(res.body.activeLoansCount).toBeGreaterThan(0);
    expect(res.body.repaymentProgressPct).toBeGreaterThan(0);
  });

  it('GET /api/analytics/risk returns cash-flow underwriting profiles', async () => {
    const res = await request(app).get('/api/analytics/risk');
    expect(res.status).toBe(200);
    expect(res.body.profiles.length).toBeGreaterThanOrEqual(5);

    const first = res.body.profiles[0];
    expect(first.avgDailyGrossPaise).toBeGreaterThan(0);
    expect(first.recommendedCreditLimitPaise).toBeGreaterThan(0);
  });
});
