import { Router } from 'express';
import { ILedgerAdapter } from '@microstream/shared';

export function createLoanRoutes(ledgerAdapter: ILedgerAdapter): Router {
  const router = Router();

  // List all loans
  router.get('/', async (req, res) => {
    const { did, status } = req.query;
    const loans = await ledgerAdapter.listLoans({
      did: did as string | undefined,
      status: status as string | undefined,
    });
    res.json({ loans, total: loans.length });
  });

  // Get loan by ID
  router.get('/:loanId', async (req, res) => {
    const loan = await ledgerAdapter.getLoan(req.params.loanId);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const repayments = await ledgerAdapter.listRepayments(loan.loanId);
    res.json({ loan, repayments });
  });

  // Issue a new micro-loan
  router.post('/', async (req, res) => {
    try {
      const { did, lenderId, lenderName, principalPaise, deductionRateBps, dailyCapPaise, mandateId, purpose } = req.body;

      if (!did || !principalPaise || !deductionRateBps || !mandateId) {
        return res.status(400).json({
          error: 'did, principalPaise, deductionRateBps, and mandateId are required',
        });
      }

      const loan = await ledgerAdapter.issueLoan({
        did,
        lenderId: lenderId || 'lender-kotak-micro',
        lenderName: lenderName || 'Kotak Microfinance',
        principalPaise: parseInt(principalPaise, 10),
        deductionRateBps: parseInt(deductionRateBps, 10),
        dailyCapPaise: dailyCapPaise ? parseInt(dailyCapPaise, 10) : 0,
        mandateId,
        purpose: purpose || 'Working Capital Loan',
      });

      res.status(201).json(loan);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to issue loan' });
    }
  });

  return router;
}
