import {
  AutoPayProviderAdapter,
  AutoPayMandate,
  CreateMandateRequest,
  ExecuteDebitRequest,
  DebitResult,
  DebitScenario,
} from '@microstream/shared';
import { inMemoryStore } from '../../db/in-memory-store.js';
import crypto from 'crypto';

export class MockUPIAutoPayAdapter implements AutoPayProviderAdapter {
  public readonly isMock = true;
  public readonly providerName = 'NPCI UPI AutoPay Simulator (MOCK - NO REAL MONEY OR UPI PINS)';

  // In-memory idempotency cache for debit executions
  private executedDebits: Map<string, DebitResult> = new Map();

  // Audit trail of all simulated payment provider interactions
  private auditTrail: Array<{
    action: string;
    mandateId?: string;
    instructionId?: string;
    idempotencyKey?: string;
    details: Record<string, unknown>;
    timestamp: string;
  }> = [];

  /**
   * Create a simulated UPI AutoPay mandate.
   * Default status is 'AWAITING_AUTHORIZATION' until approved by demo user,
   * accurately reflecting the NPCI mandate approval lifecycle.
   */
  async createMandate(request: CreateMandateRequest, autoApprove: boolean = false): Promise<AutoPayMandate> {
    const mandateId = `mnd_${crypto.randomBytes(6).toString('hex')}`;
    const umrn = `UMRN${new Date().getFullYear()}MOCK${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date();
    const durationMonths = request.durationMonths || 12;
    const endDate = new Date(now.getFullYear(), now.getMonth() + durationMonths, now.getDate())
      .toISOString()
      .split('T')[0];

    const initialStatus = autoApprove ? 'ACTIVE' : 'AWAITING_AUTHORIZATION';

    const mandate: AutoPayMandate = {
      mandateId,
      umrn,
      did: request.did,
      vpa: request.vpa,
      bankAccountMasked: request.bankAccountMasked || 'XXXX1234',
      ifscCode: request.ifscCode || 'SBIN0001234',
      maxAmountPaise: Math.round(request.maxAmountPaise),
      frequency: request.frequency || 'AS_PRESENTED',
      status: initialStatus,
      startDate: now.toISOString().split('T')[0],
      endDate,
      authorizedAt: autoApprove ? now.toISOString() : undefined,
    };

    inMemoryStore.mandates.set(mandateId, mandate);

    if (autoApprove) {
      const worker = inMemoryStore.workers.get(request.did);
      if (worker) {
        worker.activeMandateId = mandateId;
        inMemoryStore.workers.set(request.did, worker);
      }
    }

    this.auditTrail.push({
      action: 'MANDATE_CREATED',
      mandateId,
      details: {
        umrn,
        vpa: request.vpa,
        maxAmountPaise: request.maxAmountPaise,
        status: initialStatus,
        isSimulated: true,
      },
      timestamp: now.toISOString(),
    });

    console.log(`[MockUPIAutoPay] Mandate created: ${mandateId} (${umrn}), status: ${initialStatus}`);
    return mandate;
  }

  /**
   * Demo user approves/authorizes the mandate (simulating UPI PIN entry on PSP app).
   * Transitions mandate from AWAITING_AUTHORIZATION to ACTIVE.
   */
  async approveMandate(mandateId: string): Promise<AutoPayMandate> {
    const mandate = inMemoryStore.mandates.get(mandateId);
    if (!mandate) {
      throw new Error(`Mandate ${mandateId} not found`);
    }

    const now = new Date().toISOString();
    mandate.status = 'ACTIVE';
    mandate.authorizedAt = now;
    inMemoryStore.mandates.set(mandateId, mandate);

    const worker = inMemoryStore.workers.get(mandate.did);
    if (worker) {
      worker.activeMandateId = mandateId;
      inMemoryStore.workers.set(mandate.did, worker);
    }

    this.auditTrail.push({
      action: 'MANDATE_AUTHORIZED',
      mandateId,
      details: {
        umrn: mandate.umrn,
        status: 'ACTIVE',
        authorizedAt: now,
      },
      timestamp: now,
    });

    console.log(`[MockUPIAutoPay] Mandate ${mandateId} APPROVED and now ACTIVE`);
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
    // If no ACTIVE mandate, return AWAITING_AUTHORIZATION if exists
    for (const mandate of inMemoryStore.mandates.values()) {
      if (mandate.did === did && mandate.status === 'AWAITING_AUTHORIZATION') {
        return mandate;
      }
    }
    return null;
  }

  async listMandates(did?: string): Promise<AutoPayMandate[]> {
    return Array.from(inMemoryStore.mandates.values()).filter(
      (m) => !did || m.did === did
    );
  }

  /**
   * Simulates a variable UPI AutoPay debit under an existing mandate.
   * STRICT SAFETY RULE: All debits are simulated in memory. No real UPI network calls.
   * Never reduce the loan balance before a validated success callback.
   * Stable idempotency keys prevent duplicate debits.
   */
  async executeDebit(request: ExecuteDebitRequest, scenario: DebitScenario = 'SUCCESS'): Promise<DebitResult> {
    const now = new Date().toISOString();

    // 1. Stable Idempotency Check
    if (this.executedDebits.has(request.idempotencyKey)) {
      console.log(`[MockUPIAutoPay] Idempotent request detected for key: ${request.idempotencyKey}`);
      this.auditTrail.push({
        action: 'DEBIT_IDEMPOTENT_HIT',
        instructionId: request.instructionId,
        idempotencyKey: request.idempotencyKey,
        details: { scenario, cached: true },
        timestamp: now,
      });
      return this.executedDebits.get(request.idempotencyKey)!;
    }

    // 2. Validate mandate existence
    const mandate = inMemoryStore.mandates.get(request.mandateId);
    if (!mandate) {
      const result: DebitResult = {
        success: false,
        instructionId: request.instructionId,
        amountDebitedPaise: 0,
        errorCode: 'MANDATE_NOT_FOUND',
        errorMessage: `UPI AutoPay mandate ${request.mandateId} not found`,
        timestamp: now,
      };
      this.executedDebits.set(request.idempotencyKey, result);
      return result;
    }

    // 3. Validate mandate authorization status
    if (mandate.status === 'AWAITING_AUTHORIZATION' || mandate.status === 'PENDING_AUTH') {
      const result: DebitResult = {
        success: false,
        instructionId: request.instructionId,
        amountDebitedPaise: 0,
        errorCode: 'MANDATE_AWAITING_AUTHORIZATION',
        errorMessage: `UPI AutoPay mandate ${mandate.mandateId} is awaiting user authorization`,
        timestamp: now,
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
        errorMessage: `UPI AutoPay mandate ${mandate.mandateId} is not ACTIVE (status: ${mandate.status})`,
        timestamp: now,
      };
      this.executedDebits.set(request.idempotencyKey, result);
      return result;
    }

    // 4. Validate mandate cap
    if (request.amountPaise > mandate.maxAmountPaise || scenario === 'MANDATE_EXCEEDED') {
      const result: DebitResult = {
        success: false,
        instructionId: request.instructionId,
        amountDebitedPaise: 0,
        errorCode: 'EXCEEDS_MANDATE_CAP',
        errorMessage: `Debit amount (${request.amountPaise} paise) exceeds mandate cap (${mandate.maxAmountPaise} paise)`,
        timestamp: now,
      };
      this.executedDebits.set(request.idempotencyKey, result);
      return result;
    }

    // 5. Scenario Injections
    if (scenario === 'TIMEOUT') {
      // Simulate gateway timeout: Keep instruction pending, do not alter balance
      const result: DebitResult = {
        success: false,
        instructionId: request.instructionId,
        amountDebitedPaise: 0,
        errorCode: 'PSP_TIMEOUT',
        errorMessage: 'Simulated UPI PSP Gateway timeout. Debit remains pending; do not create duplicate instruction.',
        timestamp: now,
      };
      this.executedDebits.set(request.idempotencyKey, result);
      this.auditTrail.push({
        action: 'DEBIT_TIMEOUT_SIMULATED',
        instructionId: request.instructionId,
        idempotencyKey: request.idempotencyKey,
        details: { scenario: 'TIMEOUT' },
        timestamp: now,
      });
      return result;
    }

    if (scenario === 'INSUFFICIENT_FUNDS') {
      const result: DebitResult = {
        success: false,
        instructionId: request.instructionId,
        amountDebitedPaise: 0,
        errorCode: 'INSUFFICIENT_FUNDS',
        errorMessage: 'Simulated debit failed: Insufficient bank account balance',
        timestamp: now,
      };
      this.executedDebits.set(request.idempotencyKey, result);
      this.auditTrail.push({
        action: 'DEBIT_FAILED_SIMULATED',
        instructionId: request.instructionId,
        idempotencyKey: request.idempotencyKey,
        details: { scenario: 'INSUFFICIENT_FUNDS' },
        timestamp: now,
      });
      return result;
    }

    // 6. Simulate successful variable debit execution
    const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const upiRef = `UPI/${yyyymmdd}/${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const result: DebitResult = {
      success: true,
      instructionId: request.instructionId,
      amountDebitedPaise: request.amountPaise,
      upiRef,
      timestamp: now,
    };

    this.executedDebits.set(request.idempotencyKey, result);
    this.auditTrail.push({
      action: 'DEBIT_SUCCESS_SIMULATED',
      mandateId: request.mandateId,
      instructionId: request.instructionId,
      idempotencyKey: request.idempotencyKey,
      details: {
        amountPaise: request.amountPaise,
        upiRef,
        isSimulated: true,
      },
      timestamp: now,
    });

    console.log(`[MockUPIAutoPay] Simulated Debit SUCCEEDED: ${upiRef} for ₹${(request.amountPaise / 100).toFixed(2)}`);
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

    this.auditTrail.push({
      action: 'MANDATE_REVOKED',
      mandateId,
      details: { status: 'REVOKED' },
      timestamp: new Date().toISOString(),
    });

    return mandate;
  }

  getAuditTrail() {
    return [...this.auditTrail];
  }
}
