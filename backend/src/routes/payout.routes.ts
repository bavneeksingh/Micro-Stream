import { Router } from 'express';
import { StreamEngineService } from '../services/stream-engine.service.js';
import { IPayoutProviderAdapter } from '@microstream/shared';

export function createPayoutRoutes(
  streamEngine: StreamEngineService,
  payoutAdapter: IPayoutProviderAdapter
): Router {
  const router = Router();

  // Simulate daily platform payout and trigger real-time credit stream
  router.post('/simulate', async (req, res) => {
    try {
      const { did, platformId, amountPaise, reference, payoutDate } = req.body;

      if (!did || !amountPaise) {
        return res.status(400).json({ error: 'did and amountPaise are required' });
      }

      const receipt = await streamEngine.processPayout({
        did,
        platformId: platformId || 'zomato-in',
        amountPaise: parseInt(amountPaise, 10),
        reference,
        payoutDate,
      });

      res.status(200).json(receipt);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error processing simulated payout stream' });
    }
  });

  // List recent payout events
  router.get('/', async (req, res) => {
    const { did, limit } = req.query;
    const payouts = await payoutAdapter.listPayouts(
      did as string | undefined,
      limit ? parseInt(limit as string, 10) : 50
    );
    res.json({ payouts, total: payouts.length });
  });

  return router;
}
