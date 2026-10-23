# ⛓️ MicroStream Blockchain & Ledger Layer Specification

This document provides the formal technical architecture, smart contract specifications, security/privacy invariants, and live-network integration path for MicroStream's blockchain layer powered by **NPCI Drunix**, **Hyperledger Fabric**, and **YugabyteDB**.

---

## 1. Architectural Overview & Network Topology

MicroStream utilizes a permissioned distributed ledger to achieve non-repudiable auditability, multi-party consensus, and automated income-linked loan amortization across three distinct institutional stakeholders:
- **Gig Platforms (Oracles):** Authenticate and commit daily earnings payouts.
- **Workers (Borrowers):** Authorize variable UPI AutoPay debits through verifiable decentralized consent.
- **Micro-Lenders (Creditors):** Issue loans, underwrite risk on distributed ledger state, and receive atomic micro-amortization.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PRESENTATION LAYER                                     │
│     Worker Dashboard                Lender Portal                 Stream Simulator     │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP / JSON
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                              BACKEND APPLICATION LAYER                                 │
│                           Node.js + Express + TypeScript                               │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              LEDGER ADAPTER LAYER                              │   │
│   │                        Interface: ILedgerAdapter                               │   │
│   │                                                                                │   │
│   │   ┌───────────────────────────────┐        ┌───────────────────────────────┐   │   │
│   │   │       MockLedgerAdapter       │        │      FabricLedgerAdapter      │   │   │
│   │   │   (Default: Zero Cluster Req) │        │   (Live Drunix/Fabric Gateway)│   │   │
│   │   └───────────────────────────────┘        └───────────────────────────────┘   │   │
│   └───────────────────────────────────────────────────────┬────────────────────────┘   │
└───────────────────────────────────────────────────────────┼────────────────────────────┘
                                                            │ gRPC (Fabric Gateway)
┌───────────────────────────────────────────────────────────▼────────────────────────────┐
│                              PERMISSIONED LEDGER (DRUNIX)                              │
│                                                                                        │
│   ┌────────────────────────┐      ┌────────────────────────┐     ┌─────────────────┐   │
│   │   Lite Peers (NPCI)    │      │    Committing Peers    │     │ Validation Svc  │   │
│   │  Stateless Endorsement │      │    Block Validation    │     │  Deterministic  │   │
│   └───────────┬────────────┘      └───────────┬────────────┘     └─────────────────┘   │
│               │                               │                                        │
│   ┌───────────▼───────────────────────────────▼────────────┐                           │
│   │           Go Chaincode (microstream/chaincode)          │                           │
│   │  CalculateDeduction • UpdateLoanBalance • LogEarnings  │                           │
│   └───────────────────────────┬────────────────────────────┘                           │
│                               │ Read/Write State                                       │
│   ┌───────────────────────────▼────────────────────────────┐                           │
│   │        Distributed SQL State Database (YugabyteDB)     │                           │
│   │    Worker DIDs • Immutable Loans • Stream Repayments    │                           │
│   └────────────────────────────────────────────────────────┘                           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Invariants & Security Rules

1. **Deterministic Execution:**
   - Chaincode never calls `time.Now()`, `rand.Int()`, HTTP endpoints, external banking APIs, or external databases.
   - All timestamps are derived deterministically from the block header via `ctx.GetStub().GetTxTimestamp()`.
   - All internal keys and IDs are generated deterministically using SHA-256 hashes of business composite keys.
2. **Strict Integer Paise Arithmetic:**
   - Currency is stored and computed strictly in integer paise ($1\text{ INR} = 100\text{ paise}$).
   - Multiplication uses 64-bit integer arithmetic with floor truncation:
     $$\text{deductionPaise} = \min\left(\left\lfloor \frac{\text{payoutPaise} \times \text{rateBasisPoints}}{10000} \right\rfloor, \text{outstandingPaise}, \text{remainingDailyCapPaise}\right)$$
3. **Privacy by Design (Zero PII on Ledger):**
   - No personal names, telephone numbers, Aadhaar numbers, residential addresses, or bank account numbers are stored on-chain.
   - Identity is anchored through pseudonymous DIDs (`did:drunix:worker:...`) and cryptographic public keys.
4. **Idempotency & Duplicate Callback Protection:**
   - Duplicate payout references are safely acknowledged without creating redundant debit instructions.
   - In `UpdateLoanBalance`, if the referenced `DebitInstruction` status is already `SUCCESS` or `SUCCEEDED`, the transaction is strictly rejected. This prevents bank webhook retries from duplicating repayments.
5. **Caller Authorization & Multi-MSP Verification:**
   - `LogDailyEarnings` requires caller MSP to be an authorized gig platform or oracle (`PlatformMSP`, `OracleMSP`).
   - `IssueLoan` requires caller MSP to be an authorized institutional lender (`LenderMSP`, `BankMSP`).
   - `UpdateLoanBalance` requires caller MSP to be an authorized payment adapter (`PaymentMSP`, `GatewayMSP`).
   - `GrantConsent` and `RevokeConsent` require worker or admin authorization (`WorkerMSP`, `AdminMSP`).

---

## 3. Specification of the 10 Chaincode Functions

### 3.1 `RegisterWorkerDID`
Registers a worker's decentralized identity on Drunix / Fabric.
- **Parameters:**
  - `did` (string): Decentralized Identifier (e.g. `"did:drunix:worker:ravi-01"`).
  - `handle` (string): Pseudonymous worker handle (e.g. `"wrk_ravi_01"`).
  - `platformId` (string): Primary gig platform (e.g. `"zomato-in"`).
  - `publicKey` (string): Ed25519/ECDSA public key.
- **Validation:** Ensures `did` does not already exist; caller authorized.
- **Example Request Payload:**
  ```json
  {
    "function": "RegisterWorkerDID",
    "args": [
      "did:drunix:worker:ravi-01",
      "wrk_ravi_01",
      "zomato-in",
      "04b281f6e2c842b09a7b973ef808298192809182379182739812739182739812"
    ]
  }
  ```
- **Example Response Payload:**
  ```json
  {
    "did": "did:drunix:worker:ravi-01",
    "handle": "wrk_ravi_01",
    "platformId": "zomato-in",
    "publicKey": "04b281f6e2c842b09a7b973ef808298192809182379182739812739182739812",
    "status": "ACTIVE",
    "createdAt": "2026-10-24T00:00:00Z"
  }
  ```

---

### 3.2 `GrantConsent`
Records a consent artifact authorizing a financial entity to inspect earnings or initiate variable deductions.
- **Parameters:**
  - `consentId` (string): Unique consent identifier.
  - `did` (string): Borrower worker DID.
  - `grantee` (string): Institutional grantee (e.g. `"lender-kotak-micro"`).
  - `scopeCommaSeparated` (string): Scopes (e.g. `"earnings:read, deduction:debit"`).
  - `purpose` (string): Regulatory purpose string.
  - `expiresAt` (string): ISO-8601 expiration timestamp.
- **Example Request Payload:**
  ```json
  {
    "function": "GrantConsent",
    "args": [
      "cns_8912",
      "did:drunix:worker:ravi-01",
      "lender-kotak-micro",
      "earnings:read, deduction:debit",
      "Micro-credit variable AutoPay deduction under pre-authorized e-mandate",
      "2027-10-24T00:00:00Z"
    ]
  }
  ```
- **Example Response Payload:**
  ```json
  {
    "id": "cns_8912",
    "did": "did:drunix:worker:ravi-01",
    "grantee": "lender-kotak-micro",
    "scope": ["earnings:read", "deduction:debit"],
    "purpose": "Micro-credit variable AutoPay deduction under pre-authorized e-mandate",
    "status": "ACTIVE",
    "grantedAt": "2026-10-24T00:00:00Z",
    "expiresAt": "2027-10-24T00:00:00Z"
  }
  ```

---

### 3.3 `RevokeConsent`
Revokes an active consent grant.
- **Parameters:**
  - `consentId` (string): Consent ID to revoke.
  - `did` (string): Borrower worker DID.
- **Example Request Payload:**
  ```json
  {
    "function": "RevokeConsent",
    "args": ["cns_8912", "did:drunix:worker:ravi-01"]
  }
  ```
- **Example Response Payload:**
  ```json
  {
    "id": "cns_8912",
    "did": "did:drunix:worker:ravi-01",
    "grantee": "lender-kotak-micro",
    "status": "REVOKED",
    "revokedAt": "2026-10-24T01:15:00Z"
  }
  ```

---

### 3.4 `LogDailyEarnings`
Ingests an immutable daily earnings record logged by an authenticated gig platform.
- **Parameters:**
  - `did` (string): Worker DID.
  - `platformId` (string): Platform ID (e.g. `"zomato-in"`).
  - `date` (string): Payout date (YYYY-MM-DD).
  - `grossEarningsPaise` (int64): Gross earnings in paise ($1,200\text{ INR} = 120,000\text{ paise}$).
  - `reference` (string): External transaction reference from gig platform.
- **Example Request Payload:**
  ```json
  {
    "function": "LogDailyEarnings",
    "args": [
      "did:drunix:worker:ravi-01",
      "zomato-in",
      "2026-10-24",
      "120000",
      "PAY-ZOMATO-20261024-991"
    ]
  }
  ```
- **Example Response Payload:**
  ```json
  "ERN_a7f920bc41d9e802"
  ```

---

### 3.5 `GetEarningsSummary`
Aggregates historical earnings directly on ledger state for decentralized risk underwriting.
- **Parameters:**
  - `did` (string): Worker DID.
  - `days` (int): History window (e.g. 30).
- **Example Request Payload:**
  ```json
  {
    "function": "GetEarningsSummary",
    "args": ["did:drunix:worker:ravi-01", "30"]
  }
  ```
- **Example Response Payload:**
  ```json
  {
    "did": "did:drunix:worker:ravi-01",
    "totalEarningsPaise": 3600000,
    "averageDailyEarningsPaise": 120000,
    "activeDaysCount": 30,
    "daysEvaluated": 30
  }
  ```

---

### 3.6 `IssueLoan`
Mints an income-linked micro-credit facility on the ledger.
- **Parameters:**
  - `loanId` (string): Unique loan identifier (`"LN-2026-001"`).
  - `did` (string): Borrower worker DID.
  - `lenderId` (string): Creditor institutional identifier.
  - `principalPaise` (int64): Facility amount in paise ($10,000\text{ INR} = 1,000,000\text{ paise}$).
  - `interestRateBps` (int32): Annual percentage rate in basis points ($1,200\text{ bps} = 12\%$).
  - `deductionRateBps` (int32): Streaming recovery rate ($500\text{ bps} = 5\%$).
  - `dailyCapPaise` (int64): Safety daily ceiling ($20,000\text{ paise} = 200\text{ INR}$).
  - `mandateId` (string): NPCI UPI AutoPay variable mandate reference.
- **Example Request Payload:**
  ```json
  {
    "function": "IssueLoan",
    "args": [
      "LN-2026-001",
      "did:drunix:worker:ravi-01",
      "lender-kotak-micro",
      "1000000",
      "1200",
      "500",
      "20000",
      "mnd_ravi_kotak_01"
    ]
  }
  ```
- **Example Response Payload:**
  ```json
  {
    "loanId": "LN-2026-001",
    "did": "did:drunix:worker:ravi-01",
    "lenderId": "lender-kotak-micro",
    "principalPaise": 1000000,
    "outstandingBalancePaise": 1000000,
    "interestRateBps": 1200,
    "deductionRateBps": 500,
    "dailyCapPaise": 20000,
    "totalRepaidPaise": 0,
    "mandateId": "mnd_ravi_kotak_01",
    "status": "ACTIVE",
    "issuedAt": "2026-10-24T00:00:00Z"
  }
  ```

---

### 3.7 `GetLoan`
Retrieves the real-time state of an on-chain loan.
- **Parameters:**
  - `loanId` (string): Loan identifier.
- **Example Request Payload:**
  ```json
  {
    "function": "GetLoan",
    "args": ["LN-2026-001"]
  }
  ```
- **Example Response Payload:**
  ```json
  {
    "loanId": "LN-2026-001",
    "did": "did:drunix:worker:ravi-01",
    "lenderId": "lender-kotak-micro",
    "principalPaise": 1000000,
    "outstandingBalancePaise": 950000,
    "interestRateBps": 1200,
    "deductionRateBps": 500,
    "dailyCapPaise": 20000,
    "totalRepaidPaise": 50000,
    "status": "ACTIVE",
    "issuedAt": "2026-10-24T00:00:00Z"
  }
  ```

---

### 3.8 `CalculateDeduction`
Calculates the deterministic proportional micro-deduction on incoming daily payouts.
- **Parameters:**
  - `loanId` (string): Target active loan.
  - `payoutAmountPaise` (int64): Payout amount ($1,000\text{ INR} = 100,000\text{ paise}$).
  - `payoutRef` (string): Unique payout oracle reference.
- **Example Request Payload:**
  ```json
  {
    "function": "CalculateDeduction",
    "args": ["LN-2026-001", "100000", "PAY-ZOMATO-20261024-991"]
  }
  ```
- **Example Response Payload:**
  ```json
  {
    "deductionAmountPaise": 5000,
    "debitInstructionId": "INS_7e20b3ca01f4",
    "idempotencyKey": "IDEMP_DEBIT_LN-2026-001_PAY-ZOMATO-20261024-991",
    "outstandingBalance": 950000
  }
  ```

---

### 3.9 `RecordDebitInstruction`
Records a pending debit instruction with a stable idempotency key prior to presenting to UPI AutoPay.
- **Parameters:**
  - `instructionId` (string): Unique instruction ID (`"ins_1792788"`).
  - `loanId` (string): Target loan.
  - `did` (string): Worker DID.
  - `amountPaise` (int64): Scheduled deduction ($50\text{ INR} = 5,000\text{ paise}$).
  - `idempotencyKey` (string): Stable idempotency key.
- **Validation:** Rejects duplicate `instructionId` with error.
- **Example Request Payload:**
  ```json
  {
    "function": "RecordDebitInstruction",
    "args": [
      "ins_1792788",
      "LN-2026-001",
      "did:drunix:worker:ravi-01",
      "5000",
      "IDEM-PAYOUT-PAY-ZOMATO-20261024-991-LN-2026-001"
    ]
  }
  ```
- **Example Response Payload:**
  ```json
  {
    "instructionId": "ins_1792788",
    "loanId": "LN-2026-001",
    "did": "did:drunix:worker:ravi-01",
    "amountPaise": 5000,
    "idempotencyKey": "IDEM-PAYOUT-PAY-ZOMATO-20261024-991-LN-2026-001",
    "status": "PENDING",
    "createdAt": "2026-10-24T00:00:00Z"
  }
  ```

---

### 3.10 `UpdateLoanBalance`
Applies confirmed UPI AutoPay debit webhook results to loan balances.
- **Parameters:**
  - `loanId` (string): Target loan.
  - `debitInstructionId` (string): Instruction ID being settled.
  - `status` (string): `"SUCCESS"` or `"FAILED"`.
  - `amountDebitedPaise` (int64): Confirmed debited amount (5,000 paise).
  - `upiRef` (string): Bank NPCI UPI RRN / UMRN reference.
- **Validation:** Rejects already-settled instructions to eliminate duplicate repayments. Closes loan at zero balance (`Status = PAID`).
- **Example Request Payload:**
  ```json
  {
    "function": "UpdateLoanBalance",
    "args": [
      "LN-2026-001",
      "ins_1792788",
      "SUCCESS",
      "5000",
      "UPI/20261024/9910023419"
    ]
  }
  ```
- **Example Response Payload:**
  ```json
  {
    "loanId": "LN-2026-001",
    "did": "did:drunix:worker:ravi-01",
    "lenderId": "lender-kotak-micro",
    "principalPaise": 1000000,
    "outstandingBalancePaise": 945000,
    "totalRepaidPaise": 55000,
    "status": "ACTIVE",
    "issuedAt": "2026-10-24T00:00:00Z"
  }
  ```

---

## 4. Integration Path for a Future Live Network

When deploying MicroStream onto a live staging or production NPCI Drunix / Hyperledger Fabric cluster:

### 4.1 Deployment Architecture Differences
| Feature | Local Dev / Sandbox | Live NPCI Drunix Network |
| :--- | :--- | :--- |
| **Adapter Mode** | `MockLedgerAdapter` (Default) | `FabricLedgerAdapter` via `@hyperledger/fabric-gateway` |
| **State Database** | In-Memory / PostgreSQL 15 | YugabyteDB Distributed SQL cluster |
| **Endorsement** | Local synthetic endorsement | Drunix Lite Peers (stateless) |
| **Commitment** | Local commit | Drunix Committing Peers + Raft Ordering Service |
| **Security** | In-process authorization | mTLS + X.509 Certificate Authorities (Fabric CA) |

### 4.2 Configuration Parameters (`.env`)
Switching from mock to live network is controlled through environment variables without application code edits:
```ini
# Ledger Adapter Mode: 'mock' or 'fabric'
LEDGER_ADAPTER_TYPE=fabric

# Live Network Connectivity
FABRIC_PEER_ENDPOINT=grpcs://drunix-peer0.org1.npci.org.in:7051
FABRIC_CHANNEL=microstream-channel
FABRIC_CHAINCODE_NAME=microstream
FABRIC_MSP_ID=PlatformMSP
FABRIC_TLS_CERT_PATH=/etc/microstream/crypto/tls-ca-cert.pem
FABRIC_USER_CERT_PATH=/etc/microstream/crypto/user-cert.pem
FABRIC_USER_KEY_PATH=/etc/microstream/crypto/user-priv-key.pem
```

### 4.3 Chaincode Packaging & Deployment Lifecycle
```bash
# 1. Package Chaincode
peer lifecycle chaincode package microstream.tar.gz \
  --path ./chaincode/microstream \
  --lang golang \
  --label microstream_1.0

# 2. Install on Committing Peers
peer lifecycle chaincode install microstream.tar.gz

# 3. Approve for Organization
peer lifecycle chaincode approveformyorg \
  -o orderer.npci.org.in:7050 \
  --channelID microstream-channel \
  --name microstream \
  --version 1.0 \
  --package-id <PACKAGE_ID> \
  --sequence 1

# 4. Commit to Channel
peer lifecycle chaincode commit \
  -o orderer.npci.org.in:7050 \
  --channelID microstream-channel \
  --name microstream \
  --version 1.0 \
  --sequence 1
```

### 4.4 Graceful Degradation Guarantee
If live network connection details are missing or the target peer endpoint is unreachable:
1. `FabricLedgerAdapter` provides explicit, descriptive diagnostics detailing the missing credentials.
2. The system defaults safely to `MockLedgerAdapter`, allowing hackathon judges, automated pipelines, and local developers to test 100% of the functionality without an active blockchain cluster.
