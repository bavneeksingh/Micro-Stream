-- ============================================================================
-- MicroStream PostgreSQL & YugabyteDB Seed Data
-- Demo gig workers, loan facilities, e-mandates, and synthetic cash flows
-- Password for all accounts: Password123!
-- ============================================================================

-- 1. Users
INSERT INTO users (id, email, password_hash, name, role) VALUES
('usr_ravi_01', 'ravi.kumar@zomato-partner.in', '$2b$10$Hwk0Wg0wosl9rsQYerVo.OGCcPjiTAiT8iY5.WVj6HPtCYZ621BuS', 'Ravi Kumar', 'WORKER'),
('usr_sunita_02', 'sunita.devi@swiggy-partner.in', '$2b$10$Hwk0Wg0wosl9rsQYerVo.OGCcPjiTAiT8iY5.WVj6HPtCYZ621BuS', 'Sunita Devi', 'WORKER'),
('usr_arif_03', 'arif.cab@uber-driver.in', '$2b$10$Hwk0Wg0wosl9rsQYerVo.OGCcPjiTAiT8iY5.WVj6HPtCYZ621BuS', 'Mohammed Arif', 'WORKER'),
('usr_priya_04', 'priya.salon@urbancompany.in', '$2b$10$Hwk0Wg0wosl9rsQYerVo.OGCcPjiTAiT8iY5.WVj6HPtCYZ621BuS', 'Priya Sharma', 'WORKER'),
('usr_vikram_05', 'vikram.rider@zepto-rider.in', '$2b$10$Hwk0Wg0wosl9rsQYerVo.OGCcPjiTAiT8iY5.WVj6HPtCYZ621BuS', 'Vikram Singh', 'WORKER'),
('usr_lender_01', 'underwriting@kotakmicro.in', '$2b$10$Hwk0Wg0wosl9rsQYerVo.OGCcPjiTAiT8iY5.WVj6HPtCYZ621BuS', 'Kotak Micro Underwriter', 'LENDER'),
('usr_admin_01', 'auditor@npci.org.in', '$2b$10$Hwk0Wg0wosl9rsQYerVo.OGCcPjiTAiT8iY5.WVj6HPtCYZ621BuS', 'NPCI Compliance Officer', 'ADMIN')
ON CONFLICT (id) DO NOTHING;

-- 2. Worker Profiles
INSERT INTO worker_profiles (id, user_id, did, phone, primary_platform, vpa, credit_tier, risk_score, public_key, status) VALUES
('wrk_ravi_01', 'usr_ravi_01', 'did:drunix:worker:ravi-kumar-01', '+91 98765 43210', 'ZOMATO', 'ravi.kumar@oksbi', 'PRIME_A', 88, '04b281f6e2c842b09a7b973ef808298192809182379182739812739182739812', 'ACTIVE'),
('wrk_sunita_02', 'usr_sunita_02', 'did:drunix:worker:sunita-devi-02', '+91 98123 45678', 'SWIGGY', 'sunita.devi@icici', 'STANDARD_B', 76, '04a9192873198273918273918273918273918273918273918273918273918273', 'ACTIVE'),
('wrk_arif_03', 'usr_arif_03', 'did:drunix:worker:arif-uber-03', '+91 97654 32109', 'UBER', 'arif.cab@paytm', 'PRIME_A', 91, '04c8172938172938172938172938172938172938172938172938172938172938', 'ACTIVE'),
('wrk_priya_04', 'usr_priya_04', 'did:drunix:worker:priya-uc-04', '+91 99887 76655', 'URBAN_COMPANY', 'priya.salon@hdfcbank', 'STANDARD_B', 72, '04d7162534152637485960718293041526374859607182930415263748596071', 'ACTIVE'),
('wrk_vikram_05', 'usr_vikram_05', 'did:drunix:worker:vikram-zepto-05', '+91 96543 21098', 'ZEPTO', 'vikram.rider@axisbank', 'EMERGING_C', 64, '04e6152433425160798a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- 3. Payment Mandates
INSERT INTO payment_mandates (id, umrn, worker_id, vpa, bank_account_masked, ifsc_code, max_amount_paise, frequency, status, start_date, end_date) VALUES
('mnd_ravi_01', 'UMRN2026ZOMATO001', 'wrk_ravi_01', 'ravi.kumar@oksbi', 'XXXX5678', 'SBIN0001234', 200000, 'AS_PRESENTED', 'ACTIVE', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '305 days'),
('mnd_sunita_02', 'UMRN2026SWIGGY002', 'wrk_sunita_02', 'sunita.devi@icici', 'XXXX9123', 'ICIC0004321', 250000, 'AS_PRESENTED', 'ACTIVE', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '305 days'),
('mnd_arif_03', 'UMRN2026UBER003', 'wrk_arif_03', 'arif.cab@paytm', 'XXXX3456', 'PYTM0123456', 300000, 'AS_PRESENTED', 'ACTIVE', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '305 days'),
('mnd_priya_04', 'UMRN2026UC004', 'wrk_priya_04', 'priya.salon@hdfcbank', 'XXXX7890', 'HDFC0005678', 250000, 'AS_PRESENTED', 'ACTIVE', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '305 days'),
('mnd_vikram_05', 'UMRN2026ZEPTO005', 'wrk_vikram_05', 'vikram.rider@axisbank', 'XXXX2345', 'UTIB0009876', 150000, 'AS_PRESENTED', 'ACTIVE', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '305 days')
ON CONFLICT (id) DO NOTHING;

-- 4. Active Micro-Loans
INSERT INTO loans (id, worker_id, lender_id, lender_name, principal_paise, outstanding_balance_paise, interest_rate_bps, deduction_rate_bps, daily_cap_paise, total_repaid_paise, mandate_id, status, purpose, issued_at) VALUES
('LN-2026-001', 'wrk_ravi_01', 'usr_lender_01', 'Kotak Microfinance', 1000000, 875500, 1200, 500, 20000, 124500, 'mnd_ravi_01', 'ACTIVE', 'EV Two-Wheeler Battery Replacement', CURRENT_TIMESTAMP - INTERVAL '30 days'),
('LN-2026-002', 'wrk_sunita_02', 'usr_lender_01', 'Kotak Microfinance', 1500000, 1362000, 1250, 600, 25000, 138000, 'mnd_sunita_02', 'ACTIVE', 'Smartphone upgrade for delivery dispatch', CURRENT_TIMESTAMP - INTERVAL '20 days'),
('LN-2026-003', 'wrk_arif_03', 'usr_lender_01', 'Kotak Microfinance', 2500000, 2280000, 1150, 500, 30000, 220000, 'mnd_arif_03', 'ACTIVE', 'CNG kit overhaul & vehicle maintenance', CURRENT_TIMESTAMP - INTERVAL '15 days')
ON CONFLICT (id) DO NOTHING;

-- 5. Consents
INSERT INTO consent_grants (id, worker_id, grantee, scope, purpose, status, granted_at, expires_at) VALUES
('cns_01', 'wrk_ravi_01', 'did:drunix:lender:kotak-micro', 'EARNINGS_READ,CREDIT_ASSESSMENT,REPAYMENT_DEBIT', 'MicroStream real-time streaming underwriting and daily deduction', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '60 days', CURRENT_TIMESTAMP + INTERVAL '305 days'),
('cns_02', 'wrk_sunita_02', 'did:drunix:lender:kotak-micro', 'EARNINGS_READ,CREDIT_ASSESSMENT,REPAYMENT_DEBIT', 'MicroStream streaming loan', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '60 days', CURRENT_TIMESTAMP + INTERVAL '305 days'),
('cns_03', 'wrk_arif_03', 'did:drunix:lender:kotak-micro', 'EARNINGS_READ,CREDIT_ASSESSMENT,REPAYMENT_DEBIT', 'Vehicle maintenance micro-loan underwriting', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '60 days', CURRENT_TIMESTAMP + INTERVAL '305 days'),
('cns_04', 'wrk_priya_04', 'did:drunix:lender:kotak-micro', 'EARNINGS_READ,CREDIT_ASSESSMENT,REPAYMENT_DEBIT', 'Working capital evaluation', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '60 days', CURRENT_TIMESTAMP + INTERVAL '305 days')
ON CONFLICT (id) DO NOTHING;
