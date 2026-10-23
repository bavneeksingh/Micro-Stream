# 🏗️ MicroStream Infrastructure Guide

This directory contains container definitions and deployment manifests for running MicroStream locally or in containerized staging environments.

## Services Overview

| Service | Technology | Port | Purpose |
|---|---|---|---|
| **Database** | PostgreSQL 15 (YugabyteDB compatible) | `5432` | State DB initialized with `database/schema.sql` and `database/seed.sql` |
| **Backend** | Node.js, Express, TypeScript | `4000` | MicroStream API, Payout Oracle Webhook, UPI AutoPay Adapter |
| **Frontend** | React, Vite, Tailwind CSS, Nginx | `3000` (`80` in container) | Worker Dashboard, Lender Risk Portal, Stream Simulator |

## Running with Docker Compose

Ensure Docker and Docker Compose are installed:

```bash
docker compose -f infrastructure/docker-compose.yml up --build
```

Access services:
- Frontend: `http://localhost:3000`
- Backend Health: `http://localhost:4000/api/health`
- PostgreSQL: `localhost:5432` (user: `postgres`, password: `postgrespassword`, db: `microstream`)

## Running Locally Without Docker

MicroStream has a standalone in-memory mode that starts instantly without requiring Docker, PostgreSQL, or external blockchain peers:

```bash
# 1. Install dependencies across all monorepo workspaces
npm install

# 2. Build the shared TypeScript package
npm run build -w shared

# 3. Start backend and frontend concurrently
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
