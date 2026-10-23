import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/db.js';
import { MockPayoutProviderAdapter } from '../src/adapters/payout/mock-payout.adapter.js';
import { MockUPIAutoPayAdapter } from '../src/adapters/payment/mock-upi-autopay.adapter.js';

describe('Payout Integration & UPI AutoPay Simulation', () => {
  let app: any;

  beforeEach(async () => {
    await db.init();
    const appInstance = createApp();
    app = appInstance.app;
  });

  describe('Adapters & Interfaces Separation', () => {
    it('PayoutProviderAdapter creates, retrieves and enforces reference idempotency', async () => {
      const payoutAdapter = new MockPayoutProviderAdapter();
      expect(payoutAdapter.isMock).toBe(true);

      const ref = `PAY-TEST-${Date.now()}`;
      const event1 = await payoutAdapter.simulatePayout({
        did: 'did:drunix:worker:ravi-kumar-01',
        platformId: 'zomato-in',
        amountPaise: 120000,
        reference: ref,
      });

      expect(event1.id).toBeDefined();
      expect(event1.reference).toBe(ref);
      expect(event1.amountPaise).toBe(120000);

      // Replay same reference -> must return same event without duplicating
      const event2 = await payoutAdapter.simulatePayout({
        did: 'did:drunix:worker:ravi-kumar-01',
        platformId: 'zomato-in',
        amountPaise: 120000,
        reference: ref,
      });

      expect(event2.id).toBe(event1.id);
    });

    it('AutoPayProviderAdapter mandate starts in AWAITING_AUTHORIZATION until approved', async () => {
      const autopayAdapter = new MockUPIAutoPayAdapter();
      expect(autopayAdapter.isMock).toBe(true);

      // 1. Create mandate
      const mandate = await autopayAdapter.createMandate({
        did: 'did:drunix:worker:ravi-kumar-01',
        vpa: 'ravi.kumar@oksbi',
        bankAccountMasked: 'XXXX5678',
        ifscCode: 'SBIN0001234',
        maxAmountPaise: 200000,
      });

      expect(mandate.status).toBe('AWAITING_AUTHORIZATION');
      expect(mandate.authorizedAt).toBeUndefined();

      // Attempt debit before authorization -> must fail
      const debitRes1 = await autopayAdapter.executeDebit({
        instructionId: 'ins_test_1',
        mandateId: mandate.mandateId,
        amountPaise: 5000,
        idempotencyKey: `IDEM-${Date.now()}-1`,
      });
      expect(debitRes1.success).toBe(false);
      expect(debitRes1.errorCode).toBe('MANDATE_AWAITING_AUTHORIZATION');

      // 2. Demo user authorizes mandate
      const approvedMandate = await autopayAdapter.approveMandate(mandate.mandateId);
      expect(approvedMandate.status).toBe('ACTIVE');
      expect(approvedMandate.authorizedAt).toBeDefined();

      // 3. Debit now succeeds
      const debitRes2 = await autopayAdapter.executeDebit({
        instructionId: 'ins_test_2',
        mandateId: mandate.mandateId,
        amountPaise: 5000,
        idempotencyKey: `IDEM-${Date.now()}-2`,
      });
      expect(debitRes2.success).toBe(true);
      expect(debitRes2.upiRef).toMatch(/^UPI\//);
    });

    it('AutoPayProviderAdapter uses stable idempotency keys for debit instructions', async () => {
      const autopayAdapter = new MockUPIAutoPayAdapter();
      const mandate = await autopayAdapter.createMandate({
        did: 'did:drunix:worker:ravi-kumar-01',
        vpa: 'ravi.kumar@oksbi',
        bankAccountMasked: 'XXXX5678',
        ifscCode: 'SBIN0001234',
        maxAmountPaise: 200000,
      }, true); // autoApprove = true

      const idemKey = `IDEM-STABLE-${Date.now()}`;
      const res1 = await autopayAdapter.executeDebit({
        instructionId: 'ins_stable_1',
        mandateId: mandate.mandateId,
        amountPaise: 7500,
        idempotencyKey: idemKey,
      });

      expect(res1.success).toBe(true);
      const upiRef1 = res1.upiRef;

      // Repeat with same idempotency key
      const res2 = await autopayAdapter.executeDebit({
        instructionId: 'ins_stable_1',
        mandateId: mandate.mandateId,
        amountPaise: 7500,
        idempotencyKey: idemKey,
      });

      expect(res2.success).toBe(true);
      expect(res2.upiRef).toBe(upiRef1); // Returns identical cached response
    });

    it('AutoPayProviderAdapter simulates timeout without creating duplicate instructions', async () => {
      const autopayAdapter = new MockUPIAutoPayAdapter();
      const mandate = await autopayAdapter.createMandate({
        did: 'did:drunix:worker:ravi-kumar-01',
        vpa: 'ravi.kumar@oksbi',
        bankAccountMasked: 'XXXX5678',
        ifscCode: 'SBIN0001234',
        maxAmountPaise: 200000,
      }, true);

      const idemKey = `IDEM-TIMEOUT-${Date.now()}`;
      const res = await autopayAdapter.executeDebit({
        instructionId: 'ins_timeout_1',
        mandateId: mandate.mandateId,
        amountPaise: 6000,
        idempotencyKey: idemKey,
      }, 'TIMEOUT');

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('PSP_TIMEOUT');
      expect(res.errorMessage).toContain('remains pending; do not create duplicate instruction');
    });
  });

  describe('Payment Callback Handler', () => {
    it('rejects callback with amount mismatch', async () => {
      // Create a pending instruction via simulator payout
      const simRes = await request(app)
        .post('/api/simulator/payouts')
        .send({
          workerId: 'wrk_ravi_01',
          amountRupees: 1000,
          reference: `PAY-CB-TEST-${Date.now()}`,
          autoConfirm: false, // leave PENDING
        })
        .expect(200);

      const instructionId = simRes.body.debitInstruction?.id;
      const expectedAmount = simRes.body.debitInstruction?.amountPaise;
      expect(instructionId).toBeDefined();

      // Submit callback with mismatched amount
      const cbRes = await request(app)
        .post('/api/payments/callback')
        .send({
          instructionId,
          reference: simRes.body.reference,
          amountPaise: expectedAmount + 500, // mismatch
          success: true,
        })
        .expect(400);

      expect(cbRes.body.error).toContain('mismatch');
    });

    it('handles duplicate callback safely without duplicate balance deduction', async () => {
      const payoutRef = `PAY-CB-DUP-${Date.now()}`;
      const simRes = await request(app)
        .post('/api/simulator/payouts')
        .send({
          workerId: 'wrk_ravi_01',
          amountRupees: 1000,
          reference: payoutRef,
          autoConfirm: false,
        })
        .expect(200);

      const instructionId = simRes.body.debitInstruction.id;
      const amountPaise = simRes.body.debitInstruction.amountPaise;

      // 1st Callback: Success
      const cb1 = await request(app)
        .post('/api/payments/callback')
        .send({
          instructionId,
          reference: payoutRef,
          amountPaise,
          success: true,
          upiRef: `UPI/${Date.now()}/1234567890`,
        })
        .expect(200);

      expect(cb1.body.success).toBe(true);
      expect(cb1.body.status).toBe('SUCCEEDED');
      const balanceAfterCb1 = cb1.body.newOutstandingBalancePaise;

      // 2nd Callback: Duplicate
      const cb2 = await request(app)
        .post('/api/payments/callback')
        .send({
          instructionId,
          reference: payoutRef,
          amountPaise,
          success: true,
          upiRef: `UPI/${Date.now()}/9876543210`,
        })
        .expect(200);

      expect(cb2.body.success).toBe(true);
      expect(cb2.body.message).toContain('Duplicate callback safely acknowledged');
      expect(cb2.body.newOutstandingBalancePaise).toBe(balanceAfterCb1);
    });
  });

  describe('One-Click Demo Suite', () => {
    it('executes full ₹10,000 loan -> ₹1,000 payout (5% = ₹50) -> ₹9,950 balance -> replay check -> failed debit check', async () => {
      const res = await request(app)
        .post('/api/simulator/one-click-demo')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.demoLoanId).toBe('LN-DEMO-10K');
      expect(res.body.proofs.allPassed).toBe(true);

      // Step 1: Successful AutoPay Stream
      const step1 = res.body.steps[0];
      expect(step1.passed).toBe(true);
      expect(step1.previousBalancePaise).toBe(1000000); // ₹10,000
      expect(step1.deductionCalculatedPaise).toBe(5000); // ₹50
      expect(step1.newBalancePaise).toBe(995000);       // ₹9,950

      // Step 2: Idempotency Replay
      const step2 = res.body.steps[1];
      expect(step2.passed).toBe(true);
      expect(step2.balanceAfterReplayPaise).toBe(995000); // still ₹9,950
      expect(step2.backendMessage).toContain('Duplicate payout reference acknowledged');

      // Step 3: Failed Debit Invariance
      const step3 = res.body.steps[2];
      expect(step3.passed).toBe(true);
      expect(step3.balanceAfterFailedDebitPaise).toBe(995000); // unchanged at ₹9,950
      expect(step3.debitInstructionStatus).toBe('RETRY_PENDING');
    });
  });
});
