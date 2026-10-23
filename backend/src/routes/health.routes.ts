import { Router } from 'express';
import { config } from '../config.js';

export function createHealthRoutes(
  isLedgerMock: boolean,
  isPayoutMock: boolean,
  isPaymentMock: boolean
): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: config.nodeEnv,
      adapters: {
        ledger: {
          mode: config.ledgerAdapterMode,
          isMock: isLedgerMock,
          provider: 'Drunix Mock Hyperledger Fabric Chaincode + YugabyteDB',
        },
        payout: {
          mode: config.payoutAdapterMode,
          isMock: isPayoutMock,
          provider: 'Mock Gig Platform Payout Oracle (Zomato/Swiggy/Uber)',
        },
        payment: {
          mode: config.paymentAdapterMode,
          isMock: isPaymentMock,
          provider: 'NPCI UPI AutoPay Simulator (MOCK - NO REAL DEBITS)',
        },
      },
      currencyRepresentation: 'Integer paise (1 INR = 100 paise)',
    });
  });

  return router;
}
