import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/db.js';

describe('Deterministic Repayment Engine Automated Test Suite', () => {
  const { app } = createApp();

  let workerToken: string;
  let workerId: string;
  let testLoanId: string;

  beforeAll(async () => {
    await db.init();

    // Log in as Ravi Kumar
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ravi.kumar@zomato-partner.in',
        password: 'Password123!',
      });
    expect(loginRes.status).toBe(200);
    workerToken = loginRes.body.token;
    workerId = loginRes.body.user.workerId;
  });

  // TEST CASE 1: ₹1,000 payout at 5% produces ₹50
  it('REQUIRED: ₹1,000 payout at 5% produces ₹50', async () => {
    const payoutPaise = 100000; // ₹1,000
    const ref = `TEST-CASE-1-${Date.now()}`;

    const res = await request(app)
      .post('/api/simulator/payouts')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        workerId,
        platformId: 'zomato-in',
        amountPaise: payoutPaise,
        reference: ref,
        autoConfirm: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.hasActiveLoan).toBe(true);
    // 5% of 100,000 paise = 5,000 paise = ₹50
    expect(res.body.deductionCalculatedPaise).toBe(5000);
    expect(res.body.debitInstruction.status).toBe('SUCCEEDED');
    expect(res.body.payoutStatus).toBe('PROCESSED');
    expect(res.body.repayment.amountPaise).toBe(5000);
  });

  // TEST CASE 2: ₹300 payout at 5% produces ₹15
  it('REQUIRED: ₹300 payout at 5% produces ₹15', async () => {
    const payoutPaise = 30000; // ₹300
    const ref = `TEST-CASE-2-${Date.now()}`;

    const res = await request(app)
      .post('/api/simulator/payouts')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        workerId,
        platformId: 'zomato-in',
        amountPaise: payoutPaise,
        reference: ref,
        autoConfirm: true,
      });

    expect(res.status).toBe(200);
    // 5% of 30,000 paise = 1,500 paise = ₹15
    expect(res.body.deductionCalculatedPaise).toBe(1500);
    expect(res.body.repayment.amountPaise).toBe(1500);
  });

  // TEST CASE 3: Zero payout produces zero deduction
  it('REQUIRED: Zero payout produces zero deduction', async () => {
    const ref = `TEST-CASE-3-${Date.now()}`;

    const res = await request(app)
      .post('/api/simulator/payouts')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        workerId,
        platformId: 'zomato-in',
        amountPaise: 0,
        reference: ref,
      });

    expect(res.status).toBe(200);
    expect(res.body.deductionCalculatedPaise).toBe(0);
    expect(res.body.repayment).toBeUndefined();
    expect(res.body.message).toContain('Zero deduction');
  });

  // TEST CASE 4: Deduction never exceeds outstanding principal or configured cap
  it('REQUIRED: Deduction never exceeds outstanding principal or configured cap', async () => {
    // Set Sunita's loan balance to small balance of ₹20.00 (2,000 paise)
    await db.query(
      `UPDATE loans SET outstanding_balance_paise = 2000 WHERE id = 'LN-2026-002'`
    );

    // ₹1,000 payout at 6% would be ₹60 (6,000 paise), but outstanding is only ₹20 (2,000 paise)
    const ref = `TEST-CASE-4-BAL-${Date.now()}`;
    const res = await request(app)
      .post('/api/simulator/payouts')
      .send({
        workerId: 'wrk_sunita_02',
        platformId: 'swiggy-in',
        amountPaise: 100000, // ₹1,000
        reference: ref,
        autoConfirm: true,
      });

    expect(res.status).toBe(200);
    // Deduction must be capped at exactly ₹20 (2,000 paise)
    expect(res.body.deductionCalculatedPaise).toBe(2000);
    expect(res.body.repayment.amountPaise).toBe(2000);
    expect(res.body.loanState.outstandingBalancePaise).toBe(0);
    // Loan reaches 0 balance and closes at PAID
    expect(res.body.loanState.status).toBe('PAID');
  });

  // TEST CASE 5: Duplicate payouts do not create duplicate instructions
  it('REQUIRED: Duplicate payouts do not create duplicate instructions', async () => {
    const fixedRef = `DUP-PAYOUT-REF-${Date.now()}`;

    // First call
    const res1 = await request(app)
      .post('/api/simulator/payouts')
      .send({
        workerId,
        platformId: 'zomato-in',
        amountPaise: 100000,
        reference: fixedRef,
        autoConfirm: true,
      });
    expect(res1.status).toBe(200);
    const initialInstructionId = res1.body.debitInstruction.id;

    // Second call with same reference
    const res2 = await request(app)
      .post('/api/simulator/payouts')
      .send({
        workerId,
        platformId: 'zomato-in',
        amountPaise: 100000,
        reference: fixedRef,
        autoConfirm: true,
      });

    expect(res2.status).toBe(200);
    expect(res2.body.message).toContain('Duplicate payout reference acknowledged safely');
    expect(res2.body.debitInstruction.id).toBe(initialInstructionId);

    // Verify in database that only ONE instruction exists for this payout
    const dbDebits = await db.query(
      `SELECT COUNT(*) as count FROM debit_instructions WHERE payout_event_id = $1`,
      [res1.body.payoutId]
    );
    expect(parseInt(dbDebits.rows[0].count, 10)).toBe(1);
  });

  // TEST CASE 6 & 11: Duplicate callbacks do not create duplicate repayments; invalid callback amounts rejected
  it('REQUIRED: Duplicate callbacks do not create duplicate repayments & invalid amounts rejected', async () => {
    // 1. Create a payout with autoConfirm = false to obtain a PENDING debit instruction
    const ref = `PENDING-FLOW-${Date.now()}`;
    const pendingRes = await request(app)
      .post('/api/simulator/payouts')
      .send({
        workerId,
        platformId: 'zomato-in',
        amountPaise: 100000, // 5% = 5,000 paise
        reference: ref,
        autoConfirm: false,
      });

    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.debitInstruction.status).toBe('PENDING');
    const instructionId = pendingRes.body.debitInstruction.id;
    const expectedAmount = pendingRes.body.debitInstruction.amountPaise;

    // Check pre-callback balance
    const workerResBefore = await request(app)
      .get('/api/workers/me')
      .set('Authorization', `Bearer ${workerToken}`);
    const balanceBefore = workerResBefore.body.activeLoan.outstanding_balance_paise;

    // 2. Reject mismatched callback amount
    const mismatchRes = await request(app)
      .post('/api/payments/callback')
      .send({
        instructionId,
        reference: ref,
        amountPaise: expectedAmount + 500, // Invalid mismatched amount
        success: true,
      });
    expect(mismatchRes.status).toBe(400);
    expect(mismatchRes.body.code).toBe('AMOUNT_MISMATCH');

    // 3. Confirm valid callback
    const validCallbackRes = await request(app)
      .post('/api/payments/callback')
      .send({
        instructionId,
        reference: ref,
        amountPaise: expectedAmount,
        success: true,
        upiRef: 'UPI/20261024/9998887771',
      });
    expect(validCallbackRes.status).toBe(200);
    expect(validCallbackRes.body.status).toBe('SUCCEEDED');
    expect(validCallbackRes.body.repaymentId).toBeDefined();

    // Verify balance was reduced
    const workerResAfter = await request(app)
      .get('/api/workers/me')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(workerResAfter.body.activeLoan.outstanding_balance_paise).toBe(balanceBefore - expectedAmount);

    // 4. Duplicate callback: Second confirmation of same instruction
    const duplicateCallbackRes = await request(app)
      .post('/api/payments/callback')
      .send({
        instructionId,
        reference: ref,
        amountPaise: expectedAmount,
        success: true,
      });
    expect(duplicateCallbackRes.status).toBe(200);
    expect(duplicateCallbackRes.body.message).toContain('Duplicate callback safely acknowledged');

    // Verify NO additional deduction was taken on duplicate callback
    const workerResFinal = await request(app)
      .get('/api/workers/me')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(workerResFinal.body.activeLoan.outstanding_balance_paise).toBe(balanceBefore - expectedAmount);
  });

  // TEST CASE 7: Failed payments never reduce the outstanding balance
  it('REQUIRED: Failed payments never reduce the outstanding balance and support bounded retries', async () => {
    // Fetch initial balance
    const workerRes = await request(app)
      .get('/api/workers/me')
      .set('Authorization', `Bearer ${workerToken}`);
    const balanceBefore = workerRes.body.activeLoan.outstanding_balance_paise;

    // Simulate failed payout (insufficient funds)
    const failRef = `FAIL-PAYOUT-${Date.now()}`;
    const failRes = await request(app)
      .post('/api/simulator/payouts')
      .send({
        workerId,
        platformId: 'zomato-in',
        amountPaise: 100000,
        reference: failRef,
        failureType: 'INSUFFICIENT_FUNDS',
      });

    expect(failRes.status).toBe(200);
    expect(failRes.body.debitInstruction.status).toBe('RETRY_PENDING');
    expect(failRes.body.debitInstruction.retryCount).toBe(1);
    const retryDeductionPaise = failRes.body.debitInstruction.amountPaise;

    // Verify outstanding balance was NOT changed!
    const workerResAfterFail = await request(app)
      .get('/api/workers/me')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(workerResAfterFail.body.activeLoan.outstanding_balance_paise).toBe(balanceBefore);

    // Test retry on RETRY_PENDING instruction
    const retryRes = await request(app)
      .post(`/api/debits/${failRes.body.debitInstruction.id}/retry`);
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.debitInstruction.status).toBe('SUCCEEDED');
    expect(retryRes.body.debitInstruction.retryCount).toBe(2);

    // Balance is only reduced AFTER successful retry confirmation
    const workerResAfterRetry = await request(app)
      .get('/api/workers/me')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(workerResAfterRetry.body.activeLoan.outstanding_balance_paise).toBe(balanceBefore - retryDeductionPaise);
  });

  // TEST CASE 8: Concurrent payouts cannot over-repay a loan
  it('REQUIRED: Concurrent payouts cannot over-repay a loan', async () => {
    // Set Arif's active loan (LN-2026-003) to exactly ₹40 (4,000 paise) remaining
    const loanId = 'LN-2026-003';
    await db.query(
      `UPDATE loans
       SET outstanding_balance_paise = 4000, total_repaid_paise = 0, status = 'ACTIVE'
       WHERE id = $1`,
      [loanId]
    );

    // Fire 5 concurrent payouts of ₹1,000 each (5% would be ₹50 each = 5 * ₹50 = ₹250)
    // But the loan only has ₹40 outstanding!
    const promises = Array.from({ length: 5 }, (_, idx) =>
      request(app)
        .post('/api/simulator/payouts')
        .send({
          workerId: 'wrk_arif_03',
          platformId: 'uber-in',
          amountPaise: 100000,
          reference: `CONCUR-REF-${Date.now()}-${idx}`,
          autoConfirm: true,
        })
    );

    const results = await Promise.all(promises);
    expect(results.every((r) => r.status === 200)).toBe(true);

    // Verify loan balance in database: must be exactly 0, never negative!
    const loanCheck = await db.query(`SELECT * FROM loans WHERE id = $1`, [loanId]);
    const finalLoan = loanCheck.rows[0];

    expect(finalLoan.outstanding_balance_paise).toBe(0);
    expect(finalLoan.total_repaid_paise).toBe(4000); // Exactly ₹40 total repaid, no over-repayment!
    expect(finalLoan.status).toBe('PAID');
  });

  // TEST CASE 10: The loan closes at zero balance
  it('REQUIRED: The loan closes at zero balance with status PAID', async () => {
    const loanId = `LN-CLOSE-${Date.now()}`;
    await db.query(
      `INSERT INTO loans (
         id, worker_id, lender_id, lender_name, principal_paise,
         outstanding_balance_paise, interest_rate_bps, deduction_rate_bps,
         daily_cap_paise, total_repaid_paise, status, purpose
       ) VALUES ($1, 'wrk_vikram_05', 'usr_lender_01', 'Kotak', 1000, 1000, 1200, 500, 50000, 0, 'ACTIVE', 'Closing Test')`,
      [loanId]
    );

    const res = await request(app)
      .post('/api/simulator/payouts')
      .send({
        workerId: 'wrk_vikram_05',
        platformId: 'zepto-in',
        amountPaise: 50000, // 5% = 2,500 paise, outstanding is 1,000 paise -> full payoff
        reference: `PAYOFF-${Date.now()}`,
        autoConfirm: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.loanState.outstandingBalancePaise).toBe(0);
    expect(res.body.loanState.status).toBe('PAID');
    expect(res.body.message).toContain('PAID in full');
  });

  // Transaction History Verification
  it('GET /api/transactions/history returns full lifecycle transaction history', async () => {
    const res = await request(app).get('/api/transactions/history?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.transactions.length).toBeGreaterThan(0);

    const tx = res.body.transactions[0];
    expect(tx.payout_id).toBeDefined();
    expect(tx.payout_status).toBeDefined();
  });

  // Engine Config Update
  it('GET and PUT /api/engine/config manages configurable engine parameters', async () => {
    const getRes = await request(app).get('/api/engine/config');
    expect(getRes.status).toBe(200);
    expect(getRes.body.defaultRepaymentRateBps).toBe(500);

    const putRes = await request(app)
      .put('/api/engine/config')
      .send({
        repaymentRateBasisPoints: 600, // 6%
        dailyCapPaise: 30000,          // ₹300
        minimumDeductionThresholdPaise: 200,
        retryLimit: 4,
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.config.defaultRepaymentRateBps).toBe(600);
    expect(putRes.body.config.defaultDailyCapPaise).toBe(30000);
  });
});
