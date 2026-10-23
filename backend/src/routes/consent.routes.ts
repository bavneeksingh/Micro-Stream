import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/db.js';
import { authenticateToken, requireWorker } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const createConsentSchema = z.object({
  grantee: z.string().min(2),
  scope: z.union([z.string(), z.array(z.string())]),
  purpose: z.string().min(3),
  expiresAt: z.string().optional(),
});

export function createConsentRoutes(): Router {
  const router = Router();

  // GET /api/consents (List consents for the authenticated worker or by workerId query)
  router.get('/', authenticateToken, async (req: Request, res: Response, next) => {
    try {
      let workerId = req.user!.workerId;
      if (!workerId && (req.user!.role === 'LENDER' || req.user!.role === 'ADMIN') && req.query.workerId) {
        workerId = req.query.workerId as string;
      }

      const query = workerId
        ? 'SELECT * FROM consent_grants WHERE worker_id = $1 ORDER BY granted_at DESC'
        : 'SELECT * FROM consent_grants ORDER BY granted_at DESC';
      const params = workerId ? [workerId] : [];

      const result = await db.query(query, params);
      res.json({
        consents: result.rows.map((c) => ({
          ...c,
          scope: typeof c.scope === 'string' && c.scope.includes(',') ? c.scope.split(',') : [c.scope],
        })),
        total: result.rows.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/consents (Worker grants data access consent)
  router.post(
    '/',
    authenticateToken,
    requireWorker,
    validateBody(createConsentSchema),
    async (req: Request, res: Response, next) => {
      try {
        const workerId = req.user!.workerId!;
        const { grantee, scope, purpose, expiresAt } = req.body;

        const scopeString = Array.isArray(scope) ? scope.join(',') : scope;
        const expiryDate = expiresAt || new Date(Date.now() + 365 * 86400000).toISOString();
        const consentId = `cns_${Date.now()}`;

        await db.query(
          `INSERT INTO consent_grants (id, worker_id, grantee, scope, purpose, status, expires_at)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)`,
          [consentId, workerId, grantee, scopeString, purpose, expiryDate]
        );

        await db.query(
          `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            `aud_${Date.now()}`,
            req.user!.userId,
            'CONSENT_GRANTED',
            'CONSENT',
            consentId,
            `Worker granted consent to ${grantee} with scope [${scopeString}]`,
          ]
        );

        const createdRes = await db.query('SELECT * FROM consent_grants WHERE id = $1', [consentId]);
        const created = createdRes.rows[0];

        res.status(201).json({
          ...created,
          scope: Array.isArray(scope) ? scope : scope.split(','),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /api/consents/:consentId (Worker revokes data access consent)
  router.delete('/:consentId', authenticateToken, requireWorker, async (req: Request, res: Response, next) => {
    try {
      const { consentId } = req.params;
      const workerId = req.user!.workerId!;

      const consentRes = await db.query('SELECT * FROM consent_grants WHERE id = $1', [consentId]);
      if (consentRes.rows.length === 0) {
        res.status(404).json({
          error: 'Consent grant not found.',
          code: 'CONSENT_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const consent = consentRes.rows[0];

      // Security check: workers can only access/revoke their own records
      if (consent.worker_id !== workerId) {
        res.status(403).json({
          error: 'Forbidden: You cannot revoke another worker’s consent grant.',
          code: 'FORBIDDEN',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await db.query(
        `UPDATE consent_grants
         SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [consentId]
      );

      await db.query(
        `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `aud_${Date.now()}`,
          req.user!.userId,
          'CONSENT_REVOKED',
          'CONSENT',
          consentId,
          `Worker revoked consent ${consentId} granted to ${consent.grantee}`,
        ]
      );

      const updatedRes = await db.query('SELECT * FROM consent_grants WHERE id = $1', [consentId]);
      res.json({
        message: 'Consent grant revoked successfully.',
        consent: updatedRes.rows[0],
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
