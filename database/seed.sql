-- ============================================================================
-- MicroStream Synthetic Seed Data
-- Realistic Indian Gig Economy Workers, Mandates, Earnings, Loans & Repayments
-- All amounts in integer paise (1 INR = 100 paise)
-- ============================================================================

-- 1. Workers / DIDs
INSERT INTO worker_dids (did, user_id, name, phone, primary_platform, vpa, credit_tier, risk_score, public_key, status)
VALUES
('did:drunix:worker:ravi-kumar-01', 'usr_ravi_01', 'Ravi Kumar', '+91 98765 43210', 'ZOMATO', 'ravi.kumar@oksbi', 'PRIME_A', 88, '04b281f6e2c842b09a7b973ef808298192809182379182739812739182739812', 'ACTIVE'),
('did:drunix:worker:sunita-devi-02', 'usr_sunita_02', 'Sunita Devi', '+91 98123 45678', 'SWIGGY', 'sunita.devi@icici', 'STANDARD_B', 76, '04a9192873198273918273918273918273918273918273918273918273918273', 'ACTIVE'),
('did:drunix:worker:arif-uber-03', 'usr_arif_03', 'Mohammed Arif', '+91 97654 32109', 'UBER', 'arif.cab@paytm', 'PRIME_A', 91, '04c8172938172938172938172938172938172938172938172938172938172938', 'ACTIVE'),
('did:drunix:worker:priya-uc-04', 'usr_priya_04', 'Priya Sharma', '+91 99887 76655', 'URBAN_COMPANY', 'priya.salon@hdfcbank', 'STANDARD_B', 72, '04d7162534152637485960718293041526374859607182930415263748596071', 'ACTIVE'),
('did:drunix:worker:vikram-zepto-05', 'usr_vikram_05', 'Vikram Singh', '+91 96543 21098', 'ZEPTO', 'vikram.rider@axisbank', 'EMERGING_C', 64, '04e6152433425160798a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e', 'ACTIVE');

-- 2. Consents
INSERT INTO consents (id, did, grantee, scope, purpose, status, granted_at, expires_at, tx_hash, block_number)
VALUES
('cns_01', 'did:drunix:worker:ravi-kumar-01', 'did:drunix:lender:kotak-micro', 'EARNINGS_READ,REPAYMENT_DEBIT', 'MicroStream real-time streaming underwriting and daily deduction', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '335 days', '0x7f8a...01', 1042),
('cns_02', 'did:drunix:worker:ravi-kumar-01', 'did:drunix:platform:zomato', 'EARNINGS_WRITE', 'Logging daily delivery earnings on Drunix ledger', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '335 days', '0x7f8a...02', 1043),
('cns_03', 'did:drunix:worker:sunita-devi-02', 'did:drunix:lender:kotak-micro', 'EARNINGS_READ,REPAYMENT_DEBIT', 'MicroStream streaming loan', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP + INTERVAL '340 days', '0x7f8a...03', 1088),
('cns_04', 'did:drunix:worker:arif-uber-03', 'did:drunix:lender:bajaj-fin', 'EARNINGS_READ,REPAYMENT_DEBIT', 'Vehicle maintenance micro-loan underwriting', 'ACTIVE', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP + INTERVAL '345 days', '0x7f8a...04', 1130);

-- 3. UPI AutoPay Mandates
INSERT INTO autopay_mandates (mandate_id, umrn, did, vpa, bank_account_masked, ifsc_code, max_amount_paise, frequency, status, start_date, end_date)
VALUES
('mnd_ravi_01', 'UMRN2026ZOMATO001', 'did:drunix:worker:ravi-kumar-01', 'ravi.kumar@oksbi', 'XXXX5678', 'SBIN0001234', 200000, 'AS_PRESENTED', 'ACTIVE', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '335 days'),
('mnd_sunita_02', 'UMRN2026SWIGGY002', 'did:drunix:worker:sunita-devi-02', 'sunita.devi@icici', 'XXXX9123', 'ICIC0004321', 250000, 'AS_PRESENTED', 'ACTIVE', CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE + INTERVAL '340 days'),
('mnd_arif_03', 'UMRN2026UBER003', 'did:drunix:worker:arif-uber-03', 'arif.cab@paytm', 'XXXX3456', 'PYTM0123456', 300000, 'AS_PRESENTED', 'ACTIVE', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '345 days'),
('mnd_priya_04', 'UMRN2026UC004', 'did:drunix:worker:priya-uc-04', 'priya.salon@hdfcbank', 'XXXX7890', 'HDFC0005678', 250000, 'AS_PRESENTED', 'ACTIVE', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '350 days'),
('mnd_vikram_05', 'UMRN2026ZEPTO005', 'did:drunix:worker:vikram-zepto-05', 'vikram.rider@axisbank', 'XXXX2345', 'UTIB0009876', 150000, 'AS_PRESENTED', 'ACTIVE', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '355 days');

-- Update worker active mandate pointer
UPDATE worker_dids SET active_mandate_id = 'mnd_ravi_01' WHERE did = 'did:drunix:worker:ravi-kumar-01';
UPDATE worker_dids SET active_mandate_id = 'mnd_sunita_02' WHERE did = 'did:drunix:worker:sunita-devi-02';
UPDATE worker_dids SET active_mandate_id = 'mnd_arif_03' WHERE did = 'did:drunix:worker:arif-uber-03';
UPDATE worker_dids SET active_mandate_id = 'mnd_priya_04' WHERE did = 'did:drunix:worker:priya-uc-04';
UPDATE worker_dids SET active_mandate_id = 'mnd_vikram_05' WHERE did = 'did:drunix:worker:vikram-zepto-05';

-- 4. Active Micro-Loans (in integer paise)
-- Ravi: ₹10,000 principal (1,000,000 paise), 5.00% deduction rate (500 bps), daily cap ₹200 (20,000 paise)
-- Repaid ₹1,245 (124,500 paise) so far, outstanding ₹8,755 (875,500 paise)
INSERT INTO loans (loan_id, did, lender_id, lender_name, principal_paise, outstanding_balance_paise, interest_rate_bps, deduction_rate_bps, daily_cap_paise, total_repaid_paise, mandate_id, status, purpose, issued_at, tx_hash)
VALUES
('LN-2026-001', 'did:drunix:worker:ravi-kumar-01', 'lender-kotak-micro', 'Kotak Microfinance', 1000000, 875500, 1200, 500, 20000, 124500, 'mnd_ravi_01', 'ACTIVE', 'EV Two-Wheeler Battery Replacement', CURRENT_TIMESTAMP - INTERVAL '15 days', '0x9923...01'),
('LN-2026-002', 'did:drunix:worker:sunita-devi-02', 'lender-kotak-micro', 'Kotak Microfinance', 1500000, 1362000, 1250, 600, 25000, 138000, 'mnd_sunita_02', 'ACTIVE', 'Smartphone upgrade for delivery dispatch', CURRENT_TIMESTAMP - INTERVAL '10 days', '0x9923...02'),
('LN-2026-003', 'did:drunix:worker:arif-uber-03', 'lender-bajaj-fin', 'Bajaj Finserv Micro', 2500000, 2280000, 1150, 500, 30000, 220000, 'mnd_arif_03', 'ACTIVE', 'CNG kit overhaul & vehicle maintenance', CURRENT_TIMESTAMP - INTERVAL '8 days', '0x9923...03');

-- 5. Daily Earnings History (Past 10 days for Ravi Kumar)
INSERT INTO earnings_records (id, did, platform_id, date, gross_earnings_paise, net_earnings_paise, orders_or_trips_count, reference, status, recorded_at, block_number)
VALUES
('ern_r_01', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', CURRENT_DATE - INTERVAL '10 days', 125000, 115000, 18, 'ZOM-SETTLE-010', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '10 days', 2001),
('ern_r_02', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', CURRENT_DATE - INTERVAL '9 days', 142000, 130000, 21, 'ZOM-SETTLE-009', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '9 days', 2050),
('ern_r_03', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', CURRENT_DATE - INTERVAL '8 days', 98000, 90000, 14, 'ZOM-SETTLE-008', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '8 days', 2110),
('ern_r_04', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', CURRENT_DATE - INTERVAL '7 days', 165000, 152000, 24, 'ZOM-SETTLE-007', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '7 days', 2180),
('ern_r_05', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', CURRENT_DATE - INTERVAL '6 days', 110000, 102000, 16, 'ZOM-SETTLE-006', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '6 days', 2240),
('ern_r_06', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', CURRENT_DATE - INTERVAL '5 days', 135000, 125000, 19, 'ZOM-SETTLE-005', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '5 days', 2300),
('ern_r_07', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', CURRENT_DATE - INTERVAL '4 days', 155000, 142000, 22, 'ZOM-SETTLE-004', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '4 days', 2360),
('ern_r_08', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', CURRENT_DATE - INTERVAL '3 days', 85000, 78000, 12, 'ZOM-SETTLE-003', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '3 days', 2410),
('ern_r_09', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', CURRENT_DATE - INTERVAL '2 days', 175000, 160000, 25, 'ZOM-SETTLE-002', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '2 days', 2470),
('ern_r_10', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', CURRENT_DATE - INTERVAL '1 days', 140000, 130000, 20, 'ZOM-SETTLE-001', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '1 days', 2530);

-- Sunita Devi earnings
INSERT INTO earnings_records (id, did, platform_id, date, gross_earnings_paise, net_earnings_paise, orders_or_trips_count, reference, status, recorded_at, block_number)
VALUES
('ern_s_01', 'did:drunix:worker:sunita-devi-02', 'swiggy-in', CURRENT_DATE - INTERVAL '3 days', 180000, 165000, 26, 'SWG-SETTLE-003', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '3 days', 2415),
('ern_s_02', 'did:drunix:worker:sunita-devi-02', 'swiggy-in', CURRENT_DATE - INTERVAL '2 days', 210000, 195000, 30, 'SWG-SETTLE-002', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '2 days', 2475),
('ern_s_03', 'did:drunix:worker:sunita-devi-02', 'swiggy-in', CURRENT_DATE - INTERVAL '1 days', 190000, 175000, 27, 'SWG-SETTLE-001', 'RECORDED', CURRENT_TIMESTAMP - INTERVAL '1 days', 2535);

-- 6. Payout Events & Corresponding Repayments
INSERT INTO payout_events (id, did, platform_id, amount_paise, reference, payout_date, detected_at, status, processed_deduction_id)
VALUES
('pay_r_01', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', 135000, 'ZOM-BANK-TX-551', CURRENT_DATE - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days', 'COMPLETED', 'dbt_r_01'),
('pay_r_02', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', 155000, 'ZOM-BANK-TX-552', CURRENT_DATE - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days', 'COMPLETED', 'dbt_r_02'),
('pay_r_03', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', 85000, 'ZOM-BANK-TX-553', CURRENT_DATE - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days', 'COMPLETED', 'dbt_r_03'),
('pay_r_04', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', 175000, 'ZOM-BANK-TX-554', CURRENT_DATE - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', 'COMPLETED', 'dbt_r_04'),
('pay_r_05', 'did:drunix:worker:ravi-kumar-01', 'zomato-in', 140000, 'ZOM-BANK-TX-555', CURRENT_DATE - INTERVAL '1 days', CURRENT_TIMESTAMP - INTERVAL '1 days', 'COMPLETED', 'dbt_r_05');

-- 7. Debit Instructions
INSERT INTO debit_instructions (instruction_id, loan_id, did, payout_id, amount_paise, status, idempotency_key, upi_ref, retry_count, created_at, executed_at, tx_hash)
VALUES
('dbt_r_01', 'LN-2026-001', 'did:drunix:worker:ravi-kumar-01', 'pay_r_01', 6750, 'SUCCESS', 'IDEMP-DEBIT-R-01', 'UPI/20261019/9102837101', 0, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days', '0xaa11...01'),
('dbt_r_02', 'LN-2026-001', 'did:drunix:worker:ravi-kumar-01', 'pay_r_02', 7750, 'SUCCESS', 'IDEMP-DEBIT-R-02', 'UPI/20261020/9102837102', 0, CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days', '0xaa11...02'),
('dbt_r_03', 'LN-2026-001', 'did:drunix:worker:ravi-kumar-01', 'pay_r_03', 4250, 'SUCCESS', 'IDEMP-DEBIT-R-03', 'UPI/20261021/9102837103', 0, CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days', '0xaa11...03'),
('dbt_r_04', 'LN-2026-001', 'did:drunix:worker:ravi-kumar-01', 'pay_r_04', 8750, 'SUCCESS', 'IDEMP-DEBIT-R-04', 'UPI/20261022/9102837104', 0, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', '0xaa11...04'),
('dbt_r_05', 'LN-2026-001', 'did:drunix:worker:ravi-kumar-01', 'pay_r_05', 7000, 'SUCCESS', 'IDEMP-DEBIT-R-05', 'UPI/20261023/9102837105', 0, CURRENT_TIMESTAMP - INTERVAL '1 days', CURRENT_TIMESTAMP - INTERVAL '1 days', '0xaa11...05');

-- 8. Repayments (Deductions Settled & Applied to Loan)
INSERT INTO repayments (id, loan_id, debit_instruction_id, did, amount_paise, previous_balance_paise, new_outstanding_balance_paise, is_final_settlement, settled_at, upi_ref, tx_hash)
VALUES
('rep_r_01', 'LN-2026-001', 'dbt_r_01', 'did:drunix:worker:ravi-kumar-01', 6750, 910000, 903250, FALSE, CURRENT_TIMESTAMP - INTERVAL '5 days', 'UPI/20261019/9102837101', '0xbb22...01'),
('rep_r_02', 'LN-2026-001', 'dbt_r_02', 'did:drunix:worker:ravi-kumar-01', 7750, 903250, 895500, FALSE, CURRENT_TIMESTAMP - INTERVAL '4 days', 'UPI/20261020/9102837102', '0xbb22...02'),
('rep_r_03', 'LN-2026-001', 'dbt_r_03', 'did:drunix:worker:ravi-kumar-01', 4250, 895500, 891250, FALSE, CURRENT_TIMESTAMP - INTERVAL '3 days', 'UPI/20261021/9102837103', '0xbb22...03'),
('rep_r_04', 'LN-2026-001', 'dbt_r_04', 'did:drunix:worker:ravi-kumar-01', 8750, 891250, 882500, FALSE, CURRENT_TIMESTAMP - INTERVAL '2 days', 'UPI/20261022/9102837104', '0xbb22...04'),
('rep_r_05', 'LN-2026-001', 'dbt_r_05', 'did:drunix:worker:ravi-kumar-01', 7000, 882500, 875500, FALSE, CURRENT_TIMESTAMP - INTERVAL '1 days', 'UPI/20261023/9102837105', '0xbb22...05');
