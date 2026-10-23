import {
  PayoutProviderAdapter,
  PayoutEvent,
  SimulatePayoutRequest,
} from '@microstream/shared';
import { inMemoryStore } from '../../db/in-memory-store.js';
import crypto from 'crypto';

export class MockPayoutProviderAdapter implements PayoutProviderAdapter {
  public readonly isMock = true;
  public readonly providerName = 'Mock Gig Platform Payout Oracle (Zomato / Swiggy / Uber)';

  /**
   * Simulates a gig platform daily earnings payout event.
   * Enforces idempotency on external payout references: replaying the same reference returns the existing event.
   */
  async simulatePayout(request: SimulatePayoutRequest): Promise<PayoutEvent> {
    const reference = request.reference || `PAY-${request.platformId.toUpperCase()}-${Date.now()}`;

    // Check if this reference was already emitted (Idempotent replay test support)
    for (const existing of inMemoryStore.payouts.values()) {
      if (existing.reference === reference) {
        console.log(`[MockPayoutAdapter] Idempotent payout detected for reference: ${reference}`);
        return existing;
      }
    }

    const id = `pay_${crypto.randomBytes(6).toString('hex')}`;
    const payoutDate = request.payoutDate || new Date().toISOString().split('T')[0];

    const event: PayoutEvent = {
      id,
      did: request.did,
      platformId: request.platformId,
      amountPaise: Math.round(request.amountPaise),
      reference,
      payoutDate,
      detectedAt: new Date().toISOString(),
      status: 'DETECTED',
    };

    inMemoryStore.payouts.set(id, event);
    return event;
  }

  async getPayout(payoutId: string): Promise<PayoutEvent | null> {
    return inMemoryStore.payouts.get(payoutId) || null;
  }

  async listPayouts(did?: string, limit = 50): Promise<PayoutEvent[]> {
    return Array.from(inMemoryStore.payouts.values())
      .filter((p) => !did || p.did === did)
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
      .slice(0, limit);
  }
}
