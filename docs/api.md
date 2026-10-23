# 📡 MicroStream API Specification

The MicroStream backend exposes a RESTful API with structured JSON responses, JWT-based authentication, and role-based authorization (`WORKER`, `LENDER`, `ADMIN`).

**Base URL**: `http://localhost:4000/api`  
**All monetary amounts**: Integer paise (`1 INR = 100 paise`).

---

## 1. System & Health

### `GET /api/health`
Returns system status, active database engine, currency configuration, and adapter runtime modes.

**Response (200 OK):**
```json
{
  "status": "OK",
  "service": "MicroStream Backend",
  "timestamp": "2026-10-24T00:53:28.000Z",
  "database": {
    "engine": "PostgreSQL",
    "isInMemory": false
  },
  "currencyRepresentation": "Integer paise (1 INR = 100 paise)",
  "adapters": {
    "ledger": { "mode": "MOCK", "fabricGatewayReady": false },
    "payout": { "mode": "MOCK", "provider": "MockPayoutProvider" },
    "payment": { "mode": "MOCK", "provider": "MockUPIAutoPay" }
  }
}
```

---

## 2. Authentication & Session (`/api/auth`)

### `POST /api/auth/login`
Authenticates user with email and password. Returns JWT bearer token.

**Request Body:**
```json
{
  "email": "ravi.kumar@zomato-partner.in",
  "password": "Password123!"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_ravi_01",
    "email": "ravi.kumar@zomato-partner.in",
    "name": "Ravi Kumar",
    "role": "WORKER",
    "workerId": "wrk_ravi_01",
    "did": "did:drunix:worker:ravi-kumar-01"
  }
}
```

### `GET /api/auth/me`
*Requires `Authorization: Bearer <token>`.* Returns the authenticated session profile.

### `POST /api/auth/logout`
*Requires `Authorization: Bearer <token>`.* Invalidates session and creates audit event.

---

## 3. Worker Self Service (`/api/workers/me`)
*All `/api/workers/me/*` routes require role `WORKER`.* All data access is scoped strictly to the token subject.

### `GET /api/workers/me`
Returns worker profile, active loan, active e-mandate, and 14-day earnings summary.

### `GET /api/workers/me/earnings`
Returns paginated historical daily earnings records with date filtering.
- Query parameters: `page`, `limit`, `startDate`, `endDate`, `sortBy`, `sortOrder`.

### `GET /api/workers/me/loans`
Returns all micro-credit facilities for the authenticated worker.

### `GET /api/workers/me/repayments`
Returns all settled streaming micro-repayments.

---

## 4. Micro-Credit Facilities (`/api/loans`)

### `POST /api/loans/apply`
*Requires role `WORKER`.* Worker applies for a micro-credit facility.
```json
{
  "amountRupees": 15000,
  "deductionRatePct": 5.0,
  "dailyCapRupees": 250,
  "purpose": "Vehicle maintenance & fuel working capital"
}
```

### `POST /api/loans/:loanId/approve`
*Requires role `LENDER` or `ADMIN`.* Approves a pending loan and commits state to ledger.

### `GET /api/loans`
*Requires role `LENDER` or `ADMIN`.* Lists all loans across the portfolio.

---

## 5. Institutional Lender & Risk Center (`/api/lender`)
*All routes require role `LENDER` or `ADMIN`.*

### `GET /api/lender/portfolio`
Returns aggregate portfolio capital, recovery percentage, debit analytics, and 30-day earnings inflows.

**Response (200 OK):**
```json
{
  "totalPrincipalPaise": 5000000,
  "totalOutstandingPaise": 4517500,
  "totalRepaidPaise": 482500,
  "activeLoansCount": 3,
  "settledLoansCount": 0,
  "repaymentProgressPct": 9.65,
  "debitAnalytics": {
    "totalDebits": 24,
    "succeededDebits": 19,
    "failedDebits": 5,
    "debitSuccessRatePct": 79.2
  },
  "portfolioEarningsTrend": [
    { "date": "2026-10-23", "daily_gross_paise": "125000", "active_workers": "4" }
  ]
}
```

### `GET /api/lender/workers`
Search and filter workers by pseudonym, platform, and credit tier.
- Query parameters: `search`, `platform`, `tier`.

### `GET /api/lender/workers/:workerId/risk?window=30|60`
Enforces privacy consent verification. Computes rolling 30/60d cash-flow metrics and explainable rules-based risk assessment.

**Response (200 OK):**
```json
{
  "worker": {
    "pseudonymId": "ZOM-WRK-DE9E",
    "primaryPlatform": "ZOMATO",
    "creditTier": "PRIME_A",
    "phoneMasked": "+91 ****** 43210"
  },
  "analytics": {
    "windowDays": 30,
    "activeEarningDays": 27,
    "zeroIncomeDays": 1,
    "missingDataDays": 2,
    "avgDailyEarningsPaise": 139150,
    "medianDailyEarningsPaise": 139458,
    "volatilityCoefficient": 0.124,
    "volatilityTier": "LOW",
    "repaymentToEarningsRatioPct": 2.41,
    "debitSuccessRatePct": 92.9
  },
  "riskAssessment": {
    "riskCategory": "LOW_RISK",
    "status": "COMPLETE",
    "indicators": [
      {
        "name": "Cash-Flow Volatility (CV)",
        "measuredValue": "CV: 0.124 (σ: ₹172)",
        "benchmark": "Low: ≤ 0.30 | Moderate: 0.31-0.55 | High: > 0.55",
        "level": "POSITIVE",
        "contributingFactors": "Highly consistent daily earnings with low dispersion."
      }
    ],
    "underwritingRecommendation": {
      "recommendedCreditLimitPaise": 1500000,
      "recommendedDeductionRateBps": 500,
      "recommendedDailyCapPaise": 25000
    }
  }
}
```

**Consent Failure Response (403 Forbidden):**
```json
{
  "error": "Access Denied: Worker has not granted active consent for earnings inspection or credit assessment.",
  "code": "CONSENT_REQUIRED",
  "pseudonymId": "ZEP-WRK-043E"
}
```

---

## 6. Payout & Repayment Simulation (`/api/simulator`)

### `POST /api/simulator/payouts`
Simulates daily payout event, executes deterministic integer deduction math, and records debit instruction.

**Request Body:**
```json
{
  "workerId": "wrk_ravi_01",
  "platformId": "zomato-in",
  "amountPaise": 120000,
  "reference": "ZOM-PAY-20261024-001",
  "failureType": "NONE",
  "autoConfirm": true
}
```

### `POST /api/payments/callback`
Handles UPI AutoPay payment webhook callback. Validates reference and amount, records settled repayment, and atomically reduces outstanding loan balance.
- Rejects amount mismatches with HTTP 400 `AMOUNT_MISMATCH`.
- Replays duplicate callbacks safely without duplicate balance deduction.

### `POST /api/debits/:instructionId/retry`
Retries a failed or retry-pending debit instruction within bounded retry limit.

---

## 7. AutoPay Mandates (`/api/mandates`)

### `POST /api/mandates`
Creates a new simulated mandate in `AWAITING_AUTHORIZATION` status.

### `POST /api/mandates/:mandateId/approve`
Approves mandate, transitioning status to `ACTIVE` and recording authorization timestamp.

---

## 8. Audit Logs (`/api/audit`)
*Requires role `ADMIN`.* Returns immutable event log of all financial deductions, mandate transitions, user logins, and consent modifications.
