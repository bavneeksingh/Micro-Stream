import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/db.js';

describe('MicroStream PostgreSQL Backend API Tests', () => {
  const { app } = createApp();

  let workerToken: string;
  let workerUserId: string;
  let workerId: string;
  let lenderToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Initialize schema and seed database
    await db.init();
  });

  // 1. Health Endpoint
  it('GET /api/health reports system status, database engine, and adapters', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.database).toBeDefined();
    expect(res.body.currencyRepresentation).toContain('Integer paise');
  });

  // 2. Authentication: Login
  it('POST /api/auth/login logs in demo worker with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ravi.kumar@zomato-partner.in',
        password: 'Password123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('WORKER');
    expect(res.body.user.workerId).toBe('wrk_ravi_01');

    workerToken = res.body.token;
    workerUserId = res.body.user.id;
    workerId = res.body.user.workerId;
  });

  it('POST /api/auth/login rejects invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ravi.kumar@zomato-partner.in',
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /api/auth/login logs in lender and admin accounts', async () => {
    const lenderRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'underwriting@kotakmicro.in',
        password: 'Password123!',
      });
    expect(lenderRes.status).toBe(200);
    expect(lenderRes.body.user.role).toBe('LENDER');
    lenderToken = lenderRes.body.token;

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'auditor@npci.org.in',
        password: 'Password123!',
      });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.user.role).toBe('ADMIN');
    adminToken = adminRes.body.token;
  });

  // 3. Auth Me
  it('GET /api/auth/me returns current authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ravi.kumar@zomato-partner.in');
    expect(res.body.worker).toBeDefined();
    expect(res.body.worker.id).toBe(workerId);
  });

  // 4. Worker Self Endpoints
  it('GET /api/workers/me returns worker profile, active loan, and mandate', async () => {
    const res = await request(app)
      .get('/api/workers/me')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.worker.name).toBe('Ravi Kumar');
    expect(res.body.activeLoan).toBeDefined();
    expect(res.body.activeLoan.id).toBe('LN-2026-001');
    expect(res.body.activeMandate.id).toBe('mnd_ravi_01');
    expect(res.body.earningsSummary.activeDaysCount).toBeGreaterThan(0);
  });

  it('GET /api/workers/me/earnings returns paginated earnings records', async () => {
    const res = await request(app)
      .get('/api/workers/me/earnings?page=1&limit=5&sortOrder=DESC')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(14);
    expect(res.body.data[0].gross_earnings_paise).toBeGreaterThan(0);
  });

  it('GET /api/workers/me/loans returns worker loans list', async () => {
    const res = await request(app)
      .get('/api/workers/me/loans')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.loans.length).toBeGreaterThanOrEqual(1);
    expect(res.body.loans[0].worker_id).toBe(workerId);
  });

  it('GET /api/workers/me/repayments returns repayment history', async () => {
    const res = await request(app)
      .get('/api/workers/me/repayments')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);
    expect(res.body.data[0].upi_ref).toContain('UPI/');
  });

  // 5. Consent Management
  it('POST /api/consents grants new data access consent', async () => {
    const res = await request(app)
      .post('/api/consents')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        grantee: 'HDFC Micro-Finance',
        scope: ['EARNINGS_READ', 'CREDIT_ASSESSMENT'],
        purpose: 'Assessment for working capital credit line',
      });

    expect(res.status).toBe(201);
    expect(res.body.grantee).toBe('HDFC Micro-Finance');
    expect(res.body.status).toBe('ACTIVE');

    // Revoke the consent
    const deleteRes = await request(app)
      .delete(`/api/consents/${res.body.id}`)
      .set('Authorization', `Bearer ${workerToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.consent.status).toBe('REVOKED');
  });

  // 6. Loan Application & Lender Approval Workflow
  it('POST /api/loans/apply allows worker to apply, and POST /api/loans/:loanId/approve allows lender to approve', async () => {
    // Log in as Worker Priya (who has active mandate and no active loan in seed data)
    const priyaLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'priya.salon@urbancompany.in',
        password: 'Password123!',
      });
    expect(priyaLogin.status).toBe(200);
    const priyaToken = priyaLogin.body.token;

    // Apply for micro-loan of ₹12,000 (1,200,000 paise)
    const applyRes = await request(app)
      .post('/api/loans/apply')
      .set('Authorization', `Bearer ${priyaToken}`)
      .send({
        amountRupees: 12000,
        deductionRatePct: 6,
        dailyCapRupees: 250,
        purpose: 'Professional Salon Kit Equipment',
      });

    expect(applyRes.status).toBe(201);
    expect(applyRes.body.status).toBe('PENDING_APPROVAL');
    expect(applyRes.body.principal_paise).toBe(1200000);
    const newLoanId = applyRes.body.id;

    // Unauthorized check: Worker cannot approve their own loan
    const workerApproveRes = await request(app)
      .post(`/api/loans/${newLoanId}/approve`)
      .set('Authorization', `Bearer ${priyaToken}`);
    expect(workerApproveRes.status).toBe(403);

    // Authorized check: Lender approves the loan
    const lenderApproveRes = await request(app)
      .post(`/api/loans/${newLoanId}/approve`)
      .set('Authorization', `Bearer ${lenderToken}`);
    expect(lenderApproveRes.status).toBe(200);
    expect(lenderApproveRes.body.loan.status).toBe('ACTIVE');
  });

  // 7. Duplicate Reference Constraint Check
  it('POST /api/simulator/payouts rejects duplicate payout reference with conflict', async () => {
    const uniqueRef = `DUP-TEST-${Date.now()}`;
    const res1 = await request(app)
      .post('/api/simulator/payouts')
      .send({
        workerId,
        platformId: 'zomato-in',
        amountPaise: 50000,
        reference: uniqueRef,
      });
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post('/api/simulator/payouts')
      .send({
        workerId,
        platformId: 'zomato-in',
        amountPaise: 50000,
        reference: uniqueRef,
      });
    expect(res2.status).toBe(409);
    expect(res2.body.code).toBe('DUPLICATE_KEY');
  });

  // 6. Lender Portfolio & Risk Assessment
  it('GET /api/lender/portfolio returns aggregate loan statistics (Lender authorized)', async () => {
    const res = await request(app)
      .get('/api/lender/portfolio')
      .set('Authorization', `Bearer ${lenderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalPrincipalPaise).toBeGreaterThan(0);
    expect(res.body.activeLoansCount).toBeGreaterThan(0);
    expect(res.body.repaymentProgressPct).toBeGreaterThan(0);
  });

  it('GET /api/lender/portfolio forbids unauthorized worker access', async () => {
    const res = await request(app)
      .get('/api/lender/portfolio')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('GET /api/lender/workers/:workerId/risk enforces consent verification', async () => {
    // Ravi Kumar has active consent in seed data -> returns underwriting
    const res = await request(app)
      .get(`/api/lender/workers/${workerId}/risk`)
      .set('Authorization', `Bearer ${lenderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.worker.name).toBe('Ravi Kumar');
    expect(res.body.underwriting.avgDailyGrossPaise).toBeGreaterThan(0);
    expect(res.body.underwriting.recommendedCreditLimitPaise).toBeGreaterThan(0);
  });

  // 7. Transactional Real-Time Streaming Payout Simulator
  it('POST /api/simulator/payouts executes transactional real-time deduction streaming loop', async () => {
    // Check initial balance
    const workerRes = await request(app)
      .get('/api/workers/me')
      .set('Authorization', `Bearer ${workerToken}`);
    const initialBalance = workerRes.body.activeLoan.outstanding_balance_paise;

    // Simulate daily payout of ₹1,200 (120,000 paise)
    // 5% deduction -> 6,000 paise (₹60.00)
    const payoutRes = await request(app)
      .post('/api/simulator/payouts')
      .send({
        workerId,
        platformId: 'zomato-in',
        amountPaise: 120000,
        reference: `TEST-PAYOUT-${Date.now()}`,
      });

    expect(payoutRes.status).toBe(200);
    expect(payoutRes.body.hasActiveLoan).toBe(true);
    expect(payoutRes.body.deductionCalculatedPaise).toBe(6000);
    expect(payoutRes.body.debitResult.success).toBe(true);
    expect(payoutRes.body.debitResult.upiRef).toMatch(/^UPI\/\d{8}\/\d{10}$/);

    // Verify balance was reduced in PostgreSQL
    const updatedWorkerRes = await request(app)
      .get('/api/workers/me')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(updatedWorkerRes.body.activeLoan.outstanding_balance_paise).toBe(initialBalance - 6000);

    // Verify repayment record exists
    expect(payoutRes.body.repayment.amountPaise).toBe(6000);
  });

  // 8. Payouts list & Audit trail
  it('GET /api/payouts returns recorded payout events', async () => {
    const res = await request(app).get('/api/payouts?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.payouts.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/audit returns structured immutable audit logs', async () => {
    const res = await request(app)
      .get('/api/audit?limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThan(0);
    expect(res.body.events.some((e: any) => e.action.includes('STREAMING_DEDUCTION') || e.action.includes('USER_LOGIN'))).toBe(true);
  });

  // 9. Input Validation with Zod
  it('POST /api/simulator/payouts rejects invalid input schema', async () => {
    const res = await request(app)
      .post('/api/simulator/payouts')
      .send({
        amountPaise: -500, // Invalid negative amount
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  // 10. Logout
  it('POST /api/auth/logout logs out session', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Successfully logged out.');
  });
});
