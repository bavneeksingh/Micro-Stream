import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  PlusCircle,
  Trash2,
  Lock,
  Clock,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { MetricCard } from '../components/MetricCard.js';

export const ConsentAuditPage: React.FC = () => {
  const { consents, revokeConsent, grantConsent, activeWorker } = useApp();
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantee, setGrantee] = useState('did:drunix:lender:bajaj-fin');
  const [purpose, setPurpose] = useState('Income verification and underwriting for vehicle micro-credit');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['EARNINGS_READ', 'REPAYMENT_DEBIT']);

  const workerConsents = consents.filter(
    (c) => !activeWorker || c.did === activeWorker.did
  );

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleGrant = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedScopes.length === 0) {
      alert('Please select at least one scope');
      return;
    }
    grantConsent(grantee, selectedScopes, purpose);
    setShowGrantModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Data Consent & On-Chain Audit Ledger
          </h2>
          <p className="text-xs text-slate-500">
            Immutable, granular, revocable consent authorizations recorded on Drunix for {activeWorker?.name}.
          </p>
        </div>

        <button
          onClick={() => setShowGrantModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Grant New Consent</span>
        </button>
      </div>

      {/* Aggregate Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Active Authorizations"
          value={String(workerConsents.filter((c) => c.status === 'ACTIVE').length)}
          subtitle="Scoped access permissions"
          icon={<ShieldCheck className="w-5 h-5" />}
          accentColor="teal"
        />
        <MetricCard
          title="Zero PII Sharing"
          value="100% Enforced"
          subtitle="Only cash-flow aggregates exposed"
          icon={<Lock className="w-5 h-5" />}
          accentColor="blue"
        />
        <MetricCard
          title="Audit Ledger Blocks"
          value={String(workerConsents.length + 1040)}
          subtitle="Tamper-proof Drunix blocks"
          icon={<FileText className="w-5 h-5" />}
          accentColor="purple"
        />
      </div>

      {/* Consents Cards List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Active Authorizations & Permissions
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {workerConsents.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {c.grantee}
                  </span>
                  <StatusBadge status={c.status} size="sm" />
                </div>
                <div className="text-xs text-slate-600">{c.purpose}</div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {c.scope.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Granted: {c.grantedAt.slice(0, 10)} • Expires: {c.expiresAt.slice(0, 10)} • Block: #{c.blockNumber || 1042}
                </div>
              </div>

              {c.status === 'ACTIVE' && (
                <div className="flex-shrink-0">
                  <button
                    onClick={() => revokeConsent(c.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke Access</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Grant Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Grant Decentralized Consent
              </h3>
              <button onClick={() => setShowGrantModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGrant} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Grantee Entity DID
                </label>
                <select
                  value={grantee}
                  onChange={(e) => setGrantee(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-medium"
                >
                  <option value="did:drunix:lender:bajaj-fin">did:drunix:lender:bajaj-fin (Bajaj Finserv)</option>
                  <option value="did:drunix:lender:kotak-micro">did:drunix:lender:kotak-micro (Kotak Micro)</option>
                  <option value="did:drunix:platform:swiggy">did:drunix:platform:swiggy (Swiggy Delivery)</option>
                  <option value="did:drunix:platform:uber">did:drunix:platform:uber (Uber India)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Permitted Scopes
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {['EARNINGS_READ', 'EARNINGS_WRITE', 'REPAYMENT_DEBIT', 'CREDIT_ASSESSMENT'].map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => toggleScope(sc)}
                      className={`p-2 rounded-lg border text-left font-mono text-[11px] transition ${
                        selectedScopes.includes(sc)
                          ? 'bg-teal-50 border-teal-300 text-teal-800 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {sc}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Purpose Specification
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                >
                  Mint Consent Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
