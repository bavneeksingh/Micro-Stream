-- ============================================================================
-- MicroStream PostgreSQL & YugabyteDB Schema
-- Real-Time Micro-Credit Streaming for Gig Workers
--
-- Note on Currency: All monetary amounts are stored as INTEGER / BIGINT paise
-- (1 INR = 100 paise). No floating point types are used for financial figures.
-- YugabyteDB compatibility: Standard ANSI SQL DDL, PRIMARY KEY on hash-safe IDs.
-- ============================================================================

-- Extensions (if available in PostgreSQL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if re-initializing
DROP TABLE IF EXISTS repayments CASCADE;
DROP TABLE IF EXISTS debit_instructions CASCADE;
DROP TABLE IF EXISTS payout_events CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS autopay_mandates CASCADE;
DROP TABLE IF EXISTS earnings_records CASCADE;
DROP TABLE IF EXISTS consents CASCADE;
DROP TABLE IF EXISTS worker_dids CASCADE;

-- 1. Worker Decentralized Identity (DID) & Profile
CREATE TABLE worker_dids (
    did VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    primary_platform VARCHAR(32) NOT NULL, -- 'ZOMATO', 'SWIGGY', 'UBER', etc.
    vpa VARCHAR(128) NOT NULL,              -- UPI ID e.g. ravi@okhdfcbank
    active_mandate_id VARCHAR(64),
    credit_tier VARCHAR(16) NOT NULL DEFAULT 'STANDARD_B', -- PRIME_A, STANDARD_B, EMERGING_C, UNRATED
    risk_score INT NOT NULL DEFAULT 70 CHECK (risk_score BETWEEN 0 AND 100),
    public_key TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Consents (Data Sharing & Debit Permissions)
CREATE TABLE consents (
    id VARCHAR(64) PRIMARY KEY,
    did VARCHAR(64) NOT NULL REFERENCES worker_dids(did) ON DELETE CASCADE,
    grantee VARCHAR(128) NOT NULL, -- e.g. 'did:drunix:lender:kotak-micro'
    scope VARCHAR(256) NOT NULL,   -- Comma-separated or JSON array of scopes
    purpose TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REVOKED, EXPIRED
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    tx_hash VARCHAR(128),
    block_number BIGINT
);

CREATE INDEX idx_consents_did_grantee ON consents(did, grantee);

-- 3. UPI AutoPay Variable e-Mandates
CREATE TABLE autopay_mandates (
    mandate_id VARCHAR(64) PRIMARY KEY,
    umrn VARCHAR(32) NOT NULL UNIQUE,     -- Unique Mandate Reference Number (NPCI)
    did VARCHAR(64) NOT NULL REFERENCES worker_dids(did) ON DELETE CASCADE,
    vpa VARCHAR(128) NOT NULL,
    bank_account_masked VARCHAR(32) NOT NULL,
    ifsc_code VARCHAR(16) NOT NULL,
    max_amount_paise BIGINT NOT NULL CHECK (max_amount_paise > 0), -- Cap in paise (e.g. ₹2,000 = 200,000 paise)
    frequency VARCHAR(32) NOT NULL DEFAULT 'AS_PRESENTED',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PENDING_AUTH, PAUSED, REVOKED
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    authorized_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mandates_did ON autopay_mandates(did);

-- 4. Micro-Loans
CREATE TABLE loans (
    loan_id VARCHAR(64) PRIMARY KEY,
    did VARCHAR(64) NOT NULL REFERENCES worker_dids(did) ON DELETE CASCADE,
    lender_id VARCHAR(64) NOT NULL,
    lender_name VARCHAR(128) NOT NULL,
    principal_paise BIGINT NOT NULL CHECK (principal_paise > 0),
    outstanding_balance_paise BIGINT NOT NULL CHECK (outstanding_balance_paise >= 0),
    interest_rate_bps INT NOT NULL DEFAULT 1200 CHECK (interest_rate_bps >= 0), -- 1200 bps = 12.00%
    deduction_rate_bps INT NOT NULL DEFAULT 500 CHECK (deduction_rate_bps > 0 AND deduction_rate_bps <= 5000), -- 500 = 5.00%
    daily_cap_paise BIGINT NOT NULL DEFAULT 0, -- 0 = no cap, >0 = maximum daily deduction
    total_repaid_paise BIGINT NOT NULL DEFAULT 0 CHECK (total_repaid_paise >= 0),
    mandate_id VARCHAR(64) REFERENCES autopay_mandates(mandate_id),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', -- PENDING_APPROVAL, ACTIVE, SETTLED, DEFAULTED, CANCELLED
    purpose VARCHAR(256) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMPTZ,
    tx_hash VARCHAR(128)
);

CREATE INDEX idx_loans_did_status ON loans(did, status);

-- 5. Daily Earnings Logged on Ledger (Oracle Input)
CREATE TABLE earnings_records (
    id VARCHAR(64) PRIMARY KEY,
    did VARCHAR(64) NOT NULL REFERENCES worker_dids(did) ON DELETE CASCADE,
    platform_id VARCHAR(32) NOT NULL,
    date DATE NOT NULL,
    gross_earnings_paise BIGINT NOT NULL CHECK (gross_earnings_paise >= 0),
    net_earnings_paise BIGINT NOT NULL CHECK (net_earnings_paise >= 0),
    orders_or_trips_count INT DEFAULT 0,
    reference VARCHAR(128) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'RECORDED',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    block_number BIGINT,
    tx_hash VARCHAR(128),
    CONSTRAINT uq_did_date_ref UNIQUE (did, date, reference)
);

CREATE INDEX idx_earnings_did_date ON earnings_records(did, date DESC);

-- 6. Payout Events (Detected Bank Transfers / Webhook Notifications)
CREATE TABLE payout_events (
    id VARCHAR(64) PRIMARY KEY,
    did VARCHAR(64) NOT NULL REFERENCES worker_dids(did) ON DELETE CASCADE,
    platform_id VARCHAR(32) NOT NULL,
    amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
    reference VARCHAR(128) NOT NULL UNIQUE,
    payout_date DATE NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(24) NOT NULL DEFAULT 'DETECTED', -- DETECTED, STREAM_TRIGGERED, COMPLETED, SKIPPED
    skip_reason VARCHAR(128),
    processed_deduction_id VARCHAR(64)
);

CREATE INDEX idx_payouts_did_date ON payout_events(did, payout_date DESC);

-- 7. Debit Instructions (Created by Drunix Deduction Smart Contract)
CREATE TABLE debit_instructions (
    instruction_id VARCHAR(64) PRIMARY KEY,
    loan_id VARCHAR(64) NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    did VARCHAR(64) NOT NULL REFERENCES worker_dids(did) ON DELETE CASCADE,
    payout_id VARCHAR(64) REFERENCES payout_events(id),
    amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED, RETRYING, CARRIED_FORWARD
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    upi_ref VARCHAR(128),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    failure_reason VARCHAR(256),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMPTZ,
    tx_hash VARCHAR(128)
);

CREATE INDEX idx_debits_loan ON debit_instructions(loan_id);
CREATE INDEX idx_debits_idempotency ON debit_instructions(idempotency_key);

-- 8. Repayments (Settled Debits Credited to Loan)
CREATE TABLE repayments (
    id VARCHAR(64) PRIMARY KEY,
    loan_id VARCHAR(64) NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    debit_instruction_id VARCHAR(64) NOT NULL REFERENCES debit_instructions(instruction_id),
    did VARCHAR(64) NOT NULL REFERENCES worker_dids(did) ON DELETE CASCADE,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    previous_balance_paise BIGINT NOT NULL,
    new_outstanding_balance_paise BIGINT NOT NULL CHECK (new_outstanding_balance_paise >= 0),
    is_final_settlement BOOLEAN NOT NULL DEFAULT FALSE,
    settled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    upi_ref VARCHAR(128) NOT NULL,
    tx_hash VARCHAR(128) NOT NULL
);

CREATE INDEX idx_repayments_loan ON repayments(loan_id, settled_at DESC);
CREATE INDEX idx_repayments_did ON repayments(did);

-- ============================================================================
-- Analytical Views (YugabyteDB compatible SQL for Real-Time Underwriting)
-- ============================================================================
CREATE OR REPLACE VIEW v_worker_cashflow_metrics AS
SELECT
    er.did,
    wd.name AS worker_name,
    wd.primary_platform,
    wd.credit_tier,
    COUNT(er.id) AS total_logged_days,
    ROUND(AVG(er.gross_earnings_paise)) AS avg_daily_earnings_paise,
    ROUND(STDDEV(er.gross_earnings_paise)) AS earnings_volatility_paise,
    MIN(er.gross_earnings_paise) AS min_daily_earnings_paise,
    MAX(er.gross_earnings_paise) AS max_daily_earnings_paise,
    SUM(er.gross_earnings_paise) AS total_gross_earnings_paise,
    COALESCE(SUM(r.amount_paise), 0) AS total_repaid_to_date_paise
FROM earnings_records er
JOIN worker_dids wd ON er.did = wd.did
LEFT JOIN repayments r ON er.did = r.did
WHERE er.date >= CURRENT_DATE - INTERVAL '60 days'
GROUP BY er.did, wd.name, wd.primary_platform, wd.credit_tier;
