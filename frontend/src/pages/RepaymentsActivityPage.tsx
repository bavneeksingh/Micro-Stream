import React, { useState } from 'react';
import {
  Repeat,
  Search,
  Download,
  Filter,
  CheckCircle2,
  ExternalLink,
  Coins,
  Calendar,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { MetricCard } from '../components/MetricCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Repayment } from '@microstream/shared';

export const RepaymentsActivityPage: React.FC = () => {
  const { repayments, activeWorker } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Repayment | null>(null);

  const workerRepayments = repayments.filter(
    (r) => !activeWorker || r.did === activeWorker.did
  );

  const filtered = workerRepayments.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.loanId.toLowerCase().includes(q) ||
        r.upiRef.toLowerCase().includes(q) ||
        r.settledAt.includes(q)
      );
    }
    return true;
  });

  const totalPaise = filtered.reduce((s, r) => s + r.amountPaise, 0);
  const avgDeductionPaise = filtered.length > 0 ? Math.round(totalPaise / filtered.length) : 0;

  const handleExportCsv = () => {
    const headers = ['Settled At', 'Loan ID', 'Amount (INR)', 'Previous Balance', 'New Balance', 'UPI Reference', 'Ledger Tx Hash'];
    const rows = filtered.map((r) => [
      r.settledAt,
      r.loanId,
      (r.amountPaise / 100).toFixed(2),
      (r.previousBalancePaise / 100).toFixed(2),
      (r.newOutstandingBalancePaise / 100).toFixed(2),
      r.upiRef,
      r.txHash,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `repayments_statement_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Streaming Repayment Activity
          </h2>
          <p className="text-xs text-slate-500">
            Automated micro-deductions processed through UPI AutoPay and settled to the ledger.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Repayments CSV</span>
        </button>
      </div>

      {/* Aggregate Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Micro-Deducted"
          value={`₹${(totalPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle={`From ${filtered.length} daily platform payouts`}
          icon={<Coins className="w-5 h-5" />}
          accentColor="teal"
        />
        <MetricCard
          title="Avg Daily Stream Deduction"
          value={`₹${(avgDeductionPaise / 100).toFixed(2)}`}
          subtitle="Proportional to real earnings"
          icon={<Repeat className="w-5 h-5" />}
          accentColor="blue"
        />
        <MetricCard
          title="Settled Transactions"
          value={String(filtered.length)}
          subtitle="All confirmed via UPI AutoPay"
          icon={<CheckCircle2 className="w-5 h-5" />}
          accentColor="emerald"
        />
        <MetricCard
          title="Default Rate"
          value="0.00%"
          subtitle="Eliminated by streaming loop"
          icon={<ShieldCheck className="w-5 h-5" />}
          accentColor="purple"
        />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by UPI ref, loan ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {filtered.length} records found
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px] bg-slate-50">
                <th className="py-3 px-4">Settled At</th>
                <th className="py-3 px-4">Loan ID</th>
                <th className="py-3 px-4">Amount Streamed</th>
                <th className="py-3 px-4">Previous Balance</th>
                <th className="py-3 px-4">New Balance</th>
                <th className="py-3 px-4">UPI Reference</th>
                <th className="py-3 px-4">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No repayment activity matching search.
                  </td>
                </tr>
              ) : (
                filtered.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {rep.settledAt.slice(0, 10)} {rep.settledAt.slice(11, 16)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {rep.loanId}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-teal-700 tabular-nums">
                      ₹{(rep.amountPaise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 tabular-nums">
                      ₹{(rep.previousBalancePaise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                      ₹{(rep.newOutstandingBalancePaise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {rep.upiRef}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setSelectedReceipt(rep)}
                        className="text-xs font-bold text-teal-700 hover:text-teal-900 underline flex items-center gap-1"
                      >
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cryptographic Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Repayment Settlement Receipt
                </h3>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-sans">Settled Amount:</span>
                <span className="font-bold text-teal-700 text-sm">
                  ₹{(selectedReceipt.amountPaise / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-sans">Facility ID:</span>
                <span className="font-bold text-slate-900">{selectedReceipt.loanId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-sans">UPI AutoPay Reference:</span>
                <span className="text-slate-700">{selectedReceipt.upiRef}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-sans">Previous Loan Balance:</span>
                <span className="text-slate-700">₹{(selectedReceipt.previousBalancePaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-sans">New Balance:</span>
                <span className="font-bold text-slate-900">₹{(selectedReceipt.newOutstandingBalancePaise / 100).toFixed(2)}</span>
              </div>
              <div className="pt-1">
                <span className="text-slate-500 font-sans block mb-0.5">Drunix Transaction Hash:</span>
                <span className="text-[10px] text-slate-500 break-all">{selectedReceipt.txHash}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
