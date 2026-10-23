import React, { useState } from 'react';
import {
  CreditCard,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
  Trash2,
  PlusCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { MetricCard } from '../components/MetricCard.js';
import { StatusBadge } from '../components/StatusBadge.js';

export const MandateManagementPage: React.FC = () => {
  const { mandates, updateMandateStatus, activeWorker } = useApp();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newVpa, setNewVpa] = useState(activeWorker?.vpa || 'ravi.kumar@oksbi');
  const [newCapRupees, setNewCapRupees] = useState(2000);
  const [newBank, setNewBank] = useState('State Bank of India (SBIN0001234)');

  const workerMandates = mandates.filter(
    (m) => !activeWorker || m.did === activeWorker.did
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            UPI AutoPay Mandate Management
          </h2>
          <p className="text-xs text-slate-500">
            Pre-authorized recurring variable e-mandates registered with NPCI for {activeWorker?.name}.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Authorize New Mandate</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Active Registered Mandates"
          value={String(workerMandates.filter((m) => m.status === 'ACTIVE').length)}
          subtitle="Ready for daily proportional debits"
          icon={<CreditCard className="w-5 h-5" />}
          accentColor="teal"
        />
        <MetricCard
          title="Maximum Debit Cap"
          value={`₹${((workerMandates[0]?.maxAmountPaise || 200000) / 100).toLocaleString('en-IN')}`}
          subtitle="Mandate single-transaction limit"
          icon={<ShieldCheck className="w-5 h-5" />}
          accentColor="blue"
        />
        <MetricCard
          title="Execution Type"
          value="AS_PRESENTED"
          subtitle="Proportional to detected payout"
          icon={<CheckCircle2 className="w-5 h-5" />}
          accentColor="emerald"
        />
      </div>

      {/* Mandates List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Registered AutoPay e-Mandates
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {workerMandates.map((m) => (
            <div
              key={m.mandateId}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">
                    {m.vpa}
                  </span>
                  <StatusBadge status={m.status} size="sm" />
                </div>
                <div className="text-xs text-slate-500 font-mono flex flex-wrap gap-x-4 gap-y-1">
                  <span>UMRN: <strong className="text-slate-700">{m.umrn}</strong></span>
                  <span>Bank Account: {m.bankAccountMasked} ({m.ifscCode})</span>
                  <span>Cap: ₹{(m.maxAmountPaise / 100).toLocaleString('en-IN')} / debit</span>
                  <span>Frequency: {m.frequency}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Validity: {m.startDate} to {m.endDate}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                {m.status === 'ACTIVE' ? (
                  <button
                    onClick={() => updateMandateStatus(m.mandateId, 'PAUSED')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 text-xs font-semibold transition"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    onClick={() => updateMandateStatus(m.mandateId, 'ACTIVE')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100 text-xs font-semibold transition"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                )}

                <button
                  onClick={() => updateMandateStatus(m.mandateId, 'REVOKED')}
                  disabled={m.status === 'REVOKED'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Revoke</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AutoPay NPCI Guidelines Explainer Box */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-2 text-xs">
        <h4 className="font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>NPCI UPI AutoPay Specification Highlights</span>
        </h4>
        <p className="text-slate-600 leading-relaxed">
          Under NPCI guidelines for recurring mandates, a variable mandate allows a verified lender or merchant to execute variable daily debits without requiring repeated PIN entry for every individual micro-transaction, up to the approved mandate cap. The worker receives pre-debit SMS notifications and retains the right to pause or revoke the mandate at any time.
        </p>
      </div>

      {/* Modal: Authorize New Mandate */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Register Simulated UPI AutoPay Mandate
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  UPI VPA (Virtual Payment Address)
                </label>
                <input
                  type="text"
                  value={newVpa}
                  onChange={(e) => setNewVpa(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Linked Bank Account
                </label>
                <select
                  value={newBank}
                  onChange={(e) => setNewBank(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium"
                >
                  <option value="State Bank of India (SBIN0001234)">State Bank of India • Account XXXX5678</option>
                  <option value="ICICI Bank (ICIC0004321)">ICICI Bank • Account XXXX9123</option>
                  <option value="HDFC Bank (HDFC0005678)">HDFC Bank • Account XXXX7890</option>
                  <option value="Paytm Payments Bank">Paytm Payments Bank • Account XXXX3456</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Mandate Maximum Daily Cap (INR)
                </label>
                <input
                  type="number"
                  value={newCapRupees}
                  onChange={(e) => setNewCapRupees(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert('New simulated AutoPay e-mandate registered with NPCI UMRN generation!');
                  setShowCreateModal(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
              >
                Sign & Authorize Mandate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
