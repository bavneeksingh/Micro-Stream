import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { config } from '../config.js';

export async function seedDatabase(force: boolean = false): Promise<void> {
  const usersCheck = await db.query('SELECT COUNT(*) as count FROM users');
  const count = parseInt(usersCheck.rows[0]?.count || '0', 10);
  if (count > 0 && !force) {
    console.log('[Seed] Database already contains data. Skipping seed.');
    return;
  }

  console.log('[Seed] Starting database seeding with synthetic demo data...');

  // Hash demo password
  const passwordHash = await bcrypt.hash('Password123!', config.bcryptSaltRounds);

  // 1. Seed Users (WORKER, LENDER, ADMIN)
  const users = [
    { id: 'usr_ravi_01', email: 'ravi.kumar@zomato-partner.in', name: 'Ravi Kumar', role: 'WORKER' },
    { id: 'usr_sunita_02', email: 'sunita.devi@swiggy-partner.in', name: 'Sunita Devi', role: 'WORKER' },
    { id: 'usr_arif_03', email: 'arif.cab@uber-driver.in', name: 'Mohammed Arif', role: 'WORKER' },
    { id: 'usr_priya_04', email: 'priya.salon@urbancompany.in', name: 'Priya Sharma', role: 'WORKER' },
    { id: 'usr_vikram_05', email: 'vikram.rider@zepto-rider.in', name: 'Vikram Singh', role: 'WORKER' },
    { id: 'usr_lender_01', email: 'underwriting@kotakmicro.in', name: 'Kotak Micro Underwriter', role: 'LENDER' },
    { id: 'usr_admin_01', email: 'auditor@npci.org.in', name: 'NPCI Compliance Officer', role: 'ADMIN' },
  ];

  for (const u of users) {
    await db.query(
      `INSERT INTO users (id, email, password_hash, name, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
      [u.id, u.email, passwordHash, u.name, u.role]
    );
  }

  // 2. Seed Worker Profiles
  const workers = [
    {
      id: 'wrk_ravi_01',
      userId: 'usr_ravi_01',
      did: 'did:drunix:worker:ravi-kumar-01',
      phone: '+91 98765 43210',
      platform: 'ZOMATO',
      vpa: 'ravi.kumar@oksbi',
      tier: 'PRIME_A',
      riskScore: 88,
      publicKey: '04b281f6e2c842b09a7b973ef808298192809182379182739812739182739812',
    },
    {
      id: 'wrk_sunita_02',
      userId: 'usr_sunita_02',
      did: 'did:drunix:worker:sunita-devi-02',
      phone: '+91 98123 45678',
      platform: 'SWIGGY',
      vpa: 'sunita.devi@icici',
      tier: 'STANDARD_B',
      riskScore: 76,
      publicKey: '04a9192873198273918273918273918273918273918273918273918273918273',
    },
    {
      id: 'wrk_arif_03',
      userId: 'usr_arif_03',
      did: 'did:drunix:worker:arif-uber-03',
      phone: '+91 97654 32109',
      platform: 'UBER',
      vpa: 'arif.cab@paytm',
      tier: 'PRIME_A',
      riskScore: 91,
      publicKey: '04c8172938172938172938172938172938172938172938172938172938172938',
    },
    {
      id: 'wrk_priya_04',
      userId: 'usr_priya_04',
      did: 'did:drunix:worker:priya-uc-04',
      phone: '+91 99887 76655',
      platform: 'URBAN_COMPANY',
      vpa: 'priya.salon@hdfcbank',
      tier: 'STANDARD_B',
      riskScore: 72,
      publicKey: '04d7162534152637485960718293041526374859607182930415263748596071',
    },
    {
      id: 'wrk_vikram_05',
      userId: 'usr_vikram_05',
      did: 'did:drunix:worker:vikram-zepto-05',
      phone: '+91 96543 21098',
      platform: 'ZEPTO',
      vpa: 'vikram.rider@axisbank',
      tier: 'EMERGING_C',
      riskScore: 64,
      publicKey: '04e6152433425160798a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e',
    },
  ];

  for (const w of workers) {
    await db.query(
      `INSERT INTO worker_profiles (id, user_id, did, phone, primary_platform, vpa, credit_tier, risk_score, public_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [w.id, w.userId, w.did, w.phone, w.platform, w.vpa, w.tier, w.riskScore, w.publicKey]
    );
  }

  // 3. Seed Payment Mandates
  const mandates = [
    {
      id: 'mnd_ravi_01',
      umrn: 'UMRN2026ZOMATO001',
      workerId: 'wrk_ravi_01',
      vpa: 'ravi.kumar@oksbi',
      bankMasked: 'XXXX5678',
      ifsc: 'SBIN0001234',
      maxPaise: 200000,
      start: '2026-09-01',
      end: '2027-08-31',
    },
    {
      id: 'mnd_sunita_02',
      umrn: 'UMRN2026SWIGGY002',
      workerId: 'wrk_sunita_02',
      vpa: 'sunita.devi@icici',
      bankMasked: 'XXXX9123',
      ifsc: 'ICIC0004321',
      maxPaise: 250000,
      start: '2026-09-05',
      end: '2027-09-04',
    },
    {
      id: 'mnd_arif_03',
      umrn: 'UMRN2026UBER003',
      workerId: 'wrk_arif_03',
      vpa: 'arif.cab@paytm',
      bankMasked: 'XXXX3456',
      ifsc: 'PYTM0123456',
      maxPaise: 300000,
      start: '2026-09-10',
      end: '2027-09-09',
    },
    {
      id: 'mnd_priya_04',
      umrn: 'UMRN2026UC004',
      workerId: 'wrk_priya_04',
      vpa: 'priya.salon@hdfcbank',
      bankMasked: 'XXXX7890',
      ifsc: 'HDFC0005678',
      maxPaise: 250000,
      start: '2026-09-15',
      end: '2027-09-14',
    },
    {
      id: 'mnd_vikram_05',
      umrn: 'UMRN2026ZEPTO005',
      workerId: 'wrk_vikram_05',
      vpa: 'vikram.rider@axisbank',
      bankMasked: 'XXXX2345',
      ifsc: 'UTIB0009876',
      maxPaise: 150000,
      start: '2026-09-20',
      end: '2027-09-19',
    },
  ];

  for (const m of mandates) {
    await db.query(
      `INSERT INTO payment_mandates (id, umrn, worker_id, vpa, bank_account_masked, ifsc_code, max_amount_paise, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [m.id, m.umrn, m.workerId, m.vpa, m.bankMasked, m.ifsc, m.maxPaise, m.start, m.end]
    );
  }

  // 4. Seed Active Loans
  const loans = [
    {
      id: 'LN-2026-001',
      workerId: 'wrk_ravi_01',
      lenderId: 'usr_lender_01',
      lenderName: 'Kotak Microfinance',
      principalPaise: 1000000, // ₹10,000
      outstandingPaise: 875500, // ₹8,755 remaining
      interestRateBps: 1200,
      deductionRateBps: 500, // 5%
      dailyCapPaise: 20000,
      totalRepaidPaise: 124500,
      mandateId: 'mnd_ravi_01',
      status: 'ACTIVE',
      purpose: 'EV Two-Wheeler Battery Replacement',
    },
    {
      id: 'LN-2026-002',
      workerId: 'wrk_sunita_02',
      lenderId: 'usr_lender_01',
      lenderName: 'Kotak Microfinance',
      principalPaise: 1500000,
      outstandingPaise: 1362000,
      interestRateBps: 1250,
      deductionRateBps: 600, // 6%
      dailyCapPaise: 25000,
      totalRepaidPaise: 138000,
      mandateId: 'mnd_sunita_02',
      status: 'ACTIVE',
      purpose: 'Smartphone upgrade for delivery dispatch',
    },
    {
      id: 'LN-2026-003',
      workerId: 'wrk_arif_03',
      lenderId: 'usr_lender_01',
      lenderName: 'Kotak Microfinance',
      principalPaise: 2500000,
      outstandingPaise: 2280000,
      interestRateBps: 1150,
      deductionRateBps: 500,
      dailyCapPaise: 30000,
      totalRepaidPaise: 220000,
      mandateId: 'mnd_arif_03',
      status: 'ACTIVE',
      purpose: 'CNG kit overhaul & vehicle maintenance',
    },
  ];

  for (const l of loans) {
    await db.query(
      `INSERT INTO loans (id, worker_id, lender_id, lender_name, principal_paise, outstanding_balance_paise, interest_rate_bps, deduction_rate_bps, daily_cap_paise, total_repaid_paise, mandate_id, status, purpose, approved_by, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [l.id, l.workerId, l.lenderId, l.lenderName, l.principalPaise, l.outstandingPaise, l.interestRateBps, l.deductionRateBps, l.dailyCapPaise, l.totalRepaidPaise, l.mandateId, l.status, l.purpose, l.lenderId]
    );
  }

  // 5. Seed Consent Grants
  const consents = [
    {
      id: 'cns_01',
      workerId: 'wrk_ravi_01',
      grantee: 'Kotak Microfinance',
      scope: 'EARNINGS_READ,REPAYMENT_DEBIT,CREDIT_ASSESSMENT',
      purpose: 'MicroStream real-time streaming underwriting and automated daily deduction',
      expiresAt: '2027-08-31T23:59:59.000Z',
    },
    {
      id: 'cns_02',
      workerId: 'wrk_sunita_02',
      grantee: 'Kotak Microfinance',
      scope: 'EARNINGS_READ,REPAYMENT_DEBIT',
      purpose: 'Streaming loan underwriting and daily recovery',
      expiresAt: '2027-09-04T23:59:59.000Z',
    },
    {
      id: 'cns_03',
      workerId: 'wrk_arif_03',
      grantee: 'Kotak Microfinance',
      scope: 'EARNINGS_READ,REPAYMENT_DEBIT',
      purpose: 'Cash flow credit assessment',
      expiresAt: '2027-09-09T23:59:59.000Z',
    },
    {
      id: 'cns_04',
      workerId: 'wrk_priya_04',
      grantee: 'Kotak Microfinance',
      scope: 'EARNINGS_READ',
      purpose: 'Income verification for credit limit evaluation',
      expiresAt: '2027-09-14T23:59:59.000Z',
    },
  ];

  for (const c of consents) {
    await db.query(
      `INSERT INTO consent_grants (id, worker_id, grantee, scope, purpose, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)
       ON CONFLICT (id) DO NOTHING`,
      [c.id, c.workerId, c.grantee, c.scope, c.purpose, c.expiresAt]
    );
  }

  // 6. Seed Earnings Records (14 days for each worker)
  for (const w of workers) {
    for (let i = 14; i >= 1; i--) {
      const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      const baseRupees = w.tier === 'PRIME_A' ? 1400 : 1100;
      const variation = Math.sin(i * 1.5) * 350 + (i % 3 === 0 ? 300 : -150);
      const grossPaise = Math.round(Math.max(400, baseRupees + variation) * 100);
      const netPaise = Math.round(grossPaise * 0.92);
      const ordersCount = Math.max(1, Math.round(grossPaise / 7000));
      const ref = `${w.platform}-SETTLE-${w.id}-${date.replace(/-/g, '')}`;

      await db.query(
        `INSERT INTO earnings_records (id, worker_id, platform_id, date, gross_earnings_paise, net_earnings_paise, orders_count, reference, status, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'RECORDED', $9)
         ON CONFLICT (reference) DO NOTHING`,
        [
          `ern_${w.id}_${i}`,
          w.id,
          w.platform.toLowerCase() + '-in',
          date,
          grossPaise,
          netPaise,
          ordersCount,
          ref,
          new Date(Date.now() - i * 86400000).toISOString(),
        ]
      );
    }
  }

  // 7. Seed Sample Debit Instructions and Repayments for Ravi Kumar
  const repaymentsData = [
    { id: 'rep_r_01', insId: 'ins_r_01', amount: 6750, prevBal: 910000, newBal: 903250, daysAgo: 5, upi: 'UPI/20261019/9102837101' },
    { id: 'rep_r_02', insId: 'ins_r_02', amount: 7750, prevBal: 903250, newBal: 895500, daysAgo: 4, upi: 'UPI/20261020/9102837102' },
    { id: 'rep_r_03', insId: 'ins_r_03', amount: 4250, prevBal: 895500, newBal: 891250, daysAgo: 3, upi: 'UPI/20261021/9102837103' },
    { id: 'rep_r_04', insId: 'ins_r_04', amount: 8750, prevBal: 891250, newBal: 882500, daysAgo: 2, upi: 'UPI/20261022/9102837104' },
    { id: 'rep_r_05', insId: 'ins_r_05', amount: 7000, prevBal: 882500, newBal: 875500, daysAgo: 1, upi: 'UPI/20261023/9102837105' },
  ];

  for (const r of repaymentsData) {
    const settledTime = new Date(Date.now() - r.daysAgo * 86400000).toISOString();
    // Debit instruction
    await db.query(
      `INSERT INTO debit_instructions (id, loan_id, worker_id, amount_paise, status, idempotency_key, upi_ref, executed_at)
       VALUES ($1, $2, $3, $4, 'SUCCESS', $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [r.insId, 'LN-2026-001', 'wrk_ravi_01', r.amount, `IDEM-${r.insId}`, r.upi, settledTime]
    );

    // Repayment
    await db.query(
      `INSERT INTO repayments (id, loan_id, debit_instruction_id, worker_id, amount_paise, previous_balance_paise, new_outstanding_balance_paise, is_final_settlement, settled_at, upi_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [r.id, 'LN-2026-001', r.insId, 'wrk_ravi_01', r.amount, r.prevBal, r.newBal, settledTime, r.upi]
    );
  }

  // 8. Seed Sample Audit Events
  const auditLogs = [
    {
      id: 'aud_01',
      userId: 'usr_ravi_01',
      action: 'MANDATE_AUTHORIZED',
      entityType: 'MANDATE',
      entityId: 'mnd_ravi_01',
      details: 'UPI AutoPay mandate authorized for max ₹2,000 / day',
    },
    {
      id: 'aud_02',
      userId: 'usr_lender_01',
      action: 'LOAN_APPROVED',
      entityType: 'LOAN',
      entityId: 'LN-2026-001',
      details: 'Micro-loan LN-2026-001 approved for ₹10,000 at 12% p.a. and 5% streaming deduction',
    },
    {
      id: 'aud_03',
      userId: 'usr_ravi_01',
      action: 'CONSENT_GRANTED',
      entityType: 'CONSENT',
      entityId: 'cns_01',
      details: 'Consent granted to Kotak Microfinance for earnings read and repayment debit',
    },
  ];

  for (const a of auditLogs) {
    await db.query(
      `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [a.id, a.userId, a.action, a.entityType, a.entityId, a.details]
    );
  }

  console.log('[Seed] Database seeding completed successfully.');
}
