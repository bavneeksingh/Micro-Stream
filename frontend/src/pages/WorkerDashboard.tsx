import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  TrendingUp,
  CreditCard,
  Zap,
  CheckCircle2,
  Calendar,
  ArrowDownRight,
  ShieldCheck,
  Send,
  Sparkles,
  FilePlus,
  Coins,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useApp } from '../context/AppContext.js';
import { MetricCard } from '../components/MetricCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { SimulatePayoutModal } from '../components/SimulatePayoutModal.js';

export const WorkerDashboard: React.FC = () => {
  const { activeWorker, activeLoan, activeMandate, earnings, repayments } = useApp();
  const [showSimulateModal, setShowSimulateModal] = useState(false);

  // Filter earnings & repayments for active worker
  const workerEarnings = earnings.filter((e) => e.did === activeWorker?.did);
  const workerRepayments = repayments.filter((r) => r.did === activeWorker?.did);

  // Today's earnings & deduction (using today or most recent recorded day)
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayEarning = workerEarnings.find((e) => e.date === todayDateStr) || workerEarnings[0];
  const todayEarningsRupees = todayEarning ? todayEarning.grossEarningsPaise / 100 : 0;

  // Most recent repayment (today's deduction if any)
  const recentRepayment = workerRepayments[0];
  const todayDeductionRupees = recentRepayment ? recentRepayment.amountPaise / 100 : 0;

  // Active Loan Metrics
  const principalRupees = activeLoan ? activeLoan.principalPaise / 100 : 0;
  const outstandingRupees = activeLoan ? activeLoan.outstandingBalancePaise / 100 : 0;
  const totalRepaidRupees = activeLoan ? activeLoan.totalRepaidPaise / 100 : 0;
  const progressPct =
    principalRupees > 0 ? Math.round((totalRepaidRupees / principalRupees) * 100) : 0;

  // 14-Day Earnings vs Repayment Chart Data
  const chartDays = [...workerEarnings]
    .slice(0, 10)
    .reverse()
    .map((e) => {
      // Find matching repayment or estimate deduction
      const rep = workerRepayments.find(
        (r) => r.settledAt.slice(0, 10) === e.date || r.loanId === activeLoan?.loanId
      );
      const streamRateBps = activeLoan ? activeLoan.deductionRateBps : 500;
      const deductionEstimated = Math.min(
        (e.grossEarningsPaise * streamRateBps) / 1000000,
        activeLoan?.dailyCapPaise ? activeLoan.dailyCapPaise / 100 : 200
      );

      return {
        date: e.date.slice(5), // MM-DD
        grossEarnings: e.grossEarningsPaise / 100,
        repaymentDeduction: Number(deductionEstimated.toFixed(2)),
      };
    });

  return (
    <div className="space-y-6">
      {/* Worker Profile Sub-Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {activeWorker?.name.charAt(0) || 'W'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {activeWorker?.name}
              </h2>
              {activeWorker && <StatusBadge status={activeWorker.creditTier} size="sm" />}
            </div>
            <div className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-2 mt-0.5">
              <span>DID: {activeWorker?.did}</span>
              <span className="text-slate-300">•</span>
              <span className="text-teal-700 font-sans font-bold">
                {activeWorker?.primaryPlatform} Partner
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600 font-sans">VPA: {activeWorker?.vpa}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowSimulateModal(true)}
            id="btn-worker-simulate"
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Simulate Today's Payout</span>
          </button>
        </div>
      </div>

      {/* Hero: Loan Streaming Progress Card */}
      {activeLoan ? (
        <div className="bg-white rounded-2xl p-6 border border-teal-200/90 shadow-card space-y-5 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200/80 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                Active Micro-Credit Stream
              </span>
              <span className="text-xs font-mono text-slate-400">
                ID: {activeLoan.loanId}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              Lender: <strong className="text-slate-800">{activeLoan.lenderName}</strong> • {activeLoan.purpose}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Left 2 Cols: Outstanding Balance & Progress */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Current Outstanding Loan Balance
                </div>
                <div className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-3 tabular-nums">
                  <span>₹{outstandingRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <span className="text-sm font-semibold text-slate-500">
                    of ₹{principalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })} original principal
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>
                    Total Repaid: ₹{totalRepaidRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
                    <span className="text-teal-700">({progressPct}%)</span>
                  </span>
                  <span className="text-slate-500">Target: Zero Debt Balance</span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 p-0.5">
                  <div
                    className="h-full bg-teal-600 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(progressPct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Terms Badges */}
              <div className="flex flex-wrap gap-2 text-xs pt-1">
                <span className="px-3 py-1 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-medium">
                  Streaming Rate: <strong className="text-teal-700">{(activeLoan.deductionRateBps / 100).toFixed(1)}%</strong> of daily payout
                </span>
                <span className="px-3 py-1 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-medium">
                  Safety Cap: <strong className="text-slate-900">₹{(activeLoan.dailyCapPaise / 100).toFixed(0)} / day</strong> max
                </span>
                <span className="px-3 py-1 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-medium">
                  AutoPay Mandate: <strong className="text-slate-900 font-mono">{activeMandate?.status || 'Active'}</strong>
                </span>
              </div>
            </div>

            {/* Right Col: Today's Snapshot Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Today's Stream Snapshot
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">Today's Payout:</span>
                  <span className="font-bold text-slate-900">
                    ₹{todayEarningsRupees.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500">AutoPay Deduction:</span>
                  <span className="font-extrabold text-teal-700">
                    ₹{todayDeductionRupees.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Net Take-Home:</span>
                  <span className="font-bold text-slate-900">
                    ₹{Math.max(0, todayEarningsRupees - todayDeductionRupees).toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowSimulateModal(true)}
                className="w-full py-2 bg-white hover:bg-slate-100 text-teal-800 text-xs font-bold border border-teal-300 rounded-lg transition shadow-subtle flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>Simulate Another Payout</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State: No active loan */
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-4 shadow-card">
          <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
            <Coins className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              No Active Loan Outstanding
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Your previous micro-credit balance is fully settled. Apply for a new working capital loan linked to your daily earnings.
            </p>
          </div>
          <NavLink
            to="/loans/apply"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition shadow-sm"
          >
            <FilePlus className="w-4 h-4" />
            <span>Apply for New Micro-Credit</span>
          </NavLink>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          id="metric-original-loan"
          title="Original Loan Amount"
          value={activeLoan ? `₹${principalRupees.toLocaleString('en-IN')}` : '₹0'}
          subtitle={activeLoan ? `Disbursed on ${activeLoan.issuedAt.slice(0, 10)}` : 'No active credit'}
          icon={<Coins className="w-5 h-5" />}
          accentColor="blue"
        />
        <MetricCard
          id="metric-outstanding-balance"
          title="Outstanding Balance"
          value={activeLoan ? `₹${outstandingRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
          subtitle={`${progressPct}% debt cleared so far`}
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor="teal"
        />
        <MetricCard
          id="metric-todays-deduction"
          title="Today's Stream Deduction"
          value={`₹${todayDeductionRupees.toFixed(2)}`}
          subtitle={`From ₹${todayEarningsRupees.toFixed(0)} daily payout`}
          icon={<Zap className="w-5 h-5" />}
          accentColor="amber"
        />
        <MetricCard
          id="metric-autopay-status"
          title="AutoPay Mandate Status"
          value={activeMandate?.status || 'Active'}
          subtitle={`UMRN: ${activeMandate?.umrn?.slice(0, 14)}...`}
          icon={<CreditCard className="w-5 h-5" />}
          accentColor="purple"
        />
      </div>

      {/* Two Column Layout: Earnings vs Repayments Chart & Recent Transactions Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings vs Repayments Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Daily Earnings vs. Repayment Stream
              </h3>
              <p className="text-xs text-slate-500">
                Deductions adapt dynamically to your daily volume with no month-end cliff.
              </p>
            </div>
            <NavLink
              to="/earnings"
              className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              <span>View History</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDays} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, '']}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                />
                <Bar
                  dataKey="grossEarnings"
                  name="Gross Payout (INR)"
                  fill="#0d9488"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="repaymentDeduction"
                  name="MicroStream Repayment (INR)"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transaction History */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Recent Repayment Activity
              </h3>
              <p className="text-xs text-slate-500">
                Verified micro-deductions credited directly to your loan balance.
              </p>
            </div>
            <NavLink
              to="/repayments"
              className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              <span>All Debits</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Deducted</th>
                  <th className="py-2.5 px-3">Balance After</th>
                  <th className="py-2.5 px-3">UPI Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workerRepayments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No repayments recorded yet. Use the Simulate button to stream your first deduction.
                    </td>
                  </tr>
                ) : (
                  workerRepayments.slice(0, 5).map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {rep.settledAt ? rep.settledAt.slice(0, 10) : 'Recent'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-teal-700">
                        ₹{(rep.amountPaise / 100).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-semibold">
                        ₹{(rep.newOutstandingBalancePaise / 100).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        {rep.upiRef}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reusable Payout Simulator Modal */}
      {showSimulateModal && (
        <SimulatePayoutModal onClose={() => setShowSimulateModal(false)} />
      )}
    </div>
  );
};
