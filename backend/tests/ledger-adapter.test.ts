import { describe, it, expect, beforeEach } from 'vitest';
import { MockLedgerAdapter } from '../src/adapters/ledger/mock-ledger.adapter.js';
import { FabricLedgerAdapter } from '../src/adapters/ledger/fabric-ledger.adapter.js';
import { getLedgerAdapter } from '../src/adapters/ledger/index.js';
import { inMemoryStore } from '../src/db/in-memory-store.js';

describe('Backend LedgerAdapter Interface & Implementations', () => {
  let adapter: MockLedgerAdapter;

  beforeEach(() => {
    inMemoryStore.workers.clear();
    inMemoryStore.consents.clear();
    inMemoryStore.earnings.clear();
    inMemoryStore.loans.clear();
    inMemoryStore.debitInstructions.clear();
    inMemoryStore.repayments.clear();
    adapter = new MockLedgerAdapter();
  });

  it('1. RegisterWorkerDID registers DID without personal information', async () => {
    const res = await adapter.registerWorkerDID({
      did: 'did:drunix:worker:sunita-01',
      userId: 'usr_sunita_01',
      name: 'Sunita Devi',
      phone: '+91 98123 45678',
      primaryPlatform: 'SWIGGY',
      vpa: 'sunita@okhdfc',
      publicKey: '04a91928731982739182739182739182',
      status: 'ACTIVE',
    });

    expect(res.did).toBe('did:drunix:worker:sunita-01');
    expect(res.txHash).toMatch(/^0x[0-9a-f]{64}$/);

    const fetched = await adapter.getWorkerDID('did:drunix:worker:sunita-01');
    expect(fetched).not.toBeNull();
    expect(fetched?.did).toBe('did:drunix:worker:sunita-01');
    expect(fetched?.creditTier).toBe('STANDARD_B');
  });

  it('2. GrantConsent and RevokeConsent manage worker authorizations', async () => {
    const consent = await adapter.grantConsent({
      did: 'did:drunix:worker:sunita-01',
      grantee: 'lender-kotak-micro',
      scope: ['earnings:read', 'deduction:debit'],
      purpose: 'Daily micro-credit recovery',
      durationDays: 365,
    });

    expect(consent.id).toBeDefined();
    expect(consent.status).toBe('ACTIVE');

    const activeConsent = await adapter.getConsent('did:drunix:worker:sunita-01', 'lender-kotak-micro');
    expect(activeConsent).not.toBeNull();
    expect(activeConsent?.id).toBe(consent.id);

    const revoked = await adapter.revokeConsent(consent.id, 'did:drunix:worker:sunita-01');
    expect(revoked.status).toBe('REVOKED');

    const checkRevoked = await adapter.getConsent('did:drunix:worker:sunita-01', 'lender-kotak-micro');
    expect(checkRevoked).toBeNull();
  });

  it('3. LogDailyEarnings safely handles deduplication and bounds', async () => {
    const e1 = await adapter.logDailyEarnings({
      did: 'did:drunix:worker:sunita-01',
      platformId: 'swiggy-in',
      date: '2026-10-21',
      grossEarningsPaise: 120000,
      reference: 'SWIGGY-PAYOUT-101',
    });

    expect(e1.earningsId).toBeDefined();

    // Duplicate call with same did + date + reference returns existing without duplicating
    const e1Dup = await adapter.logDailyEarnings({
      did: 'did:drunix:worker:sunita-01',
      platformId: 'swiggy-in',
      date: '2026-10-21',
      grossEarningsPaise: 120000,
      reference: 'SWIGGY-PAYOUT-101',
    });

    expect(e1Dup.earningsId).toBe(e1.earningsId);

    // Negative earnings rejected
    await expect(
      adapter.logDailyEarnings({
        did: 'did:drunix:worker:sunita-01',
        platformId: 'swiggy-in',
        date: '2026-10-22',
        grossEarningsPaise: -1000,
        reference: 'BAD-PAYOUT',
      })
    ).rejects.toThrow('grossEarningsPaise must be non-negative');
  });

  it('4. GetEarningsSummary computes aggregates for underwriting', async () => {
    await adapter.logDailyEarnings({
      did: 'did:drunix:worker:sunita-01',
      platformId: 'swiggy-in',
      date: '2026-10-20',
      grossEarningsPaise: 100000,
      reference: 'REF-1',
    });
    await adapter.logDailyEarnings({
      did: 'did:drunix:worker:sunita-01',
      platformId: 'swiggy-in',
      date: '2026-10-21',
      grossEarningsPaise: 140000,
      reference: 'REF-2',
    });

    const summary = await adapter.getEarningsSummary('did:drunix:worker:sunita-01', 30);
    expect(summary.totalEarningsPaise).toBe(240000);
    expect(summary.activeDaysCount).toBe(2);
    expect(summary.averageDailyEarningsPaise).toBe(120000);
  });

  it('5. IssueLoan and GetLoan manage loan lifecycle on ledger', async () => {
    const loan = await adapter.issueLoan({
      did: 'did:drunix:worker:sunita-01',
      lenderId: 'lender-kotak-micro',
      principalPaise: 1500000, // ₹15,000
      deductionRateBps: 500,    // 5.0%
      dailyCapPaise: 25000,     // ₹250
      mandateId: 'mnd_sunita_01',
      purpose: 'EV scooter battery financing',
    });

    expect(loan.loanId).toBeDefined();
    expect(loan.outstandingBalancePaise).toBe(1500000);
    expect(loan.status).toBe('ACTIVE');

    const fetched = await adapter.getLoan(loan.loanId);
    expect(fetched?.loanId).toBe(loan.loanId);

    const activeLoan = await adapter.getActiveLoanByDid('did:drunix:worker:sunita-01');
    expect(activeLoan?.loanId).toBe(loan.loanId);
  });

  it('6. CalculateDeduction applies required formulas, caps, and zero checks', async () => {
    const loan = await adapter.issueLoan({
      did: 'did:drunix:worker:sunita-01',
      lenderId: 'lender-kotak-micro',
      principalPaise: 1000000, // ₹10,000
      deductionRateBps: 500,    // 5%
      dailyCapPaise: 20000,     // ₹200 daily cap
      mandateId: 'mnd_01',
    });

    // ₹1,000 payout at 5% = ₹50 (5,000 paise)
    const out1 = await adapter.calculateDeduction(loan.loanId, 100000, 'PAY-1000');
    expect(out1.deductionPaise).toBe(5000);

    // ₹300 payout at 5% = ₹15 (1,500 paise)
    const out2 = await adapter.calculateDeduction(loan.loanId, 30000, 'PAY-300');
    expect(out2.deductionPaise).toBe(1500);

    // Zero payout produces 0 deduction
    const outZero = await adapter.calculateDeduction(loan.loanId, 0, 'PAY-0');
    expect(outZero.deductionPaise).toBe(0);

    // Daily cap clamping: ₹6,000 payout at 5% is ₹300, clamped to daily cap ₹200 (20,000 paise)
    const outCap = await adapter.calculateDeduction(loan.loanId, 600000, 'PAY-6000');
    expect(outCap.deductionPaise).toBe(20000);
  });

  it('7. RecordDebitInstruction prevents duplicate instruction IDs', async () => {
    const loan = await adapter.issueLoan({
      did: 'did:drunix:worker:sunita-01',
      lenderId: 'lender-kotak-micro',
      principalPaise: 500000,
      deductionRateBps: 500,
      mandateId: 'mnd_01',
    });

    const ins = await adapter.recordDebitInstruction({
      instructionId: 'ins_backend_01',
      loanId: loan.loanId,
      did: 'did:drunix:worker:sunita-01',
      amountPaise: 2500,
      idempotencyKey: 'IDEM_01',
    });

    expect(ins.status).toBe('PENDING');

    // Duplicate instruction ID must reject
    await expect(
      adapter.recordDebitInstruction({
        instructionId: 'ins_backend_01',
        loanId: loan.loanId,
        did: 'did:drunix:worker:sunita-01',
        amountPaise: 2500,
        idempotencyKey: 'IDEM_01',
      })
    ).rejects.toThrow('already exists');
  });

  it('8. UpdateLoanBalance applies payment outcomes, prevents duplicate callbacks, and closes loan at zero', async () => {
    const loan = await adapter.issueLoan({
      did: 'did:drunix:worker:sunita-01',
      lenderId: 'lender-kotak-micro',
      principalPaise: 5000, // ₹50
      deductionRateBps: 500,
      mandateId: 'mnd_01',
    });

    const ins = await adapter.recordDebitInstruction({
      instructionId: 'ins_close_01',
      loanId: loan.loanId,
      did: 'did:drunix:worker:sunita-01',
      amountPaise: 5000,
      idempotencyKey: 'IDEM_CLOSE',
    });

    // Confirmed payment settles loan fully
    const result = await adapter.updateLoanBalance({
      loanId: loan.loanId,
      debitInstructionId: ins.instructionId,
      success: true,
      amountDebitedPaise: 5000,
      upiRef: 'UPI/20261024/777888999',
    });

    expect(result.loan.outstandingBalancePaise).toBe(0);
    expect(result.loan.status).toBe('PAID');
    expect(result.repayment).toBeDefined();
    expect(result.repayment?.amountPaise).toBe(5000);

    // Duplicate callback must be strictly rejected
    await expect(
      adapter.updateLoanBalance({
        loanId: loan.loanId,
        debitInstructionId: ins.instructionId,
        success: true,
        amountDebitedPaise: 5000,
        upiRef: 'UPI/20261024/777888999',
      })
    ).rejects.toThrow('duplicate callback rejected');
  });

  it('9. Factory getLedgerAdapter supports switching between mock and real adapter via config', () => {
    // Default mode is mock
    delete process.env.LEDGER_ADAPTER_TYPE;
    const defaultAdapter = getLedgerAdapter();
    expect(defaultAdapter.isMock).toBe(true);

    // Real adapter mode
    process.env.LEDGER_ADAPTER_TYPE = 'fabric';
    const fabricAdapter = getLedgerAdapter();
    expect(fabricAdapter.isMock).toBe(false);
    expect(fabricAdapter).toBeInstanceOf(FabricLedgerAdapter);

    // Reset back to mock
    process.env.LEDGER_ADAPTER_TYPE = 'mock';
  });
});
