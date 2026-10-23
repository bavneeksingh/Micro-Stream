import { Router } from 'express';
import { RiskService } from '../services/risk.service.js';

export function createAnalyticsRoutes(riskService: RiskService): Router {
  const router = Router();

  // Portfolio level overview (Lender view)
  router.get('/portfolio', async (_req, res) => {
    const summary = await riskService.getPortfolioSummary();
    res.json(summary);
  });

  // Risk profiles for all workers (YugabyteDB direct query simulation)
  router.get('/risk', async (_req, res) => {
    const profiles = await riskService.getAllWorkersRiskProfiles();
    res.json({ profiles, count: profiles.length });
  });

  // Single worker risk profile
  router.get('/risk/:did', async (req, res) => {
    const profile = await riskService.getWorkerRiskProfile(req.params.did);
    if (!profile) {
      return res.status(404).json({ error: 'Worker risk profile not found' });
    }
    res.json(profile);
  });

  return router;
}
