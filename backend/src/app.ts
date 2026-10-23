import express from 'express';
import cors from 'cors';
import { MockLedgerAdapter } from './adapters/ledger/mock-ledger.adapter.js';
import { MockPayoutProviderAdapter } from './adapters/payout/mock-payout.adapter.js';
import { MockUPIAutoPayAdapter } from './adapters/payment/mock-upi-autopay.adapter.js';
import { StreamEngineService } from './services/stream-engine.service.js';
import { RiskService } from './services/risk.service.js';
import { createHealthRoutes } from './routes/health.routes.js';
import { createWorkerRoutes } from './routes/worker.routes.js';
import { createLoanRoutes } from './routes/loan.routes.js';
import { createMandateRoutes } from './routes/mandate.routes.js';
import { createPayoutRoutes } from './routes/payout.routes.js';
import { createStreamRoutes } from './routes/stream.routes.js';
import { createAnalyticsRoutes } from './routes/analytics.routes.js';

export function createApp() {
  const app = express();

  // Middlewares
  app.use(cors());
  app.use(express.json());

  // Instantiate Adapters
  const ledgerAdapter = new MockLedgerAdapter();
  const payoutAdapter = new MockPayoutProviderAdapter();
  const paymentAdapter = new MockUPIAutoPayAdapter();

  // Instantiate Services
  const streamEngine = new StreamEngineService(ledgerAdapter, payoutAdapter, paymentAdapter);
  const riskService = new RiskService();

  // API Routes
  app.use('/api/health', createHealthRoutes(ledgerAdapter.isMock, payoutAdapter.isMock, paymentAdapter.isMock));
  app.use('/api/workers', createWorkerRoutes(ledgerAdapter));
  app.use('/api/loans', createLoanRoutes(ledgerAdapter));
  app.use('/api/mandates', createMandateRoutes(paymentAdapter));
  app.use('/api/payouts', createPayoutRoutes(streamEngine, payoutAdapter));
  app.use('/api/stream', createStreamRoutes());
  app.use('/api/analytics', createAnalyticsRoutes(riskService));

  // Root fallback
  app.get('/', (_req, res) => {
    res.json({
      name: 'MicroStream Backend API',
      description: 'Real-Time Micro-Credit Streaming for Gig Workers',
      documentation: '/docs',
      health: '/api/health',
    });
  });

  return { app, ledgerAdapter, payoutAdapter, paymentAdapter, streamEngine, riskService };
}
