-- ============================================================================
-- MicroStream Cash-Flow Risk Assessment Queries (YugabyteDB / PostgreSQL)
-- Directly executed on distributed SQL state DB without moving data off-chain
-- All monetary outputs in integer paise and rupee conversions
-- ============================================================================

-- 1. 60-Day Cash Flow Stability & Volatility Query per Worker DID
SELECT
    er.did,
    wd.name AS worker_name,
    wd.primary_platform,
    wd.credit_tier,
    COUNT(DISTINCT er.date) AS active_earning_days,
    ROUND(AVG(er.gross_earnings_paise)) AS avg_daily_gross_paise,
    ROUND(AVG(er.gross_earnings_paise) / 100.0, 2) AS avg_daily_gross_inr,
    ROUND(STDDEV(er.gross_earnings_paise)) AS earnings_volatility_paise,
    ROUND(STDDEV(er.gross_earnings_paise) / 100.0, 2) AS volatility_inr,
    MIN(er.gross_earnings_paise) AS min_daily_paise,
    MAX(er.gross_earnings_paise) AS max_daily_paise,
    SUM(er.gross_earnings_paise) AS total_period_earnings_paise,
    ROUND(SUM(er.gross_earnings_paise) / 100.0, 2) AS total_period_earnings_inr
FROM earnings_records er
JOIN worker_dids wd ON er.did = wd.did
WHERE er.date >= CURRENT_DATE - INTERVAL '60 days'
GROUP BY er.did, wd.name, wd.primary_platform, wd.credit_tier
ORDER BY avg_daily_gross_paise DESC;

-- 2. Streaming Repayment Velocity & Default Risk Indicator
SELECT
    l.loan_id,
    l.did,
    wd.name AS worker_name,
    l.principal_paise,
    l.outstanding_balance_paise,
    l.total_repaid_paise,
    ROUND((l.total_repaid_paise::numeric / l.principal_paise::numeric) * 100, 2) AS repayment_progress_pct,
    l.deduction_rate_bps / 100.0 AS deduction_rate_pct,
    COUNT(r.id) AS total_streaming_deductions_count,
    ROUND(AVG(r.amount_paise)) AS avg_deduction_paise,
    ROUND(AVG(r.amount_paise) / 100.0, 2) AS avg_deduction_inr,
    MAX(r.settled_at) AS last_streaming_repayment_at
FROM loans l
JOIN worker_dids wd ON l.did = wd.did
LEFT JOIN repayments r ON l.loan_id = r.loan_id
WHERE l.status = 'ACTIVE'
GROUP BY l.loan_id, l.did, wd.name, l.principal_paise, l.outstanding_balance_paise, l.total_repaid_paise, l.deduction_rate_bps
ORDER BY repayment_progress_pct DESC;

-- 3. Loan Eligibility & Recommended Deduction Rate Underwriting Engine
SELECT
    wd.did,
    wd.name,
    wd.credit_tier,
    wd.risk_score,
    COUNT(er.id) AS days_recorded,
    ROUND(AVG(er.gross_earnings_paise) / 100.0, 2) AS avg_daily_income_inr,
    CASE
        WHEN wd.risk_score >= 85 AND COUNT(er.id) >= 7 THEN 2500000 -- ₹25,000 eligible
        WHEN wd.risk_score >= 70 AND COUNT(er.id) >= 5 THEN 1500000 -- ₹15,000 eligible
        ELSE 800000                                                 -- ₹8,000 eligible
    END AS max_credit_limit_paise,
    CASE
        WHEN wd.risk_score >= 85 THEN 500  -- 5.00% deduction
        WHEN wd.risk_score >= 70 THEN 600  -- 6.00% deduction
        ELSE 750                          -- 7.50% deduction
    END AS recommended_deduction_rate_bps
FROM worker_dids wd
LEFT JOIN earnings_records er ON wd.did = er.did
GROUP BY wd.did, wd.name, wd.credit_tier, wd.risk_score;
