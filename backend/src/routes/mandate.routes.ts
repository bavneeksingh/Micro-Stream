import { Router } from 'express';
import { IPaymentProviderAdapter } from '@microstream/shared';

export function createMandateRoutes(paymentAdapter: IPaymentProviderAdapter): Router {
  const router = Router();

  // Get active mandate for worker DID
  router.get('/:did', async (req, res) => {
    const mandate = await paymentAdapter.getMandateByDid(req.params.did);
    if (!mandate) {
      return res.status(404).json({ error: 'No active mandate found for worker DID' });
    }
    res.json(mandate);
  });

  // Create or authorize new UPI AutoPay mandate
  router.post('/', async (req, res) => {
    try {
      const { did, vpa, bankAccountMasked, ifscCode, maxAmountPaise, durationMonths } = req.body;

      if (!did || !vpa || !maxAmountPaise) {
        return res.status(400).json({ error: 'did, vpa, and maxAmountPaise are required' });
      }

      const mandate = await paymentAdapter.createMandate({
        did,
        vpa,
        bankAccountMasked: bankAccountMasked || 'XXXX1234',
        ifscCode: ifscCode || 'SBIN0001234',
        maxAmountPaise: parseInt(maxAmountPaise, 10),
        durationMonths: durationMonths ? parseInt(durationMonths, 10) : 12,
      });

      res.status(201).json(mandate);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create mandate' });
    }
  });

  return router;
}
