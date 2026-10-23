import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Coins,
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
  Zap,
  ArrowRight,
  FilePlus,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { MetricCard } from '../components/MetricCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { SimulatePayoutModal } from '../components/SimulatePayoutModal.js';

export const LoanDetailsPage: React.FC = () => {
  const { activeWorker, loans, repayments, earnings } = useApp();
  const [showSimulateModal, setShowSimulateModal] = useState(false);

  const workerLoans = loans.filter((l) => l.did === activeWorker?.did);
  const activeLoan = workerLoans.find((l) => l.status === 'ACTIVE') || workerLoans[0];

  const loanRepayments = repayments.filter((r) => r.loanId === activeLoan?.loanId);

  // Velocity calculation: Average daily repayment
  const workerEarnings = earnings.filter((e) => e.did === activeWorker?.did);
  const avgDailyEarningsRupees =
    workerEarnings.length > 0
      ? workerEarnings.reduce((s, e) => s + e.grossEarningsPaise, 0) / (workerEarnings.length * 100)
      : 1200;

  const estimatedDailyDeduction = activeLoan
    ? Math.min((avgDailyEarningsRupees * activeLoan.deductionRateBps) / 10000, activeLoan.dailyCapPaise / 100 || 200)
    : 60;

  const outstandingRupees = activeLoan ? activeLoan.outstandingBalancePaise / 100 : 0;
  const principalRupees = activeLoan ? activeLoan.principalPaise / 100 : 0;
  const totalRepaidRupees = activeLoan ? activeLoan.totalRepaidPaise / 100 : 0;
  const progressPct =
    principalRupees > 0 ? Math.round((totalRepaidRupees / principalRupees) * 100) : 0;

  const daysToZero =
    estimatedDailyDeduction > 0 ? Math.ceil(outstandingRupees / estimatedDailyDeduction) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Micro-Credit Facility & Streaming Velocity
          </h2>
          <p className="text-xs text-slate-500">
            Smart contract terms, repayment progress, and estimated debt clearance trajectory for {activeWorker?.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <NavLink
            to="/loans/apply"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition"
          >
            <FilePlus className="w-3.5 h-3.5 text-teal-600" />
            <span>Apply for New Loan</span>
          </NavLink>
          <button
            onClick={() => setShowSimulateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Simulate Payout</span>
          </button>
        </div>
      </div>

      {activeLoan ? (
        <>
          {/* Active Loan Hero Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {activeLoan.purpose}
                  </h3>
                  <StatusBadge status={activeLoan.status} size="sm" />
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Facility ID: {activeLoan.loanId} • Lender: {activeLoan.lenderName}
                </div>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Issued: {activeLoan.issuedAt.slice(0, 10)}
              </div>
            </div>

            {/* Balances & Velocity Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Original Principal
                </span>
                <div className="text-xl font-bold text-slate-900 tabular-nums">
                  ₹{principalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-500">Fixed principal facility</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Outstanding Balance
                </span>
                <div className="text-xl font-bold text-slate-900 tabular-nums">
                  ₹{outstandingRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-teal-700 font-semibold">{progressPct}% cleared</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Streaming Rate
                </span>
                <div className="text-xl font-bold text-teal-700 tabular-nums">
                  {(activeLoan.deductionRateBps / 100).toFixed(1)}%
                </div>
                <div className="text-[11px] text-slate-500">Cap: ₹{(activeLoan.dailyCapPaise / 100).toFixed(0)}/day</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Days to Debt Free
                </span>
                <div className="text-xl font-bold text-slate-900 tabular-nums">
                  ~{daysToZero} days
                </div>
                <div className="text-[11px] text-slate-500">At ~₹{estimatedDailyDeduction.toFixed(0)}/day pace</div>
              </div>
            </div>

            {/* Repayment Progress Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Repayment Completion Progress</span>
                <span className="text-teal-700 font-bold">{progressPct}% Cleared</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                <div
                  className="h-full bg-teal-600 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(progressPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>Repaid: ₹{totalRepaidRupees.toFixed(2)}</span>
                <span>Remaining: ₹{outstandingRupees.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Smart Contract Terms & Amortization Log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Terms Table */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Smart Contract Parameters
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex justify-between py-2.5">
                  <span className="text-slate-500">Contract Standard</span>
                  <span className="font-mono text-slate-700">Hyperledger Fabric / Drunix</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-slate-500">Borrower DID</span>
                  <span className="font-mono text-slate-700">{activeLoan.did}</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-slate-500">Linked AutoPay Mandate</span>
                  <span className="font-mono text-teal-700">{activeLoan.mandateId}</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-slate-500">Interest Rate</span>
                  <span className="font-semibold text-slate-800">
                    {(activeLoan.interestRateBps / 100).toFixed(2)}% APR
                  </span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-slate-500">Ledger Deployment Hash</span>
                  <span className="font-mono text-[11px] text-slate-500">{activeLoan.txHash}</span>
                </div>
              </div>
            </div>

            {/* Repayments Applied to this Loan */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Deductions Credited to this Loan
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {loanRepayments.length} transactions
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Balance After</th>
                      <th className="py-2 px-3">UPI Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loanRepayments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          No deductions recorded for this loan yet.
                        </td>
                      </tr>
                    ) : (
                      loanRepayments.slice(0, 5).map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {r.settledAt.slice(0, 10)}
                          </td>
                          <td className="py-2 px-3 font-bold text-teal-700">
                            ₹{(r.amountPaise / 100).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            ₹{(r.newOutstandingBalancePaise / 100).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                            {r.upiRef}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-4 shadow-card">
          <Coins className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No Loans on Record</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            This worker has not taken any micro-credit loans yet.
          </p>
          <NavLink
            to="/loans/apply"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition"
          >
            Apply for Loan
          </NavLink>
        </div>
      )}

      {showSimulateModal && (
        <SimulatePayoutModal onClose={() => setShowSimulateModal(false)} />
      )}
    </div>
  );
};
