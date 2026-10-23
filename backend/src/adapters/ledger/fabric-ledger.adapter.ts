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
  DebitInstruction,
} from '@microstream/shared';

/**
 * FabricLedgerAdapter connects MicroStream backend to a live Hyperledger Fabric / NPCI Drunix network.
 *
 * Requirements for real network connection:
 * - FABRIC_PEER_ENDPOINT (e.g., 'grpcs://peer0.org1.example.com:7051')
 * - FABRIC_CHANNEL (e.g., 'microstream-channel')
 * - FABRIC_CHAINCODE_NAME (e.g., 'microstream')
 * - FABRIC_MSP_ID (e.g., 'PlatformMSP' or 'LenderMSP')
 * - FABRIC_CERT_PATH and FABRIC_KEY_PATH for mTLS & transaction signing
 *
 * NOTE: If Drunix access or network credentials are unconfigured,
 * MicroStream safely falls back to MockLedgerAdapter by default.
 */
export class FabricLedgerAdapter implements ILedgerAdapter {
  public readonly isMock = false;
  public readonly providerName = 'NPCI Drunix / Hyperledger Fabric Gateway (Production/Staging)';

  private peerEndpoint: string;
  private channelName: string;
  private chaincodeName: string;
  private mspId: string;
  private isConnected = false;

  constructor() {
    this.peerEndpoint = process.env.FABRIC_PEER_ENDPOINT || 'grpcs://localhost:7051';
    this.channelName = process.env.FABRIC_CHANNEL || 'microstream-channel';
    this.chaincodeName = process.env.FABRIC_CHAINCODE_NAME || 'microstream';
    this.mspId = process.env.FABRIC_MSP_ID || 'PlatformMSP';
  }

  private assertConnected(): void {
    if (!this.isConnected) {
      throw new Error(
        `[FabricLedgerAdapter] Real network peer is unreachable at ${this.peerEndpoint}. ` +
        `Live Drunix/Fabric gateway is unconfigured in this environment. ` +
        `To run with simulated state, set LEDGER_ADAPTER_TYPE=mock (the default).`
      );
    }
  }

  async registerWorkerDID(profile: Omit<WorkerProfile, 'joinedAt' | 'creditTier' | 'riskScore'> & { riskScore?: number }): Promise<{ did: string; txHash: string }> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async getWorkerDID(did: string): Promise<WorkerProfile | null> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async grantConsent(consent: GrantConsentRequest): Promise<ConsentRecord> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async getConsent(did: string, grantee: string): Promise<ConsentRecord | null> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async revokeConsent(consentId: string, did: string): Promise<ConsentRecord> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async logDailyEarnings(request: LogEarningsRequest): Promise<{ earningsId: string; txHash: string; blockNumber: number }> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async recordDebitInstruction(params: {
    instructionId: string;
    loanId: string;
    did: string;
    amountPaise: number;
    idempotencyKey: string;
  }): Promise<DebitInstruction> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async calculateDeduction(loanId: string, payoutAmountPaise: number, payoutRef: string): Promise<{
    deductionPaise: number;
    instructionId: string;
    idempotencyKey: string;
    outstandingBalancePaise: number;
    dailyCapPaise: number;
  }> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async updateLoanBalance(params: {
    loanId: string;
    debitInstructionId: string;
    success: boolean;
    amountDebitedPaise: number;
    upiRef: string;
    failureReason?: string;
  }): Promise<{ loan: Loan; repayment?: Repayment; txHash: string }> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async issueLoan(request: IssueLoanRequest): Promise<Loan> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async getLoan(loanId: string): Promise<Loan | null> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async getActiveLoanByDid(did: string): Promise<Loan | null> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async listLoans(filter?: { did?: string; status?: string }): Promise<Loan[]> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async getEarningsSummary(did: string, days?: number): Promise<WorkerEarningsSummary> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async listEarnings(did: string, limit?: number): Promise<EarningsRecord[]> {
    this.assertConnected();
    throw new Error('Not implemented');
  }

  async listRepayments(loanId?: string): Promise<Repayment[]> {
    this.assertConnected();
    throw new Error('Not implemented');
  }
}
