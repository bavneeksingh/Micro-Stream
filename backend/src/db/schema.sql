-- ============================================================================
-- MicroStream PostgreSQL & YugabyteDB Schema
-- All monetary amounts stored as BIGINT paise (1 INR = 100 paise)
-- ============================================================================

-- 1. Users Table (WORKER, LENDER, ADMIN)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(128) NOT NULL,
    role VARCHAR(16) NOT NULL CHECK (role IN ('WORKER', 'LENDER', 'ADMIN')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Worker Profiles Table
CREATE TABLE IF NOT EXISTS worker_profiles (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    did VARCHAR(128) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    primary_platform VARCHAR(32) NOT NULL,
    vpa VARCHAR(128) NOT NULL,
    credit_tier VARCHAR(16) NOT NULL DEFAULT 'STANDARD_B',
    risk_score INT NOT NULL DEFAULT 75 CHECK (risk_score BETWEEN 0 AND 100),
    public_key TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workers_user_id ON worker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_workers_did ON worker_profiles(did);

-- 3. Payment Mandates Table (UPI AutoPay Variable e-Mandates)
CREATE TABLE IF NOT EXISTS payment_mandates (
    id VARCHAR(64) PRIMARY KEY,
    umrn VARCHAR(64) NOT NULL UNIQUE,
    worker_id VARCHAR(64) NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    vpa VARCHAR(128) NOT NULL,
    bank_account_masked VARCHAR(32) NOT NULL,
    ifsc_code VARCHAR(16) NOT NULL,
    max_amount_paise BIGINT NOT NULL CHECK (max_amount_paise > 0),
    frequency VARCHAR(32) NOT NULL DEFAULT 'AS_PRESENTED',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    authorized_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mandates_worker ON payment_mandates(worker_id);

-- 4. Loans Table
CREATE TABLE IF NOT EXISTS loans (
    id VARCHAR(64) PRIMARY KEY,
    worker_id VARCHAR(64) NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    lender_id VARCHAR(64) NOT NULL REFERENCES users(id),
    lender_name VARCHAR(128) NOT NULL,
    principal_paise BIGINT NOT NULL CHECK (principal_paise > 0),
    outstanding_balance_paise BIGINT NOT NULL CHECK (outstanding_balance_paise >= 0),
    interest_rate_bps INT NOT NULL DEFAULT 1200 CHECK (interest_rate_bps >= 0),
    deduction_rate_bps INT NOT NULL DEFAULT 500 CHECK (deduction_rate_bps > 0 AND deduction_rate_bps <= 5000),
    daily_cap_paise BIGINT NOT NULL DEFAULT 0,
    total_repaid_paise BIGINT NOT NULL DEFAULT 0 CHECK (total_repaid_paise >= 0),
    mandate_id VARCHAR(64) REFERENCES payment_mandates(id),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', -- PENDING_APPROVAL, ACTIVE, SETTLED, REJECTED
    purpose VARCHAR(256) NOT NULL,
    approved_by VARCHAR(64) REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_loans_worker ON loans(worker_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

-- 5. Earnings Records Table
CREATE TABLE IF NOT EXISTS earnings_records (
    id VARCHAR(64) PRIMARY KEY,
    worker_id VARCHAR(64) NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    platform_id VARCHAR(32) NOT NULL,
    date DATE NOT NULL,
    gross_earnings_paise BIGINT NOT NULL CHECK (gross_earnings_paise >= 0),
    net_earnings_paise BIGINT NOT NULL CHECK (net_earnings_paise >= 0),
    orders_count INT DEFAULT 0,
    reference VARCHAR(128) NOT NULL UNIQUE, -- Unique constraint for payout references
    status VARCHAR(16) NOT NULL DEFAULT 'RECORDED',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_earnings_worker_date ON earnings_records(worker_id, date DESC);

-- 6. Consent Grants Table
CREATE TABLE IF NOT EXISTS consent_grants (
    id VARCHAR(64) PRIMARY KEY,
    worker_id VARCHAR(64) NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    grantee VARCHAR(128) NOT NULL,
    scope TEXT NOT NULL, -- comma-separated or json string of scopes
    purpose TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_consents_worker ON consent_grants(worker_id);

-- 7. Payout Events Table
CREATE TABLE IF NOT EXISTS payout_events (
    id VARCHAR(64) PRIMARY KEY,
    worker_id VARCHAR(64) NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    platform_id VARCHAR(32) NOT NULL,
    amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
    reference VARCHAR(128) NOT NULL UNIQUE, -- Unique constraint for payout references
    payout_date DATE NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(24) NOT NULL DEFAULT 'DETECTED',
    skip_reason VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_payouts_worker ON payout_events(worker_id);

-- 8. Debit Instructions Table
CREATE TABLE IF NOT EXISTS debit_instructions (
    id VARCHAR(64) PRIMARY KEY, -- Unique debit instruction ID
    loan_id VARCHAR(64) NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    worker_id VARCHAR(64) NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    payout_event_id VARCHAR(64) REFERENCES payout_events(id),
    amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    idempotency_key VARCHAR(128) NOT NULL UNIQUE, -- Unique idempotency key constraint
    upi_ref VARCHAR(128),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    failure_reason VARCHAR(256),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_debits_loan ON debit_instructions(loan_id);
CREATE INDEX IF NOT EXISTS idx_debits_idempotency ON debit_instructions(idempotency_key);

-- 9. Repayments Table
CREATE TABLE IF NOT EXISTS repayments (
    id VARCHAR(64) PRIMARY KEY,
    loan_id VARCHAR(64) NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    debit_instruction_id VARCHAR(64) NOT NULL REFERENCES debit_instructions(id),
    worker_id VARCHAR(64) NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    previous_balance_paise BIGINT NOT NULL,
    new_outstanding_balance_paise BIGINT NOT NULL CHECK (new_outstanding_balance_paise >= 0),
    is_final_settlement BOOLEAN NOT NULL DEFAULT FALSE,
    settled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    upi_ref VARCHAR(128) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repayments_worker ON repayments(worker_id);
CREATE INDEX IF NOT EXISTS idx_repayments_loan ON repayments(loan_id);

-- 10. Audit Events Table
CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id),
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    details TEXT NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action);
