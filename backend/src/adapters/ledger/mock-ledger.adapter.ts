import {
  ILedgerAdapter,
  WorkerProfile,
  ConsentRecord,
  GrantConsentRequest,
  EarningsRecord,
  LogEarningsRequest,
  WorkerEarningsSummary,
  Loan,
  IssueLoanRequest,
  Repayment,
  calculateDeduction,
} from '@microstream/shared';
import { inMemoryStore } from '../../db/in-memory-store.js';
import crypto from 'crypto';

export class MockLedgerAdapter implements ILedgerAdapter {
  public readonly isMock = true;
  public readonly providerName = 'Drunix Mock Hyperledger Fabric Chaincode + YugabyteDB';

  async registerWorkerDID(
    profile: Omit<WorkerProfile, 'joinedAt' | 'creditTier' | 'riskScore'> & { riskScore?: number }
  ): Promise<{ did: string; txHash: string }> {
    const did = profile.did || `did:drunix:worker:${crypto.randomBytes(4).toString('hex')}`;
    const fullProfile: WorkerProfile = {
      ...profile,
      did,
      joinedAt: new Date().toISOString(),
      creditTier: (profile.riskScore ?? 75) >= 80 ? 'PRIME_A' : 'STANDARD_B',
      riskScore: profile.riskScore ?? 75,
      status: 'ACTIVE',
    };

    inMemoryStore.workers.set(did, fullProfile);
    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    return { did, txHash };
  }

  async getWorkerDID(did: string): Promise<WorkerProfile | null> {
    return inMemoryStore.workers.get(did) || null;
  }

  async grantConsent(request: GrantConsentRequest): Promise<ConsentRecord> {
    const id = `cns_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + request.durationDays * 86400000).toISOString();
    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;

    const consent: ConsentRecord = {
      id,
      did: request.did,
      grantee: request.grantee,
      scope: request.scope,
      purpose: request.purpose,
      status: 'ACTIVE',
      grantedAt: now.toISOString(),
      expiresAt,
      txHash,
      blockNumber: 1500 + inMemoryStore.consents.size,
    };

    inMemoryStore.consents.set(id, consent);
    return consent;
  }

  async getConsent(did: string, grantee: string): Promise<ConsentRecord | null> {
    for (const c of inMemoryStore.consents.values()) {
      if (c.did === did && c.grantee === grantee && c.status === 'ACTIVE') {
        return c;
      }
    }
    return null;
  }

  // Core Chaincode Method: LogDailyEarnings
  async logDailyEarnings(
    request: LogEarningsRequest
  ): Promise<{ earningsId: string; txHash: string; blockNumber: number }> {
    // Check duplicates by did + date + reference
    for (const er of inMemoryStore.earnings.values()) {
      if (er.did === request.did && er.date === request.date && er.reference === request.reference) {
        return {
          earningsId: er.id,
          txHash: er.txHash || `0x${crypto.randomBytes(32).toString('hex')}`,
          blockNumber: er.blockNumber || 2500,
        };
      }
    }

    const earningsId = `ern_${crypto.randomBytes(6).toString('hex')}`;
    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    const blockNumber = 2500 + inMemoryStore.earnings.size;

    const record: EarningsRecord = {
      id: earningsId,
      did: request.did,
      platformId: request.platformId,
      date: request.date,
      grossEarningsPaise: request.grossEarningsPaise,
      netEarningsPaise: request.netEarningsPaise ?? Math.round(request.grossEarningsPaise * 0.92),
      ordersOrTripsCount: request.ordersOrTripsCount ?? 15,
      reference: request.reference,
      status: 'RECORDED',
      recordedAt: new Date().toISOString(),
      txHash,
      blockNumber,
    };

    inMemoryStore.earnings.set(earningsId, record);
    return { earningsId, txHash, blockNumber };
  }

  // Core Chaincode Method: CalculateDeduction
  // Formula: deduction = min( payoutAmount * deductionRate, outstandingBalance, dailyCap )
  async calculateDeduction(
    loanId: string,
    payoutAmountPaise: number,
    payoutRef: string
  ): Promise<{
    deductionPaise: number;
    instructionId: string;
    idempotencyKey: string;
    outstandingBalancePaise: number;
    dailyCapPaise: number;
  }> {
    const loan = inMemoryStore.loans.get(loanId);
    if (!loan) {
      throw new Error(`Loan ${loanId} not found on ledger`);
    }

    if (loan.status !== 'ACTIVE' || loan.outstandingBalancePaise <= 0) {
      return {
        deductionPaise: 0,
        instructionId: '',
        idempotencyKey: '',
        outstandingBalancePaise: loan.outstandingBalancePaise,
        dailyCapPaise: loan.dailyCapPaise,
      };
    }

    const deductionResult = calculateDeduction({
      payoutAmountPaise,
      deductionRateBps: loan.deductionRateBps,
      outstandingBalancePaise: loan.outstandingBalancePaise,
      dailyCapPaise: loan.dailyCapPaise,
    });

    const idempotencyKey = `IDEMP_DEBIT_${loanId}_${payoutRef}`;
    const instructionId = `ins_${crypto.randomBytes(6).toString('hex')}`;

    // Store pending debit instruction in ledger state
    inMemoryStore.debitInstructions.set(instructionId, {
      instructionId,
      loanId,
      did: loan.did,
      payoutId: payoutRef,
      amountPaise: deductionResult.deductionPaise,
      status: 'PENDING',
      idempotencyKey,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
    });

    return {
      deductionPaise: deductionResult.deductionPaise,
      instructionId,
      idempotencyKey,
      outstandingBalancePaise: loan.outstandingBalancePaise,
      dailyCapPaise: loan.dailyCapPaise,
    };
  }

  // Core Chaincode Method: UpdateLoanBalance
  async updateLoanBalance(params: {
    loanId: string;
    debitInstructionId: string;
    success: boolean;
    amountDebitedPaise: number;
    upiRef: string;
    failureReason?: string;
  }): Promise<{ loan: Loan; repayment?: Repayment; txHash: string }> {
    const loan = inMemoryStore.loans.get(params.loanId);
    if (!loan) {
      throw new Error(`Loan ${params.loanId} not found`);
    }

    const instruction = inMemoryStore.debitInstructions.get(params.debitInstructionId);
    if (!instruction) {
      throw new Error(`Debit instruction ${params.debitInstructionId} not found`);
    }

    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    const now = new Date().toISOString();

    if (params.success) {
      const deductionPaise = Math.min(params.amountDebitedPaise, loan.outstandingBalancePaise);
      const prevBalance = loan.outstandingBalancePaise;
      loan.outstandingBalancePaise -= deductionPaise;
      loan.totalRepaidPaise += deductionPaise;

      const isFinalSettlement = loan.outstandingBalancePaise === 0;
      if (isFinalSettlement) {
        loan.status = 'SETTLED';
        loan.settledAt = now;
      }

      instruction.status = 'SUCCESS';
      instruction.executedAt = now;
      instruction.upiRef = params.upiRef;
      instruction.txHash = txHash;

      const repaymentId = `rep_${crypto.randomBytes(6).toString('hex')}`;
      const repayment: Repayment = {
        id: repaymentId,
        loanId: loan.loanId,
        debitInstructionId: params.debitInstructionId,
        did: loan.did,
        amountPaise: deductionPaise,
        previousBalancePaise: prevBalance,
        newOutstandingBalancePaise: loan.outstandingBalancePaise,
        isFinalSettlement,
        settledAt: now,
        upiRef: params.upiRef,
        txHash,
      };

      inMemoryStore.repayments.set(repaymentId, repayment);
      inMemoryStore.loans.set(loan.loanId, loan);

      return { loan, repayment, txHash };
    } else {
      instruction.status = 'FAILED';
      instruction.failureReason = params.failureReason || 'UPI debit failed';
      instruction.retryCount += 1;
      inMemoryStore.debitInstructions.set(instruction.instructionId, instruction);

      return { loan, txHash };
    }
  }

  async issueLoan(request: IssueLoanRequest): Promise<Loan> {
    const loanId = `LN-2026-${String(inMemoryStore.loans.size + 1).padStart(3, '0')}`;
    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;

    const loan: Loan = {
      loanId,
      did: request.did,
      lenderId: request.lenderId,
      lenderName: request.lenderName || 'Kotak Microfinance',
      principalPaise: request.principalPaise,
      outstandingBalancePaise: request.principalPaise,
      interestRateBps: 1200, // 12% default
      deductionRateBps: request.deductionRateBps,
      dailyCapPaise: request.dailyCapPaise || 0,
      totalRepaidPaise: 0,
      mandateId: request.mandateId,
      status: 'ACTIVE',
      purpose: request.purpose || 'Working Capital Loan',
      issuedAt: new Date().toISOString(),
      txHash,
    };

    inMemoryStore.loans.set(loanId, loan);
    return loan;
  }

  async getLoan(loanId: string): Promise<Loan | null> {
    return inMemoryStore.loans.get(loanId) || null;
  }

  async getActiveLoanByDid(did: string): Promise<Loan | null> {
    for (const loan of inMemoryStore.loans.values()) {
      if (loan.did === did && loan.status === 'ACTIVE') {
        return loan;
      }
    }
    return null;
  }

  async listLoans(filter?: { did?: string; status?: string }): Promise<Loan[]> {
    return Array.from(inMemoryStore.loans.values()).filter((l) => {
      if (filter?.did && l.did !== filter.did) return false;
      if (filter?.status && l.status !== filter.status) return false;
      return true;
    });
  }

  async getEarningsSummary(did: string, days = 30): Promise<WorkerEarningsSummary> {
    const earnings = await this.listEarnings(did, days);
    if (earnings.length === 0) {
      return {
        did,
        totalEarningsPaise: 0,
        averageDailyEarningsPaise: 0,
        activeDaysCount: 0,
        daysEvaluated: days,
        volatilityPaise: 0,
        periodStart: new Date(Date.now() - days * 86400000).toISOString().split('T')[0],
        periodEnd: new Date().toISOString().split('T')[0],
      };
    }

    const totalPaise = earnings.reduce((acc, cur) => acc + cur.grossEarningsPaise, 0);
    const avgPaise = Math.round(totalPaise / earnings.length);

    // Calculate sample standard deviation
    const squareDiffs = earnings.map((e) => Math.pow(e.grossEarningsPaise - avgPaise, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / earnings.length;
    const volatilityPaise = Math.round(Math.sqrt(avgSquareDiff));

    return {
      did,
      totalEarningsPaise: totalPaise,
      averageDailyEarningsPaise: avgPaise,
      activeDaysCount: earnings.length,
      daysEvaluated: days,
      volatilityPaise,
      periodStart: earnings[earnings.length - 1]?.date || '',
      periodEnd: earnings[0]?.date || '',
    };
  }

  async listEarnings(did: string, limit = 50): Promise<EarningsRecord[]> {
    return Array.from(inMemoryStore.earnings.values())
      .filter((e) => e.did === did)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  async listRepayments(loanId?: string): Promise<Repayment[]> {
    return Array.from(inMemoryStore.repayments.values())
      .filter((r) => !loanId || r.loanId === loanId)
      .sort((a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime());
  }
}
