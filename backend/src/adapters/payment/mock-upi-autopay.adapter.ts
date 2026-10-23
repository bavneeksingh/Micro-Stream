import {
  IPaymentProviderAdapter,
  AutoPayMandate,
  CreateMandateRequest,
  ExecuteDebitRequest,
  DebitResult,
} from '@microstream/shared';
import { inMemoryStore } from '../../db/in-memory-store.js';
import crypto from 'crypto';

export class MockUPIAutoPayAdapter implements IPaymentProviderAdapter {
  public readonly isMock = true;
  public readonly providerName = 'NPCI UPI AutoPay Simulator (MOCK - NO REAL DEBITS)';

  // In-memory idempotency cache for debit executions
  private executedDebits: Map<string, DebitResult> = new Map();

  async createMandate(request: CreateMandateRequest): Promise<AutoPayMandate> {
    const mandateId = `mnd_${crypto.randomBytes(6).toString('hex')}`;
    const umrn = `UMRN${new Date().getFullYear()}MOCK${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date();
    const durationMonths = request.durationMonths || 12;
    const endDate = new Date(now.getFullYear(), now.getMonth() + durationMonths, now.getDate())
      .toISOString()
      .split('T')[0];

    const mandate: AutoPayMandate = {
      mandateId,
      umrn,
      did: request.did,
      vpa: request.vpa,
      bankAccountMasked: request.bankAccountMasked,
      ifscCode: request.ifscCode,
      maxAmountPaise: Math.round(request.maxAmountPaise),
      frequency: 'AS_PRESENTED',
      status: 'ACTIVE',
      startDate: now.toISOString().split('T')[0],
      endDate,
      authorizedAt: now.toISOString(),
    };

    inMemoryStore.mandates.set(mandateId, mandate);

    // Update worker's active mandate pointer
    const worker = inMemoryStore.workers.get(request.did);
    if (worker) {
      worker.activeMandateId = mandateId;
      inMemoryStore.workers.set(request.did, worker);
    }

    return mandate;
  }

  async getMandate(mandateId: string): Promise<AutoPayMandate | null> {
    return inMemoryStore.mandates.get(mandateId) || null;
  }

  async getMandateByDid(did: string): Promise<AutoPayMandate | null> {
    for (const mandate of inMemoryStore.mandates.values()) {
      if (mandate.did === did && mandate.status === 'ACTIVE') {
        return mandate;
      }
    }
    return null;
  }

  /**
   * Simulates a variable UPI AutoPay debit under an existing mandate.
   * STRICT SAFETY RULE: All debits are simulated in memory. No real UPI network calls.
   */
  async executeDebit(request: ExecuteDebitRequest): Promise<DebitResult> {
    // 1. Idempotency Check
    if (this.executedDebits.has(request.idempotencyKey)) {
      console.log(`[MockUPIAutoPay] Idempotent request detected for key: ${request.idempotencyKey}`);
      return this.executedDebits.get(request.idempotencyKey)!;
    }

    // 2. Validate mandate
    const mandate = inMemoryStore.mandates.get(request.mandateId);
    if (!mandate) {
      const result: DebitResult = {
        success: false,
        instructionId: request.instructionId,
        amountDebitedPaise: 0,
        errorCode: 'MANDATE_NOT_FOUND',
        errorMessage: `UPI AutoPay mandate ${request.mandateId} not found`,
        timestamp: new Date().toISOString(),
      };
      this.executedDebits.set(request.idempotencyKey, result);
      return result;
    }

    if (mandate.status !== 'ACTIVE') {
      const result: DebitResult = {
        success: false,
        instructionId: request.instructionId,
        amountDebitedPaise: 0,
        errorCode: 'MANDATE_INACTIVE',
        errorMessage: `UPI AutoPay mandate ${request.mandateId} is not ACTIVE (status: ${mandate.status})`,
        timestamp: new Date().toISOString(),
      };
      this.executedDebits.set(request.idempotencyKey, result);
      return result;
    }

    // 3. Validate mandate limit
    if (request.amountPaise > mandate.maxAmountPaise) {
      const result: DebitResult = {
        success: false,
        instructionId: request.instructionId,
        amountDebitedPaise: 0,
        errorCode: 'EXCEEDS_MANDATE_CAP',
        errorMessage: `Debit amount (${request.amountPaise} paise) exceeds mandate cap (${mandate.maxAmountPaise} paise)`,
        timestamp: new Date().toISOString(),
      };
      this.executedDebits.set(request.idempotencyKey, result);
      return result;
    }

    // 4. Simulate successful variable debit execution
    const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const upiRef = `UPI/${yyyymmdd}/${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const result: DebitResult = {
      success: true,
      instructionId: request.instructionId,
      amountDebitedPaise: request.amountPaise,
      upiRef,
      timestamp: new Date().toISOString(),
    };

    this.executedDebits.set(request.idempotencyKey, result);
    return result;
  }

  async cancelMandate(mandateId: string): Promise<AutoPayMandate> {
    const mandate = inMemoryStore.mandates.get(mandateId);
    if (!mandate) {
      throw new Error(`Mandate ${mandateId} not found`);
    }

    mandate.status = 'REVOKED';
    mandate.revokedAt = new Date().toISOString();
    inMemoryStore.mandates.set(mandateId, mandate);
    return mandate;
  }
}
