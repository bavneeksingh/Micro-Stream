# 🔌 MicroStream REST API Specification

Base URL: `http://localhost:4000/api`

---

## 1. System Health
### `GET /health`
Returns system status, uptime, active adapter modes, and currency invariants.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-10-24T00:00:00.000Z",
  "uptimeSeconds": 42,
  "environment": "development",
  "adapters": {
    "ledger": { "mode": "mock", "isMock": true, "provider": "Drunix Mock Hyperledger Fabric Chaincode + YugabyteDB" },
    "payout": { "mode": "mock", "isMock": true, "provider": "Mock Gig Platform Payout Oracle (Zomato/Swiggy/Uber)" },
    "payment": { "mode": "mock", "isMock": true, "provider": "NPCI UPI AutoPay Simulator (MOCK - NO REAL DEBITS)" }
  },
  "currencyRepresentation": "Integer paise (1 INR = 100 paise)"
}
```

---

## 2. Workers & Decentralized Identity
### `GET /workers`
List all registered gig workers.

### `GET /workers/:did`
Retrieve specific worker profile, 30-day earnings summary, active loan, and UPI AutoPay mandate.

### `POST /workers/:did/earnings`
Ingest daily earnings record (simulating gig platform oracle).

**Payload:**
```json
{
  "platformId": "zomato-in",
  "date": "2026-10-24",
  "grossEarningsPaise": 140000,
  "reference": "ZOM-SETTLE-20261024-001"
}
```

---

## 3. Micro-Loans
### `GET /loans`
List all loans. Query parameters: `?did=...&status=ACTIVE`.

### `GET /loans/:loanId`
Get loan details and full repayment stream history.

### `POST /loans`
Issue a new micro-loan on the ledger.

**Payload:**
```json
{
  "did": "did:drunix:worker:priya-uc-04",
  "lenderId": "lender-kotak-micro",
  "lenderName": "Kotak Microfinance",
  "principalPaise": 2000000,
  "deductionRateBps": 500,
  "dailyCapPaise": 20000,
  "mandateId": "mnd_priya_04",
  "purpose": "Working capital"
}
```

---

## 4. Streaming Execution & Payout Simulation
### `POST /payouts/simulate`
Simulates daily payout event and executes the end-to-end streaming loop:
1. Payout recorded
2. Earnings logged to ledger
3. Proportional deduction computed
4. Variable UPI AutoPay debit executed
5. Loan balance reduced and repayment event committed

**Payload:**
```json
{
  "did": "did:drunix:worker:ravi-kumar-01",
  "platformId": "zomato-in",
  "amountPaise": 100000,
  "reference": "ZOM-BANK-TX-991"
}
```

**Response:**
```json
{
  "payout": {
    "id": "pay_a1b2c3",
    "did": "did:drunix:worker:ravi-kumar-01",
    "amountPaise": 100000,
    "status": "COMPLETED"
  },
  "hasActiveLoan": true,
  "deductionCalculatedPaise": 5000,
  "debitResult": {
    "success": true,
    "amountDebitedPaise": 5000,
    "upiRef": "UPI/20261024/9182736450"
  },
  "updatedLoan": {
    "loanId": "LN-2026-001",
    "outstandingBalancePaise": 870500,
    "totalRepaidPaise": 129500
  },
  "repayment": {
    "id": "rep_998877",
    "amountPaise": 5000,
    "newOutstandingBalancePaise": 870500
  },
  "isLoanSettled": false,
  "message": "Successfully streamed deduction of ₹50.00 toward loan LN-2026-001"
}
```

---

## 5. Analytics & Risk Underwriting
### `GET /analytics/portfolio`
Returns aggregate lender portfolio statistics (deployed capital, recovered capital, recovery rate, default rate).

### `GET /analytics/risk`
Returns YugabyteDB SQL cash-flow metrics across all worker DIDs (60-day active days, daily income mean, volatility, credit tier, and recommended loan limit).
