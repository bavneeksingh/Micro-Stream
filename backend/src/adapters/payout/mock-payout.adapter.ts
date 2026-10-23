import {
  IPayoutProviderAdapter,
  PayoutEvent,
  SimulatePayoutRequest,
} from '@microstream/shared';
import { inMemoryStore } from '../../db/in-memory-store.js';
import crypto from 'crypto';

export class MockPayoutProviderAdapter implements IPayoutProviderAdapter {
  public readonly isMock = true;
  public readonly providerName = 'Mock Gig Platform Payout Oracle (Zomato / Swiggy / Uber)';

  async simulatePayout(request: SimulatePayoutRequest): Promise<PayoutEvent> {
    const id = `pay_${crypto.randomBytes(6).toString('hex')}`;
    const reference = request.reference || `PAY-${request.platformId.toUpperCase()}-${Date.now()}`;
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
