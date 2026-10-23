import { Router } from 'express';
import { inMemoryStore } from '../db/in-memory-store.js';

export function createStreamRoutes(): Router {
  const router = Router();

  // List all settled repayments
  router.get('/repayments', (req, res) => {
    const { loanId, did } = req.query;
    let reps = Array.from(inMemoryStore.repayments.values());

    if (loanId) {
      reps = reps.filter((r) => r.loanId === loanId);
    }
    if (did) {
      reps = reps.filter((r) => r.did === did);
    }

    reps.sort((a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime());
    res.json({ repayments: reps, total: reps.length });
  });

  // List all debit instructions
  router.get('/debits', (req, res) => {
    const { loanId, did } = req.query;
    let debits = Array.from(inMemoryStore.debitInstructions.values());

    if (loanId) {
      debits = debits.filter((d) => d.loanId === loanId);
    }
    if (did) {
      debits = debits.filter((d) => d.did === did);
    }

    debits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ debitInstructions: debits, total: debits.length });
  });

  // Demo helper: Reset store to synthetic initial seed state
  router.post('/reset', (_req, res) => {
    inMemoryStore.reset();
    res.json({ success: true, message: 'Store reset to synthetic seed dataset.' });
  });

  return router;
}
