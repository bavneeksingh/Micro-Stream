import { Router } from 'express';
import { AutoPayProviderAdapter } from '../adapters/payment/index.js';
import { db } from '../db/db.js';

export function createMandateRoutes(paymentAdapter: AutoPayProviderAdapter): Router {
  const router = Router();

  // GET /api/mandates - List all mandates (optionally filtered by worker did)
  router.get('/', async (req, res, next) => {
    try {
      const did = req.query.did as string;
      const mandates = await paymentAdapter.listMandates(did);
      res.json({ mandates, total: mandates.length });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/mandates/audit - Retrieve adapter audit trail
  router.get('/audit', async (_req, res, next) => {
    try {
      const auditTrail = (paymentAdapter as any).getAuditTrail ? (paymentAdapter as any).getAuditTrail() : [];
      res.json({ auditTrail });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/mandates/:did - Get active mandate for worker DID
  router.get('/:did', async (req, res, next) => {
    try {
      const mandate = await paymentAdapter.getMandateByDid(req.params.did);
      if (!mandate) {
        return res.status(404).json({ error: 'No active or pending mandate found for worker DID' });
      }
      res.json(mandate);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/mandates - Create new UPI AutoPay simulated mandate (AWAITING_AUTHORIZATION by default)
  router.post('/', async (req, res, next) => {
    try {
      const { did, vpa, bankAccountMasked, ifscCode, maxAmountPaise, durationMonths, frequency, autoApprove } = req.body;

      if (!did || !vpa || !maxAmountPaise) {
        return res.status(400).json({ error: 'did, vpa, and maxAmountPaise are required' });
      }

      const mandate = await paymentAdapter.createMandate({
        did,
        vpa,
        bankAccountMasked: bankAccountMasked || 'XXXX1234',
        ifscCode: ifscCode || 'SBIN0001234',
        maxAmountPaise: parseInt(maxAmountPaise, 10),
        frequency: frequency || 'AS_PRESENTED',
        durationMonths: durationMonths ? parseInt(durationMonths, 10) : 12,
      }, Boolean(autoApprove));

      // Also persist to PostgreSQL payment_mandates table if worker profile exists
      try {
        const workerRes = await db.query(`SELECT id FROM worker_profiles WHERE did = $1`, [did]);
        if (workerRes.rows.length > 0) {
          const workerId = workerRes.rows[0].id;
          await db.query(
            `INSERT INTO payment_mandates (
               id, umrn, worker_id, vpa, bank_account_masked, ifsc_code,
               max_amount_paise, frequency, status, start_date, end_date, authorized_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, authorized_at = EXCLUDED.authorized_at`,
            [
              mandate.mandateId,
              mandate.umrn,
              workerId,
              mandate.vpa,
              mandate.bankAccountMasked,
              mandate.ifscCode,
              mandate.maxAmountPaise,
              mandate.frequency,
              mandate.status,
              mandate.startDate,
              mandate.endDate,
              mandate.authorizedAt || null,
            ]
          );
        }
      } catch (dbErr: any) {
        console.warn(`[MandatesRoute] DB sync warning: ${dbErr.message}`);
      }

      res.status(201).json(mandate);
    } catch (err: any) {
      next(err);
    }
  });

  // POST /api/mandates/:mandateId/approve - Demo user approves mandate
  router.post('/:mandateId/approve', async (req, res, next) => {
    try {
      const { mandateId } = req.params;
      const mandate = await paymentAdapter.approveMandate(mandateId);

      // Sync to database
      try {
        await db.query(
          `UPDATE payment_mandates SET status = 'ACTIVE', authorized_at = $1 WHERE id = $2`,
          [mandate.authorizedAt, mandateId]
        );
      } catch (dbErr: any) {
        console.warn(`[MandatesRoute] DB sync warning: ${dbErr.message}`);
      }

      res.json({
        success: true,
        message: `Mandate ${mandateId} authorized successfully. Status is now ACTIVE.`,
        mandate,
      });
    } catch (err: any) {
      next(err);
    }
  });

  // POST /api/mandates/:mandateId/cancel - Revoke mandate
  router.post('/:mandateId/cancel', async (req, res, next) => {
    try {
      const { mandateId } = req.params;
      const mandate = await paymentAdapter.cancelMandate(mandateId);

      try {
        await db.query(
          `UPDATE payment_mandates SET status = 'REVOKED' WHERE id = $1`,
          [mandateId]
        );
      } catch (dbErr: any) {
        console.warn(`[MandatesRoute] DB sync warning: ${dbErr.message}`);
      }

      res.json({
        success: true,
        message: `Mandate ${mandateId} revoked.`,
        mandate,
      });
    } catch (err: any) {
      next(err);
    }
  });

  return router;
}
