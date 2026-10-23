import { Router, Request, Response } from 'express';
import { RiskService } from '../services/risk.service.js';
import { cashFlowAnalyticsService } from '../services/cashflow-analytics.service.js';

export function createAnalyticsRoutes(riskService: RiskService): Router {
  const router = Router();

  // GET /api/analytics/portfolio (Portfolio summary)
  router.get('/portfolio', async (_req, res, next) => {
    try {
      const summary = await riskService.getPortfolioSummary();
      res.json(summary);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/analytics/workers/:workerId/cashflow (Rolling 30d/60d cash-flow analytics)
  router.get('/workers/:workerId/cashflow', async (req: Request, res: Response, next) => {
    try {
      const { workerId } = req.params;
      const windowDays = req.query.window === '60' ? 60 : 30;
      const analytics = await cashFlowAnalyticsService.calculateWorkerAnalytics(workerId, windowDays);
      res.json(analytics);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/analytics/workers/:workerId/risk-assessment (Transparent rules-based risk assessment)
  router.get('/workers/:workerId/risk-assessment', async (req: Request, res: Response, next) => {
    try {
      const { workerId } = req.params;
      const windowDays = req.query.window === '60' ? 60 : 30;
      const assessment = await cashFlowAnalyticsService.evaluateRulesBasedRisk(workerId, windowDays);
      res.json(assessment);
    } catch (err) {
      next(err);
    }
  });

  // Backward compatibility: GET /api/analytics/risk
  router.get('/risk', async (_req, res, next) => {
    try {
      const profiles = await riskService.getAllWorkersRiskProfiles();
      res.json({ profiles, count: profiles.length });
    } catch (err) {
      next(err);
    }
  });

  // Backward compatibility: GET /api/analytics/risk/:did
  router.get('/risk/:did', async (req, res, next) => {
    try {
      const profile = await riskService.getWorkerRiskProfile(req.params.did);
      if (!profile) {
        return res.status(404).json({ error: 'Worker risk profile not found' });
      }
      res.json(profile);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
