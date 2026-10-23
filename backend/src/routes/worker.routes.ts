import { Router } from 'express';
import { ILedgerAdapter } from '@microstream/shared';
import { inMemoryStore } from '../db/in-memory-store.js';

export function createWorkerRoutes(ledgerAdapter: ILedgerAdapter): Router {
  const router = Router();

  // List all registered workers
  router.get('/', async (_req, res) => {
    const workers = Array.from(inMemoryStore.workers.values());
    res.json({ workers, total: workers.length });
  });

  // Get specific worker DID profile
  router.get('/:did', async (req, res) => {
    const worker = await ledgerAdapter.getWorkerDID(req.params.did);
    if (!worker) {
      return res.status(404).json({ error: 'Worker DID not found' });
    }

    const earningsSummary = await ledgerAdapter.getEarningsSummary(worker.did, 30);
    const activeLoan = await ledgerAdapter.getActiveLoanByDid(worker.did);
    const mandate = inMemoryStore.mandates.get(worker.activeMandateId || '');

    res.json({
      worker,
      earningsSummary,
      activeLoan,
      mandate,
    });
  });

  // List worker earnings records
  router.get('/:did/earnings', async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 30;
    const records = await ledgerAdapter.listEarnings(req.params.did, limit);
    res.json({ earnings: records, total: records.length });
  });

  // Log new daily earnings (Gig platform oracle ingestion)
  router.post('/:did/earnings', async (req, res) => {
    try {
      const { platformId, date, grossEarningsPaise, netEarningsPaise, reference, ordersCount } = req.body;
      if (!grossEarningsPaise || !reference) {
        return res.status(400).json({ error: 'grossEarningsPaise and reference are required' });
      }

      const result = await ledgerAdapter.logDailyEarnings({
        did: req.params.did,
        platformId: platformId || 'zomato-in',
        date: date || new Date().toISOString().split('T')[0],
        grossEarningsPaise: parseInt(grossEarningsPaise, 10),
        netEarningsPaise: netEarningsPaise ? parseInt(netEarningsPaise, 10) : undefined,
        ordersOrTripsCount: ordersCount ? parseInt(ordersCount, 10) : 15,
        reference,
      });

      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to log daily earnings' });
    }
  });

  return router;
}
