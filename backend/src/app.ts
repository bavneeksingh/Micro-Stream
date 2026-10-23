import express from 'express';
import cors from 'cors';
import { db } from './db/db.js';
import { globalRateLimiter } from './middleware/rate-limiter.js';
import { errorHandler } from './middleware/error-handler.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createWorkerRoutes } from './routes/worker.routes.js';
import { createLoanRoutes } from './routes/loan.routes.js';
import { createConsentRoutes } from './routes/consent.routes.js';
import { createLenderRoutes } from './routes/lender.routes.js';
import { createPayoutRoutes } from './routes/payout.routes.js';
import { createAuditRoutes } from './routes/audit.routes.js';
import { createHealthRoutes } from './routes/health.routes.js';
import { createMandateRoutes } from './routes/mandate.routes.js';
import { createStreamRoutes } from './routes/stream.routes.js';
import { createAnalyticsRoutes } from './routes/analytics.routes.js';
import { MockLedgerAdapter } from './adapters/ledger/mock-ledger.adapter.js';
import { MockPayoutProviderAdapter } from './adapters/payout/mock-payout.adapter.js';
import { MockUPIAutoPayAdapter } from './adapters/payment/mock-upi-autopay.adapter.js';
import { StreamEngineService } from './services/stream-engine.service.js';
import { RiskService } from './services/risk.service.js';

export function createApp() {
  const app = express();

  // 1. Core Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(globalRateLimiter);

  // 2. Structured Request Logging Middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.path !== '/api/health') {
        console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // 3. Instantiate Mock Adapters & Services (for backward compatibility & simulations)
  const ledgerAdapter = new MockLedgerAdapter();
  const payoutAdapter = new MockPayoutProviderAdapter();
  const paymentAdapter = new MockUPIAutoPayAdapter();
  const streamEngine = new StreamEngineService(ledgerAdapter, payoutAdapter, paymentAdapter);
  const riskService = new RiskService();

  // 4. Mount API Routes

  // Health
  app.use('/api/health', createHealthRoutes(ledgerAdapter.isMock, payoutAdapter.isMock, paymentAdapter.isMock));

  // Authentication & Session
  // POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
  app.use('/api/auth', createAuthRoutes());

  // Worker Profile & Records
  // GET /api/workers/me, GET /api/workers/me/earnings, GET /api/workers/me/loans, GET /api/workers/me/repayments
  app.use('/api/workers', createWorkerRoutes());

  // Micro-Loans
  // POST /api/loans/apply, POST /api/loans/:loanId/approve, GET /api/loans
  app.use('/api/loans', createLoanRoutes());

  // Consent Management
  // POST /api/consents, DELETE /api/consents/:consentId, GET /api/consents
  app.use('/api/consents', createConsentRoutes());

  // Lender & Underwriting
  // GET /api/lender/portfolio, GET /api/lender/workers/:workerId/risk
  app.use('/api/lender', createLenderRoutes());

  // Payouts & Real-Time Streaming Simulator
  // GET /api/payouts, POST /api/simulator/payouts, POST /api/payouts/simulate
  const payoutRoutes = createPayoutRoutes();
  app.use('/api/payouts', payoutRoutes);
  app.use('/api/simulator/payouts', (req, res, next) => {
    // Forward /api/simulator/payouts to the simulator handler inside payoutRoutes
    req.url = '/simulator/payouts';
    payoutRoutes(req, res, next);
  });

  // Audit Logs
  // GET /api/audit
  app.use('/api/audit', createAuditRoutes());

  // Compatibility routes
  app.use('/api/mandates', createMandateRoutes(paymentAdapter));
  app.use('/api/stream', createStreamRoutes());
  app.use('/api/analytics', createAnalyticsRoutes(riskService));

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      name: 'MicroStream Backend API',
      description: 'Real-Time Micro-Credit Streaming for Gig Workers',
      database: db.isInMemory ? 'pg-mem' : 'PostgreSQL',
      version: '0.1.0',
      routes: [
        'GET /api/health',
        'GET /api/auth/me',
        'POST /api/auth/login',
        'POST /api/auth/logout',
        'GET /api/workers/me',
        'GET /api/workers/me/earnings',
        'GET /api/workers/me/loans',
        'GET /api/workers/me/repayments',
        'POST /api/loans/apply',
        'POST /api/loans/:loanId/approve',
        'POST /api/consents',
        'DELETE /api/consents/:consentId',
        'GET /api/lender/portfolio',
        'GET /api/lender/workers/:workerId/risk',
        'GET /api/payouts',
        'POST /api/simulator/payouts',
        'GET /api/audit',
      ],
    });
  });

  // 5. Centralized Error Handling Middleware
  app.use(errorHandler);

  return { app, ledgerAdapter, payoutAdapter, paymentAdapter, streamEngine, riskService };
}
