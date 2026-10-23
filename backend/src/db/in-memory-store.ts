import {
  WorkerProfile,
  ConsentRecord,
  EarningsRecord,
  Loan,
  AutoPayMandate,
  PayoutEvent,
  DebitInstruction,
  Repayment,
} from '@microstream/shared';

export class InMemoryStore {
  public workers: Map<string, WorkerProfile> = new Map();
  public consents: Map<string, ConsentRecord> = new Map();
  public earnings: Map<string, EarningsRecord> = new Map();
  public loans: Map<string, Loan> = new Map();
  public mandates: Map<string, AutoPayMandate> = new Map();
  public payouts: Map<string, PayoutEvent> = new Map();
  public debitInstructions: Map<string, DebitInstruction> = new Map();
  public repayments: Map<string, Repayment> = new Map();

  constructor() {
    this.seed();
  }

  public reset(): void {
    this.workers.clear();
    this.consents.clear();
    this.earnings.clear();
    this.loans.clear();
    this.mandates.clear();
    this.payouts.clear();
    this.debitInstructions.clear();
    this.repayments.clear();
    this.seed();
  }

  private seed(): void {
    // 1. Worker Profiles
    const workers: WorkerProfile[] = [
      {
        did: 'did:drunix:worker:ravi-kumar-01',
        userId: 'usr_ravi_01',
        name: 'Ravi Kumar',
        phone: '+91 98765 43210',
        primaryPlatform: 'ZOMATO',
        vpa: 'ravi.kumar@oksbi',
        activeMandateId: 'mnd_ravi_01',
        creditTier: 'PRIME_A',
        riskScore: 88,
        joinedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        publicKey: '04b281f6e2c842b09a7b973ef808298192809182379182739812739182739812',
        status: 'ACTIVE',
      },
      {
        did: 'did:drunix:worker:sunita-devi-02',
        userId: 'usr_sunita_02',
        name: 'Sunita Devi',
        phone: '+91 98123 45678',
        primaryPlatform: 'SWIGGY',
        vpa: 'sunita.devi@icici',
        activeMandateId: 'mnd_sunita_02',
        creditTier: 'STANDARD_B',
        riskScore: 76,
        joinedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
        publicKey: '04a9192873198273918273918273918273918273918273918273918273918273',
        status: 'ACTIVE',
      },
      {
        did: 'did:drunix:worker:arif-uber-03',
        userId: 'usr_arif_03',
        name: 'Mohammed Arif',
        phone: '+91 97654 32109',
        primaryPlatform: 'UBER',
        vpa: 'arif.cab@paytm',
        activeMandateId: 'mnd_arif_03',
        creditTier: 'PRIME_A',
        riskScore: 91,
        joinedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        publicKey: '04c8172938172938172938172938172938172938172938172938172938172938',
        status: 'ACTIVE',
      },
      {
        did: 'did:drunix:worker:priya-uc-04',
        userId: 'usr_priya_04',
        name: 'Priya Sharma',
        phone: '+91 99887 76655',
        primaryPlatform: 'URBAN_COMPANY',
        vpa: 'priya.salon@hdfcbank',
        activeMandateId: 'mnd_priya_04',
        creditTier: 'STANDARD_B',
        riskScore: 72,
        joinedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        publicKey: '04d7162534152637485960718293041526374859607182930415263748596071',
        status: 'ACTIVE',
      },
      {
        did: 'did:drunix:worker:vikram-zepto-05',
        userId: 'usr_vikram_05',
        name: 'Vikram Singh',
        phone: '+91 96543 21098',
        primaryPlatform: 'ZEPTO',
        vpa: 'vikram.rider@axisbank',
        activeMandateId: 'mnd_vikram_05',
        creditTier: 'EMERGING_C',
        riskScore: 64,
        joinedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        publicKey: '04e6152433425160798a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e',
        status: 'ACTIVE',
      },
    ];

    for (const w of workers) {
      this.workers.set(w.did, w);
    }

    // 2. UPI AutoPay Mandates
    const mandates: AutoPayMandate[] = [
      {
        mandateId: 'mnd_ravi_01',
        umrn: 'UMRN2026ZOMATO001',
        did: 'did:drunix:worker:ravi-kumar-01',
        vpa: 'ravi.kumar@oksbi',
        bankAccountMasked: 'XXXX5678',
        ifscCode: 'SBIN0001234',
        maxAmountPaise: 200000, // ₹2,000 cap
        frequency: 'AS_PRESENTED',
        status: 'ACTIVE',
        startDate: '2026-09-01',
        endDate: '2027-08-31',
        authorizedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
      {
        mandateId: 'mnd_sunita_02',
        umrn: 'UMRN2026SWIGGY002',
        did: 'did:drunix:worker:sunita-devi-02',
        vpa: 'sunita.devi@icici',
        bankAccountMasked: 'XXXX9123',
        ifscCode: 'ICIC0004321',
        maxAmountPaise: 250000,
        frequency: 'AS_PRESENTED',
        status: 'ACTIVE',
        startDate: '2026-09-05',
        endDate: '2027-09-04',
        authorizedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      },
      {
        mandateId: 'mnd_arif_03',
        umrn: 'UMRN2026UBER003',
        did: 'did:drunix:worker:arif-uber-03',
        vpa: 'arif.cab@paytm',
        bankAccountMasked: 'XXXX3456',
        ifscCode: 'PYTM0123456',
        maxAmountPaise: 300000,
        frequency: 'AS_PRESENTED',
        status: 'ACTIVE',
        startDate: '2026-09-10',
        endDate: '2027-09-09',
        authorizedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      },
      {
        mandateId: 'mnd_priya_04',
        umrn: 'UMRN2026UC004',
        did: 'did:drunix:worker:priya-uc-04',
        vpa: 'priya.salon@hdfcbank',
        bankAccountMasked: 'XXXX7890',
        ifscCode: 'HDFC0005678',
        maxAmountPaise: 250000,
        frequency: 'AS_PRESENTED',
        status: 'ACTIVE',
        startDate: '2026-09-15',
        endDate: '2027-09-14',
        authorizedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      },
      {
        mandateId: 'mnd_vikram_05',
        umrn: 'UMRN2026ZEPTO005',
        did: 'did:drunix:worker:vikram-zepto-05',
        vpa: 'vikram.rider@axisbank',
        bankAccountMasked: 'XXXX2345',
        ifscCode: 'UTIB0009876',
        maxAmountPaise: 150000,
        frequency: 'AS_PRESENTED',
        status: 'ACTIVE',
        startDate: '2026-09-20',
        endDate: '2027-09-19',
        authorizedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      },
    ];

    for (const m of mandates) {
      this.mandates.set(m.mandateId, m);
    }

    // 3. Active Loans (in integer paise)
    const loans: Loan[] = [
      {
        loanId: 'LN-2026-001',
        did: 'did:drunix:worker:ravi-kumar-01',
        lenderId: 'lender-kotak-micro',
        lenderName: 'Kotak Microfinance',
        principalPaise: 1000000, // ₹10,000
        outstandingBalancePaise: 875500, // ₹8,755 remaining
        interestRateBps: 1200, // 12.00%
        deductionRateBps: 500, // 5.00%
        dailyCapPaise: 20000, // ₹200 daily cap
        totalRepaidPaise: 124500, // ₹1,245 repaid
        mandateId: 'mnd_ravi_01',
        status: 'ACTIVE',
        purpose: 'EV Two-Wheeler Battery Replacement',
        issuedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        txHash: '0x9923a18e9c...01',
      },
      {
        loanId: 'LN-2026-002',
        did: 'did:drunix:worker:sunita-devi-02',
        lenderId: 'lender-kotak-micro',
        lenderName: 'Kotak Microfinance',
        principalPaise: 1500000, // ₹15,000
        outstandingBalancePaise: 1362000, // ₹13,620 remaining
        interestRateBps: 1250,
        deductionRateBps: 600, // 6.00%
        dailyCapPaise: 25000,
        totalRepaidPaise: 138000,
        mandateId: 'mnd_sunita_02',
        status: 'ACTIVE',
        purpose: 'Smartphone upgrade for delivery dispatch',
        issuedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        txHash: '0x9923a18e9c...02',
      },
      {
        loanId: 'LN-2026-003',
        did: 'did:drunix:worker:arif-uber-03',
        lenderId: 'lender-bajaj-fin',
        lenderName: 'Bajaj Finserv Micro',
        principalPaise: 2500000, // ₹25,000
        outstandingBalancePaise: 2280000,
        interestRateBps: 1150,
        deductionRateBps: 500,
        dailyCapPaise: 30000,
        totalRepaidPaise: 220000,
        mandateId: 'mnd_arif_03',
        status: 'ACTIVE',
        purpose: 'CNG kit overhaul & vehicle maintenance',
        issuedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
        txHash: '0x9923a18e9c...03',
      },
    ];

    for (const l of loans) {
      this.loans.set(l.loanId, l);
    }

    // 4. Earnings History (10 days for Ravi Kumar)
    const raviDailyEarnings = [
      { dayOffset: 10, amountPaise: 125000, orders: 18 },
      { dayOffset: 9, amountPaise: 142000, orders: 21 },
      { dayOffset: 8, amountPaise: 98000, orders: 14 },
      { dayOffset: 7, amountPaise: 165000, orders: 24 },
      { dayOffset: 6, amountPaise: 110000, orders: 16 },
      { dayOffset: 5, amountPaise: 135000, orders: 19 },
      { dayOffset: 4, amountPaise: 155000, orders: 22 },
      { dayOffset: 3, amountPaise: 85000, orders: 12 },
      { dayOffset: 2, amountPaise: 175000, orders: 25 },
      { dayOffset: 1, amountPaise: 140000, orders: 20 },
    ];

    for (const item of raviDailyEarnings) {
      const dateStr = new Date(Date.now() - item.dayOffset * 86400000).toISOString().split('T')[0];
      const id = `ern_r_${item.dayOffset}`;
      this.earnings.set(id, {
        id,
        did: 'did:drunix:worker:ravi-kumar-01',
        platformId: 'zomato-in',
        date: dateStr,
        grossEarningsPaise: item.amountPaise,
        netEarningsPaise: Math.round(item.amountPaise * 0.92),
        ordersOrTripsCount: item.orders,
        reference: `ZOM-REF-${item.dayOffset}`,
        status: 'RECORDED',
        recordedAt: new Date(Date.now() - item.dayOffset * 86400000).toISOString(),
        blockNumber: 2000 + item.dayOffset,
        txHash: `0x7f${item.dayOffset}abcd...`,
      });
    }

    // 5. Repayment history for Ravi Kumar (past 5 settled streaming deductions)
    const settledDeductions = [
      { dayOffset: 5, amountPaise: 6750, prev: 910000, newBal: 903250 },
      { dayOffset: 4, amountPaise: 7750, prev: 903250, newBal: 895500 },
      { dayOffset: 3, amountPaise: 4250, prev: 895500, newBal: 891250 },
      { dayOffset: 2, amountPaise: 8750, prev: 891250, newBal: 882500 },
      { dayOffset: 1, amountPaise: 7000, prev: 882500, newBal: 875500 },
    ];

    for (const s of settledDeductions) {
      const repId = `rep_r_${s.dayOffset}`;
      const dbtId = `dbt_r_${s.dayOffset}`;
      const timestamp = new Date(Date.now() - s.dayOffset * 86400000).toISOString();

      this.debitInstructions.set(dbtId, {
        instructionId: dbtId,
        loanId: 'LN-2026-001',
        did: 'did:drunix:worker:ravi-kumar-01',
        payoutId: `pay_r_${s.dayOffset}`,
        amountPaise: s.amountPaise,
        status: 'SUCCESS',
        idempotencyKey: `IDEMP-DEBIT-R-${s.dayOffset}`,
        upiRef: `UPI/202610${18 + s.dayOffset}/910283710${s.dayOffset}`,
        retryCount: 0,
        maxRetries: 3,
        createdAt: timestamp,
        executedAt: timestamp,
        txHash: `0xaa11...${s.dayOffset}`,
      });

      this.repayments.set(repId, {
        id: repId,
        loanId: 'LN-2026-001',
        debitInstructionId: dbtId,
        did: 'did:drunix:worker:ravi-kumar-01',
        amountPaise: s.amountPaise,
        previousBalancePaise: s.prev,
        newOutstandingBalancePaise: s.newBal,
        isFinalSettlement: false,
        settledAt: timestamp,
        upiRef: `UPI/202610${18 + s.dayOffset}/910283710${s.dayOffset}`,
        txHash: `0xbb22...${s.dayOffset}`,
      });
    }
  }
}

export const inMemoryStore = new InMemoryStore();
