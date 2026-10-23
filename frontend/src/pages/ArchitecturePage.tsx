import React from 'react';
import { Cpu, Database, ShieldCheck, Zap, Layers, RefreshCw, KeyRound, AlertTriangle } from 'lucide-react';

export const ArchitecturePage: React.FC = () => {
  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto">
      {/* Title */}
      <div className="glass-panel p-6 rounded-2xl border border-brand-500/30">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-brand-500/20 text-brand-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              MicroStream System Architecture Blueprint
            </h1>
            <p className="text-xs text-slate-400">
              Technical design, component roles, and financial state invariants.
            </p>
          </div>
        </div>
      </div>

      {/* Component Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Drunix Network */}
        <div className="glass-panel p-6 rounded-2xl space-y-3 border-l-4 border-l-cyan-500">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Layers className="w-4 h-4" />
            <span>NPCI Drunix Blockchain Network</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Enhanced Hyperledger Fabric fork designed for national-scale payment workloads. Employs:
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
            <li><strong className="text-slate-200">Lite Peers:</strong> Stateless endorsement nodes for high-throughput daily micro-transactions.</li>
            <li><strong className="text-slate-200">Committing Peers:</strong> Block ordering and cryptographic validation.</li>
            <li><strong className="text-slate-200">Validation Service:</strong> Independent verification preventing invalid state transitions.</li>
          </ul>
        </div>

        {/* YugabyteDB */}
        <div className="glass-panel p-6 rounded-2xl space-y-3 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
            <Database className="w-4 h-4" />
            <span>Distributed SQL State DB (YugabyteDB)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            PostgreSQL-compatible distributed SQL database functioning as the chain's state store:
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
            <li><strong className="text-slate-200">Direct SQL Risk Queries:</strong> Lenders compute standard deviation and cash-flow health on ledger state without data export.</li>
            <li><strong className="text-slate-200">Zero Data Movement:</strong> Eliminates data leakage and brittle off-chain ETL pipelines.</li>
          </ul>
        </div>

        {/* Go Chaincode */}
        <div className="glass-panel p-6 rounded-2xl space-y-3 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <Cpu className="w-4 h-4" />
            <span>Go Smart Contract (Chaincode)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Deterministic state machine implementing the credit streaming logic:
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
            <li><code className="text-emerald-300">LogDailyEarnings:</code> Platform logs immutable daily gross income.</li>
            <li><code className="text-emerald-300">CalculateDeduction:</code> Applies proportional percentage (e.g. 5%) bounded by balance and daily caps.</li>
            <li><code className="text-emerald-300">UpdateLoanBalance:</code> Reduces outstanding balance on UPI callback.</li>
          </ul>
        </div>

        {/* UPI AutoPay */}
        <div className="glass-panel p-6 rounded-2xl space-y-3 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <Zap className="w-4 h-4" />
            <span>UPI AutoPay Variable e-Mandates</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Pre-authorized recurring mandate framework under NPCI regulations:
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
            <li><strong className="text-slate-200">Variable Amount:</strong> Debits dynamically match exactly what was earned that day.</li>
            <li><strong className="text-slate-200">Strict Idempotency:</strong> Every debit instruction has an idempotency key preventing double debits.</li>
            <li><strong className="text-slate-200">Bounded Retries:</strong> Max 3 attempts on failed debit before carrying forward.</li>
          </ul>
        </div>
      </div>

      {/* Financial State Invariants */}
      <div className="glass-panel p-6 rounded-2xl space-y-4 border border-white/10">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Financial Safety Invariants & Engineering Rules
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5">
              <span>🪙 Integer Paise Arithmetic</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              All monetary values (loans, earnings, payouts, debits, repayments) are strictly represented as integer paise (1 INR = 100 paise). Zero floating-point rounding errors.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              <span>🛡️ Idempotent Execution</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Every debit instruction is bound to a unique idempotency key: <code>IDEMP_DEBIT_&#123;loanId&#125;_&#123;payoutRef&#125;</code>. Repeated executions return cached receipts safely.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>🔒 Zero-PII Underwriting</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Lenders underwrite against anonymous Decentralized Identifiers (DIDs) and on-chain cash-flow statistics without access to bank account statements or personal identifiers.
            </p>
          </div>
        </div>
      </div>

      {/* Mock vs Live Notice */}
      <div className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-amber-300">Hackathon Prototype Isolation Notice</div>
          <p className="text-slate-300 leading-relaxed">
            To guarantee safety and prevent unintended real money movement, all UPI AutoPay debit calls in this MVP are strictly simulated in-memory via <code>MockUPIAutoPayAdapter</code>. No real banking or UPI networks are invoked. External blockchain dependencies fall back gracefully to the documented mock ledger adapter.
          </p>
        </div>
      </div>
    </div>
  );
};
