import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  WorkerProfile,
  Loan,
  AutoPayMandate,
  EarningsRecord,
  PayoutEvent,
  Repayment,
  ConsentRecord,
  DebitInstruction,
} from '@microstream/shared';

export interface UserSession {
  id: string;
  name: string;
  role: 'WORKER' | 'LENDER' | 'AUDITOR';
  did?: string;
  lenderId?: string;
  avatarText: string;
  email: string;
}

export interface StreamReceipt {
  payout: PayoutEvent;
  hasActiveLoan: boolean;
  deductionCalculatedRupees: number;
  debitSuccess: boolean;
  upiRef?: string;
  updatedLoan?: Loan;
  repayment?: Repayment;
  message: string;
  failureReason?: string;
  timestamp: string;
}

interface AppContextType {
  currentUser: UserSession;
  setCurrentUser: (user: UserSession) => void;
  workers: WorkerProfile[];
  activeWorker: WorkerProfile | null;
  setActiveWorkerDid: (did: string) => void;
  loans: Loan[];
  activeLoan: Loan | null;
  earnings: EarningsRecord[];
  payouts: PayoutEvent[];
  mandates: AutoPayMandate[];
  activeMandate: AutoPayMandate | null;
  repayments: Repayment[];
  consents: ConsentRecord[];
  simulatePayout: (
    did: string,
    platformId: string,
    amountRupees: number,
    failureType?: 'NONE' | 'INSUFFICIENT_FUNDS' | 'MANDATE_EXCEEDED' | 'NETWORK_ERROR'
  ) => Promise<StreamReceipt>;
  applyForLoan: (params: {
    did: string;
    amountRupees: number;
    deductionRatePct: number;
    dailyCapRupees: number;
    purpose: string;
    lenderName?: string;
  }) => Promise<Loan>;
  updateMandateStatus: (mandateId: string, status: 'ACTIVE' | 'PAUSED' | 'REVOKED') => void;
  revokeConsent: (consentId: string) => void;
  grantConsent: (grantee: string, scope: string[], purpose: string) => void;
  resetAllData: () => void;
  isBackendConnected: boolean;
}

const STORAGE_KEY = 'microstream_state_v2';

const INITIAL_WORKERS: WorkerProfile[] = [
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
    joinedAt: '2026-08-15T09:00:00.000Z',
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
    joinedAt: '2026-08-20T10:30:00.000Z',
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
    joinedAt: '2026-08-25T14:15:00.000Z',
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
    joinedAt: '2026-09-01T11:00:00.000Z',
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
    joinedAt: '2026-09-10T16:45:00.000Z',
    publicKey: '04e6152433425160798a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e',
    status: 'ACTIVE',
  },
];

const INITIAL_MANDATES: AutoPayMandate[] = [
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
    authorizedAt: '2026-09-01T08:30:00.000Z',
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
    authorizedAt: '2026-09-05T09:15:00.000Z',
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
    authorizedAt: '2026-09-10T12:00:00.000Z',
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
    authorizedAt: '2026-09-15T10:00:00.000Z',
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
    authorizedAt: '2026-09-20T11:20:00.000Z',
  },
];

const INITIAL_LOANS: Loan[] = [
  {
    loanId: 'LN-2026-001',
    did: 'did:drunix:worker:ravi-kumar-01',
    lenderId: 'lender-kotak-micro',
    lenderName: 'Kotak Microfinance',
    principalPaise: 1000000, // ₹10,000
    outstandingBalancePaise: 875500, // ₹8,755 remaining
    interestRateBps: 1200,
    deductionRateBps: 500, // 5.00%
    dailyCapPaise: 20000, // ₹200 daily cap
    totalRepaidPaise: 124500, // ₹1,245 repaid
    mandateId: 'mnd_ravi_01',
    status: 'ACTIVE',
    purpose: 'EV Two-Wheeler Battery Replacement',
    issuedAt: '2026-10-09T10:00:00.000Z',
    txHash: '0x9923a18e9cf384bc192837461928374a',
  },
  {
    loanId: 'LN-2026-002',
    did: 'did:drunix:worker:sunita-devi-02',
    lenderId: 'lender-kotak-micro',
    lenderName: 'Kotak Microfinance',
    principalPaise: 1500000, // ₹15,000
    outstandingBalancePaise: 1362000, // ₹13,620
    interestRateBps: 1250,
    deductionRateBps: 600, // 6.00%
    dailyCapPaise: 25000,
    totalRepaidPaise: 138000,
    mandateId: 'mnd_sunita_02',
    status: 'ACTIVE',
    purpose: 'Smartphone upgrade for delivery dispatch',
    issuedAt: '2026-10-14T11:30:00.000Z',
    txHash: '0x8812b18e9cf384bc192837461928374b',
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
    issuedAt: '2026-10-16T15:00:00.000Z',
    txHash: '0x7701c18e9cf384bc192837461928374c',
  },
];

const INITIAL_CONSENTS: ConsentRecord[] = [
  {
    id: 'cns_01',
    did: 'did:drunix:worker:ravi-kumar-01',
    grantee: 'did:drunix:lender:kotak-micro',
    scope: ['EARNINGS_READ', 'REPAYMENT_DEBIT', 'CREDIT_ASSESSMENT'],
    purpose: 'MicroStream real-time streaming underwriting and automated daily deduction',
    status: 'ACTIVE',
    grantedAt: '2026-09-01T08:30:00.000Z',
    expiresAt: '2027-08-31T23:59:59.000Z',
    txHash: '0x7f8a...01',
    blockNumber: 1042,
  },
  {
    id: 'cns_02',
    did: 'did:drunix:worker:ravi-kumar-01',
    grantee: 'did:drunix:platform:zomato',
    scope: ['EARNINGS_WRITE'],
    purpose: 'Logging daily verified delivery earnings on Drunix distributed ledger',
    status: 'ACTIVE',
    grantedAt: '2026-09-01T08:30:00.000Z',
    expiresAt: '2027-08-31T23:59:59.000Z',
    txHash: '0x7f8a...02',
    blockNumber: 1043,
  },
  {
    id: 'cns_03',
    did: 'did:drunix:worker:sunita-devi-02',
    grantee: 'did:drunix:lender:kotak-micro',
    scope: ['EARNINGS_READ', 'REPAYMENT_DEBIT'],
    purpose: 'MicroStream streaming loan underwriting',
    status: 'ACTIVE',
    grantedAt: '2026-09-05T09:15:00.000Z',
    expiresAt: '2027-09-04T23:59:59.000Z',
    txHash: '0x7f8a...03',
    blockNumber: 1088,
  },
];

function generateSeedEarnings(): EarningsRecord[] {
  const records: EarningsRecord[] = [];
  const platforms = ['zomato-in', 'swiggy-in', 'uber-in', 'urban-company-in', 'zepto-in'];
  const workers = INITIAL_WORKERS;

  workers.forEach((w) => {
    for (let i = 14; i >= 1; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      // realistic earnings: ₹800 to ₹1,800
      const baseRupees = w.creditTier === 'PRIME_A' ? 1400 : 1100;
      const variation = (Math.sin(i * 1.5) * 350 + (i % 3 === 0 ? 300 : -150));
      const grossPaise = Math.round(Math.max(400, baseRupees + variation) * 100);
      const netPaise = Math.round(grossPaise * 0.92);

      records.push({
        id: `ern_${w.did.split(':').pop()}_${i}`,
        did: w.did,
        platformId: w.primaryPlatform.toLowerCase() + '-in',
        date,
        grossEarningsPaise: grossPaise,
        netEarningsPaise: netPaise,
        ordersOrTripsCount: Math.round(grossPaise / 7000),
        reference: `${w.primaryPlatform}-SETTLE-${date.replace(/-/g, '')}`,
        status: 'RECORDED',
        recordedAt: new Date(Date.now() - i * 86400000).toISOString(),
        blockNumber: 2000 + i,
        txHash: `0x${Math.random().toString(16).substring(2, 18)}...`,
      });
    }
  });

  return records;
}

function generateSeedRepayments(): Repayment[] {
  return [
    {
      id: 'rep_r_01',
      loanId: 'LN-2026-001',
      debitInstructionId: 'ins_r_01',
      did: 'did:drunix:worker:ravi-kumar-01',
      amountPaise: 6750, // ₹67.50
      previousBalancePaise: 910000,
      newOutstandingBalancePaise: 903250,
      isFinalSettlement: false,
      settledAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      upiRef: 'UPI/20261019/9102837101',
      txHash: '0xbb22a18e9cf384bc192837461928374a',
    },
    {
      id: 'rep_r_02',
      loanId: 'LN-2026-001',
      debitInstructionId: 'ins_r_02',
      did: 'did:drunix:worker:ravi-kumar-01',
      amountPaise: 7750, // ₹77.50
      previousBalancePaise: 903250,
      newOutstandingBalancePaise: 895500,
      isFinalSettlement: false,
      settledAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      upiRef: 'UPI/20261020/9102837102',
      txHash: '0xbb22a18e9cf384bc192837461928374b',
    },
    {
      id: 'rep_r_03',
      loanId: 'LN-2026-001',
      debitInstructionId: 'ins_r_03',
      did: 'did:drunix:worker:ravi-kumar-01',
      amountPaise: 4250, // ₹42.50
      previousBalancePaise: 895500,
      newOutstandingBalancePaise: 891250,
      isFinalSettlement: false,
      settledAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      upiRef: 'UPI/20261021/9102837103',
      txHash: '0xbb22a18e9cf384bc192837461928374c',
    },
    {
      id: 'rep_r_04',
      loanId: 'LN-2026-001',
      debitInstructionId: 'ins_r_04',
      did: 'did:drunix:worker:ravi-kumar-01',
      amountPaise: 8750, // ₹87.50
      previousBalancePaise: 891250,
      newOutstandingBalancePaise: 882500,
      isFinalSettlement: false,
      settledAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      upiRef: 'UPI/20261022/9102837104',
      txHash: '0xbb22a18e9cf384bc192837461928374d',
    },
    {
      id: 'rep_r_05',
      loanId: 'LN-2026-001',
      debitInstructionId: 'ins_r_05',
      did: 'did:drunix:worker:ravi-kumar-01',
      amountPaise: 7000, // ₹70.00
      previousBalancePaise: 882500,
      newOutstandingBalancePaise: 875500,
      isFinalSettlement: false,
      settledAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      upiRef: 'UPI/20261023/9102837105',
      txHash: '0xbb22a18e9cf384bc192837461928374e',
    },
  ];
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserSession>(() => {
    const saved = localStorage.getItem('microstream_user');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      id: 'usr_ravi_01',
      name: 'Ravi Kumar',
      role: 'WORKER',
      did: 'did:drunix:worker:ravi-kumar-01',
      avatarText: 'RK',
      email: 'ravi.kumar@zomato-partner.in',
    };
  });

  const [workers, setWorkers] = useState<WorkerProfile[]>(INITIAL_WORKERS);
  const [activeWorkerDid, setActiveWorkerDid] = useState<string>('did:drunix:worker:ravi-kumar-01');
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [earnings, setEarnings] = useState<EarningsRecord[]>(generateSeedEarnings);
  const [payouts, setPayouts] = useState<PayoutEvent[]>([]);
  const [mandates, setMandates] = useState<AutoPayMandate[]>(INITIAL_MANDATES);
  const [repayments, setRepayments] = useState<Repayment[]>(generateSeedRepayments);
  const [consents, setConsents] = useState<ConsentRecord[]>(INITIAL_CONSENTS);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Load persisted state if available
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.workers) setWorkers(parsed.workers);
        if (parsed.loans) setLoans(parsed.loans);
        if (parsed.earnings) setEarnings(parsed.earnings);
        if (parsed.payouts) setPayouts(parsed.payouts);
        if (parsed.mandates) setMandates(parsed.mandates);
        if (parsed.repayments) setRepayments(parsed.repayments);
        if (parsed.consents) setConsents(parsed.consents);
        if (parsed.activeWorkerDid) setActiveWorkerDid(parsed.activeWorkerDid);
      } catch (e) {
        console.error('Error loading stored state:', e);
      }
    }
  }, []);

  // Save state on updates
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        workers,
        loans,
        earnings,
        payouts,
        mandates,
        repayments,
        consents,
        activeWorkerDid,
      })
    );
  }, [workers, loans, earnings, payouts, mandates, repayments, consents, activeWorkerDid]);

  // Save current user session
  useEffect(() => {
    localStorage.setItem('microstream_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // Check backend health
  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.status === 'OK') setIsBackendConnected(true);
      })
      .catch(() => setIsBackendConnected(false));
  }, []);

  const activeWorker = workers.find((w) => w.did === activeWorkerDid) || workers[0];
  const activeLoan = loans.find((l) => l.did === activeWorkerDid && l.status === 'ACTIVE') || null;
  const activeMandate = mandates.find((m) => m.did === activeWorkerDid && m.status === 'ACTIVE') || null;

  // Simulate daily platform payout and trigger real-time deduction
  const simulatePayout = async (
    did: string,
    platformId: string,
    amountRupees: number,
    failureType: 'NONE' | 'INSUFFICIENT_FUNDS' | 'MANDATE_EXCEEDED' | 'NETWORK_ERROR' = 'NONE'
  ): Promise<StreamReceipt> => {
    const amountPaise = Math.round(amountRupees * 100);
    const today = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString();
    const targetLoan = loans.find((l) => l.did === did && l.status === 'ACTIVE');
    const targetMandate = mandates.find((m) => m.did === did && m.status === 'ACTIVE');

    const payoutId = `pay_${Date.now()}`;
    const newPayout: PayoutEvent = {
      id: payoutId,
      did,
      platformId,
      amountPaise,
      reference: `PAY-${platformId.toUpperCase()}-${Date.now().toString().slice(-6)}`,
      payoutDate: today,
      detectedAt: timestamp,
      status: 'DETECTED',
    };

    // 1. Add daily earnings record
    const newEarning: EarningsRecord = {
      id: `ern_${Date.now()}`,
      did,
      platformId,
      date: today,
      grossEarningsPaise: amountPaise,
      netEarningsPaise: Math.round(amountPaise * 0.92),
      ordersOrTripsCount: Math.max(1, Math.round(amountRupees / 75)),
      reference: `ORD-${Date.now().toString().slice(-6)}`,
      status: 'RECORDED',
      recordedAt: timestamp,
      blockNumber: 3000 + earnings.length,
      txHash: `0x${Math.random().toString(16).substring(2, 18)}...`,
    };

    setEarnings((prev) => [newEarning, ...prev]);

    // If no active loan, just record payout
    if (!targetLoan) {
      newPayout.status = 'SKIPPED';
      newPayout.skipReason = 'NO_ACTIVE_LOAN';
      setPayouts((prev) => [newPayout, ...prev]);

      return {
        payout: newPayout,
        hasActiveLoan: false,
        deductionCalculatedRupees: 0,
        debitSuccess: false,
        message: 'Daily payout recorded. Worker has no active micro-loan.',
        timestamp,
      };
    }

    // 2. Calculate deduction via formula: min( payout * rate, balance, dailyCap )
    const rawDeductionPaise = Math.round((amountPaise * targetLoan.deductionRateBps) / 10000);
    let deductionPaise = rawDeductionPaise;

    if (deductionPaise > targetLoan.outstandingBalancePaise) {
      deductionPaise = targetLoan.outstandingBalancePaise;
    }
    if (targetLoan.dailyCapPaise > 0 && deductionPaise > targetLoan.dailyCapPaise) {
      deductionPaise = targetLoan.dailyCapPaise;
    }

    // 3. Handle Failure Injection
    if (failureType === 'INSUFFICIENT_FUNDS') {
      newPayout.status = 'FAILED';
      newPayout.skipReason = 'BANK_INSUFFICIENT_FUNDS';
      setPayouts((prev) => [newPayout, ...prev]);

      return {
        payout: newPayout,
        hasActiveLoan: true,
        deductionCalculatedRupees: deductionPaise / 100,
        debitSuccess: false,
        message: 'AutoPay Debit Failed: Worker bank balance insufficient. Carried forward to next payout.',
        failureReason: 'INSUFFICIENT_FUNDS',
        timestamp,
      };
    }

    if (failureType === 'MANDATE_EXCEEDED' || (targetMandate && deductionPaise > targetMandate.maxAmountPaise)) {
      newPayout.status = 'FAILED';
      newPayout.skipReason = 'EXCEEDS_MANDATE_CAP';
      setPayouts((prev) => [newPayout, ...prev]);

      return {
        payout: newPayout,
        hasActiveLoan: true,
        deductionCalculatedRupees: deductionPaise / 100,
        debitSuccess: false,
        message: 'AutoPay Debit Failed: Calculated deduction exceeds mandate safety cap.',
        failureReason: 'EXCEEDS_MANDATE_CAP',
        timestamp,
      };
    }

    // 4. Successful Debit Execution
    const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const upiRef = `UPI/${yyyymmdd}/${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const txHash = `0x${Math.random().toString(16).substring(2, 34)}`;

    const newOutstandingPaise = Math.max(0, targetLoan.outstandingBalancePaise - deductionPaise);
    const newTotalRepaidPaise = targetLoan.totalRepaidPaise + deductionPaise;
    const isSettled = newOutstandingPaise === 0;

    const updatedLoan: Loan = {
      ...targetLoan,
      outstandingBalancePaise: newOutstandingPaise,
      totalRepaidPaise: newTotalRepaidPaise,
      status: isSettled ? 'SETTLED' : 'ACTIVE',
      settledAt: isSettled ? timestamp : undefined,
    };

    const newRepayment: Repayment = {
      id: `rep_${Date.now()}`,
      loanId: targetLoan.loanId,
      debitInstructionId: `ins_${Date.now()}`,
      did,
      amountPaise: deductionPaise,
      previousBalancePaise: targetLoan.outstandingBalancePaise,
      newOutstandingBalancePaise: newOutstandingPaise,
      isFinalSettlement: isSettled,
      settledAt: timestamp,
      upiRef,
      txHash,
    };

    newPayout.status = 'COMPLETED';
    newPayout.processedDeductionId = newRepayment.debitInstructionId;

    // Update state
    setLoans((prev) => prev.map((l) => (l.loanId === targetLoan.loanId ? updatedLoan : l)));
    setRepayments((prev) => [newRepayment, ...prev]);
    setPayouts((prev) => [newPayout, ...prev]);

    return {
      payout: newPayout,
      hasActiveLoan: true,
      deductionCalculatedRupees: deductionPaise / 100,
      debitSuccess: true,
      upiRef,
      updatedLoan,
      repayment: newRepayment,
      message: `Streamed ₹${(deductionPaise / 100).toFixed(2)} deduction from ₹${amountRupees.toFixed(2)} daily payout.`,
      timestamp,
    };
  };

  // Apply for a new loan
  const applyForLoan = async (params: {
    did: string;
    amountRupees: number;
    deductionRatePct: number;
    dailyCapRupees: number;
    purpose: string;
    lenderName?: string;
  }): Promise<Loan> => {
    const principalPaise = Math.round(params.amountRupees * 100);
    const loanId = `LN-2026-${String(loans.length + 1).padStart(3, '0')}`;
    const mandate = mandates.find((m) => m.did === params.did && m.status === 'ACTIVE') || mandates[0];

    const newLoan: Loan = {
      loanId,
      did: params.did,
      lenderId: 'lender-kotak-micro',
      lenderName: params.lenderName || 'Kotak Microfinance',
      principalPaise,
      outstandingBalancePaise: principalPaise,
      interestRateBps: 1200,
      deductionRateBps: Math.round(params.deductionRatePct * 100),
      dailyCapPaise: Math.round(params.dailyCapRupees * 100),
      totalRepaidPaise: 0,
      mandateId: mandate.mandateId,
      status: 'ACTIVE',
      purpose: params.purpose,
      issuedAt: new Date().toISOString(),
      txHash: `0x${Math.random().toString(16).substring(2, 34)}`,
    };

    setLoans((prev) => [newLoan, ...prev]);
    return newLoan;
  };

  const updateMandateStatus = (mandateId: string, status: 'ACTIVE' | 'PAUSED' | 'REVOKED') => {
    setMandates((prev) =>
      prev.map((m) => (m.mandateId === mandateId ? { ...m, status } : m))
    );
  };

  const revokeConsent = (consentId: string) => {
    setConsents((prev) =>
      prev.map((c) => (c.id === consentId ? { ...c, status: 'REVOKED' } : c))
    );
  };

  const grantConsent = (grantee: string, scope: string[], purpose: string) => {
    const newConsent: ConsentRecord = {
      id: `cns_${Date.now()}`,
      did: activeWorkerDid,
      grantee,
      scope: scope as any,
      purpose,
      status: 'ACTIVE',
      grantedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      txHash: `0x${Math.random().toString(16).substring(2, 18)}...`,
      blockNumber: 1500 + consents.length,
    };
    setConsents((prev) => [newConsent, ...prev]);
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setWorkers(INITIAL_WORKERS);
    setActiveWorkerDid('did:drunix:worker:ravi-kumar-01');
    setLoans(INITIAL_LOANS);
    setEarnings(generateSeedEarnings());
    setPayouts([]);
    setMandates(INITIAL_MANDATES);
    setRepayments(generateSeedRepayments());
    setConsents(INITIAL_CONSENTS);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        workers,
        activeWorker,
        setActiveWorkerDid,
        loans,
        activeLoan,
        earnings,
        payouts,
        mandates,
        activeMandate,
        repayments,
        consents,
        simulatePayout,
        applyForLoan,
        updateMandateStatus,
        revokeConsent,
        grantConsent,
        resetAllData,
        isBackendConnected,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
