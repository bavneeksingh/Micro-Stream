import { ILedgerAdapter } from '@microstream/shared';
import { MockLedgerAdapter } from './mock-ledger.adapter.js';
import { FabricLedgerAdapter } from './fabric-ledger.adapter.js';

export { ILedgerAdapter } from '@microstream/shared';
export { MockLedgerAdapter } from './mock-ledger.adapter.js';
export { FabricLedgerAdapter } from './fabric-ledger.adapter.js';

/**
 * Factory function to retrieve the configured ledger adapter.
 * Uses MockLedgerAdapter by default unless LEDGER_ADAPTER_TYPE is set to 'fabric' or 'drunix'.
 */
export function getLedgerAdapter(): ILedgerAdapter {
  const adapterType = (process.env.LEDGER_ADAPTER_TYPE || 'mock').toLowerCase();
  if (adapterType === 'fabric' || adapterType === 'drunix') {
    return new FabricLedgerAdapter();
  }
  return new MockLedgerAdapter();
}
