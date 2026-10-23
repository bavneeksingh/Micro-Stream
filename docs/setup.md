# 🚀 MicroStream Setup & Execution Guide

Follow this guide to launch, verify, and run the MicroStream application from a clean environment.

---

## 1. Prerequisites

- **Node.js**: `v18.0.0` or higher (`v20+` recommended, tested on `v22.13.1`).
- **Package Manager**: `npm v9.0.0+`.
- **Operating System**: macOS, Linux, or Windows (PowerShell/CMD).
- **Optional**:
  - `Docker` & `Docker Compose` (for containerized deployment).
  - `Go v1.21+` (only required if building/testing chaincode binaries natively).

---

## 2. Quickstart: Clean Local Launch

### Step 1: Clone & Install Dependencies
From the repository root:
```bash
npm install
```

### Step 2: Build All Monorepo Workspaces
Builds `@microstream/shared`, `@microstream/backend`, and `@microstream/frontend`:
```bash
npm run build
```

### Step 3: Verify TypeScript Types
Ensures zero type or compilation errors across all projects:
```bash
npm run typecheck
```

### Step 4: Run the Automated Test Suite
Executes the full automated Vitest suites across shared, frontend, and backend packages:
```bash
npm test
```

### Step 5: Start the Development Servers
Launches both the backend API (port 4000) and the frontend dashboard (port 3000) concurrently:
```bash
npm run dev
```
Alternatively, launch services in dedicated terminal tabs:
- Backend: `npm run dev:backend`
- Frontend: `npm run dev:frontend`

---

## 3. Development Reset Command

To restore the application to a pristine initial state, wipe simulated data, re-apply database schemas, and re-seed all synthetic earnings and demo profiles, execute:

```bash
npm run reset
```

This command:
1. Pings the live backend daemon at `/api/stream/reset` to reset memory stores.
2. Re-runs `npm run build` across all packages.
3. Re-executes the synthetic seed script, restoring 60 days of earnings, loans, and debit records.

---

## 4. Containerized Deployment with Docker Compose

To run the complete stack with an actual PostgreSQL 15 container:

```bash
cd infrastructure
docker-compose up --build
```

Services started:
- `microstream-db`: PostgreSQL 15 on port `5432` with automated schema DDL (`database/schema.sql`) and seed (`database/seed.sql`).
- `microstream-backend`: Production Node.js backend on port `4000`.
- `microstream-frontend`: Production Nginx web server serving Vite frontend build on port `3000`.

To stop the containers:
```bash
docker-compose down -v
```

---

## 5. Demo Personas & Pre-Seeded Accounts

All demo accounts share the standard password: `Password123!`

| Persona | Role | Email | Profile Details |
| :--- | :--- | :--- | :--- |
| **Ravi Kumar** | `WORKER` | `ravi.kumar@zomato-partner.in` | Zomato partner, Prime A tier, steady daily income (54 active days), active EV loan |
| **Sunita Devi** | `WORKER` | `sunita.devi@swiggy-partner.in` | Swiggy partner, Standard B tier, active smartphone loan |
| **Mohammed Arif** | `WORKER` | `arif.cab@uber-driver.in` | Uber driver, Prime A tier, high-volatility earner with weekend surges, active CNG loan |
| **Priya Sharma** | `WORKER` | `priya.salon@urbancompany.in` | Urban Company partner, Standard B tier, small sample (14 days), eligible for new loan |
| **Vikram Singh** | `WORKER` | `vikram.rider@zepto-rider.in` | Zepto rider, Emerging C tier, new worker with insufficient history (4 days), unconsented |
| **Kotak Underwriter** | `LENDER` | `underwriting@kotakmicro.in` | Institutional lender underwriter, access to portfolio analytics and risk center |
| **NPCI Auditor** | `ADMIN` | `auditor@npci.org.in` | Compliance officer, access to full immutable audit trail |

---

## 6. Verification Checklist

1. Open `http://localhost:3000/` in your browser.
2. Click **Demo Accounts** on the login page or select a persona.
3. In **Worker Dashboard** (`/worker`), view today's earnings, current loan balance, and recent repayments.
4. In **Lender Dashboard** (`/lender`), verify aggregate portfolio capital, 30-day earnings inflows chart, debit success rates, and pseudonymous worker table (`ZOM-WRK-DE9E`, etc.).
5. Click **Risk Deep-Dive** for a worker to inspect the 9 cash-flow analytics cards, rolling 30d/60d toggles, daily income bar chart, and explainable rules-based risk indicator table.
6. In **Payout Simulator** (`/simulator`), trigger a simulated daily platform payout and observe the real-time proportional deduction, UPI AutoPay debit, and loan balance reduction.
