# ⚙️ MicroStream Configuration & Environment Variables

This document details the configuration parameters, environment variables, secrets handling, and adapter runtime modes for MicroStream.

---

## 1. Environment Variables Reference

| Variable | Description | Default Value | Required in Production |
| :--- | :--- | :--- | :--- |
| `PORT` | HTTP port for the backend service | `4000` | No |
| `NODE_ENV` | Application runtime environment (`development` / `production` / `test`) | `development` | Yes |
| `DATABASE_URL` | PostgreSQL or YugabyteDB connection URL | `postgresql://postgres:postgres@localhost:5432/microstream` | Yes |
| `JWT_SECRET` | Secret key used for signing session tokens | `microstream_super_secret_jwt_key_2026` | **Yes (Must override)** |
| `JWT_EXPIRES_IN` | JWT token validity duration | `24h` | No |
| `LEDGER_ADAPTER_MODE` | Ledger mode (`mock` or `live`) | `mock` | No |
| `PAYOUT_ADAPTER_MODE` | Payout oracle adapter mode (`mock` or `live`) | `mock` | No |
| `PAYMENT_ADAPTER_MODE`| Payment provider adapter mode (`mock` or `live`) | `mock` | No |
| `UPI_AUTOPAY_MAX_RETRIES`| Maximum retry attempts on failed debits | `3` | No |
| `UPI_AUTOPAY_MERCHANT_VPA`| Virtual Payment Address for institutional lender | `microstream@icici` | No |
| `FABRIC_GATEWAY_PEER_ENDPOINT`| Hyperledger Fabric / Drunix peer endpoint | `localhost:7051` | Only if `LEDGER_ADAPTER_MODE=live` |
| `FABRIC_CHANNEL_NAME`| Target consortium channel name | `microstream-channel` | Only if `LEDGER_ADAPTER_MODE=live` |
| `FABRIC_CHAINCODE_NAME`| Deployed chaincode name | `microstream` | Only if `LEDGER_ADAPTER_MODE=live` |
| `FABRIC_MSP_ID` | Membership Service Provider identifier | `Org1MSP` | Only if `LEDGER_ADAPTER_MODE=live` |

---

## 2. Secrets Management & Security Posture

1. **Production Overrides**:
   - `JWT_SECRET` must be set via an environment secret or key vault (e.g. AWS Secrets Manager, HashiCorp Vault, or Kubernetes Secret).
   - In production (`NODE_ENV=production`), the application issues a startup warning if default mock secrets are detected.
2. **Database Fallback Behavior**:
   - If `DATABASE_URL` is unreachable or unconfigured during local development, the backend automatically falls back to an in-memory PostgreSQL engine (`pg-mem`), auto-applies schema migrations, and loads synthetic demo data without requiring a local Postgres daemon.
3. **No Sensitive PII in Logs**:
   - Request logging explicitly excludes authorization tokens, passwords, bank account details, and full VPA addresses.
   - PII is masked at the database query layer before being delivered to lender endpoints.

---

## 3. Adapter Mode Switching

The architecture uses an Adapter Pattern enabling zero-code changes between local hackathon simulation and enterprise production:

```ts
// backend/src/adapters/ledger/index.ts
export function getLedgerAdapter(): ILedgerAdapter {
  const mode = config.ledgerAdapterMode;
  if (mode === 'live') {
    return new FabricGatewayAdapter();
  }
  return new MockLedgerAdapter();
}
```

- **MOCK Mode (Default)**: Executes all transactions deterministically in memory and in PostgreSQL with simulated cryptographically valid transaction IDs, hashes, and block numbers.
- **LIVE Mode**: Connects to an external Hyperledger Fabric or NPCI Drunix peer gateway using gRPC and an authorized X.509 certificate.

---

## 4. Default Port Allocation

- **Frontend Application**: `http://localhost:3000`
- **Backend API Service**: `http://localhost:4000`
- **PostgreSQL / YugabyteDB**: `localhost:5432`
- **Docker Container Ports**:
  - `microstream-frontend`: `3000 -> 80`
  - `microstream-backend`: `4000 -> 4000`
  - `microstream-db`: `5432 -> 5432`
