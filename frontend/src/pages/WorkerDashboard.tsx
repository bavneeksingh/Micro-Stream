import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { MetricCard } from '../components/MetricCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import {
  Wallet,
  TrendingUp,
  CreditCard,
  Zap,
  CheckCircle2,
  Calendar,
  ArrowDownRight,
  ShieldCheck,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const WorkerDashboard: React.FC = () => {
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedDid, setSelectedDid] = useState<string>('did:drunix:worker:ravi-kumar-01');
  const [workerData, setWorkerData] = useState<any>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutInputRupees, setPayoutInputRupees] = useState<number>(1200);
  const [streaming, setStreaming] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);

  const loadData = async (did: string) => {
    try {
      setLoading(true);
      const [workersRes, detailsRes, earningsRes] = await Promise.all([
        api.getWorkers(),
        api.getWorker(did),
        api.getWorkerEarnings(did),
      ]);

      setWorkers(workersRes.workers);
      setWorkerData(detailsRes);
      setEarnings(earningsRes.earnings);

      if (detailsRes.activeLoan) {
        const repsRes = await api.getRepayments(detailsRes.activeLoan.loanId);
        setRepayments(repsRes.repayments || []);
      } else {
        setRepayments([]);
      }
    } catch (err) {
      console.error('Failed to load worker data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedDid);
  }, [selectedDid]);

  const handleSimulatePayout = async () => {
    if (!workerData?.worker || !payoutInputRupees || payoutInputRupees <= 0) return;
    setStreaming(true);
    setLastReceipt(null);
    try {
      const amountPaise = Math.round(payoutInputRupees * 100);
      const res = await api.simulatePayout({
        did: workerData.worker.did,
        platformId: (workerData.worker.primaryPlatform || 'zomato').toLowerCase() + '-in',
        amountPaise,
      });
      setLastReceipt(res);
      // Reload updated loan & earnings state
      await loadData(selectedDid);
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setStreaming(false);
    }
  };

  const activeLoan = workerData?.activeLoan;
  const worker = workerData?.worker;
  const mandate = workerData?.mandate;

  // Chart data formatting (rupees for human display, data stored in paise)
  const chartData = [...earnings]
    .reverse()
    .slice(-10)
    .map((e) => ({
      date: e.date.slice(5), // MM-DD
      earnings: e.grossEarningsPaise / 100,
      deductionEstimated: activeLoan
        ? Math.min((e.grossEarningsPaise * activeLoan.deductionRateBps) / 1000000, 200)
        : 0,
    }));

  const principalRupees = activeLoan ? activeLoan.principalPaise / 100 : 0;
  const outstandingRupees = activeLoan ? activeLoan.outstandingBalancePaise / 100 : 0;
  const repaidRupees = activeLoan ? activeLoan.totalRepaidPaise / 100 : 0;
  const progressPct =
    principalRupees > 0 ? Math.round((repaidRupees / principalRupees) * 100) : 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Controls & Profile Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-cyan-500/20">
            {worker?.name ? worker.name.charAt(0) : 'W'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {worker?.name || 'Worker'}
              </h1>
              {worker && <StatusBadge status={worker.creditTier} size="sm" />}
            </div>
            <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
              <span>{worker?.did}</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-400 font-sans">{worker?.primaryPlatform} Partner</span>
            </div>
          </div>
        </div>

        {/* Worker Switcher */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label htmlFor="select-worker" className="text-xs text-slate-400 whitespace-nowrap">
            Switch Profile:
          </label>
          <select
            id="select-worker"
            value={selectedDid}
            onChange={(e) => setSelectedDid(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none w-full sm:w-auto"
          >
            {workers.map((w) => (
              <option key={w.did} value={w.did}>
                {w.name} ({w.primaryPlatform}) — {w.creditTier}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hero: Streaming Micro-Credit Counter */}
      {activeLoan ? (
        <div className="glass-panel p-6 sm:p-8 rounded-2xl relative overflow-hidden border border-cyan-500/30 shadow-2xl shadow-cyan-950/40">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Left 2 Cols: Streaming Balance Counter */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  Live Streaming Micro-Credit
                </span>
                <span className="text-xs text-slate-400 font-mono">Loan ID: {activeLoan.loanId}</span>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Outstanding Balance (Repaying Per Daily Payout)
                </div>
                <div className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
                  <span>₹{outstandingRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <span className="text-sm font-normal text-slate-400">
                    of ₹{principalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })} principal
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span>Repaid: ₹{repaidRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({progressPct}%)</span>
                  <span>Target: Zero EMI Cliff</span>
                </div>
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(progressPct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Terms Badges */}
              <div className="flex flex-wrap gap-2 text-xs pt-1">
                <span className="px-3 py-1 bg-slate-800/80 rounded-lg border border-slate-700 text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Rate: {(activeLoan.deductionRateBps / 100).toFixed(1)}% of each daily payout
                </span>
                <span className="px-3 py-1 bg-slate-800/80 rounded-lg border border-slate-700 text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Safety Cap: ₹{(activeLoan.dailyCapPaise / 100).toFixed(0)} / day max
                </span>
                <span className="px-3 py-1 bg-slate-800/80 rounded-lg border border-slate-700 text-slate-300">
                  Lender: {activeLoan.lenderName}
                </span>
              </div>
            </div>

            {/* Right Col: Instant Payout Simulation Action Card */}
            <div className="glass-panel p-5 rounded-xl border border-white/10 bg-slate-900/60 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Simulate Daily Earnings
                </span>
                <span className="text-[11px] text-cyan-400 font-mono">Real-Time Deduct</span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Simulate your gig platform depositing today's payout into your account. MicroStream will automatically stream {(activeLoan.deductionRateBps / 100).toFixed(1)}% toward your loan.
              </p>

              <div className="space-y-2">
                <label htmlFor="input-payout" className="text-xs font-medium text-slate-300">
                  Payout Amount (INR)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                    <input
                      id="input-payout"
                      type="number"
                      value={payoutInputRupees}
                      onChange={(e) => setPayoutInputRupees(parseFloat(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <button
                    id="btn-stream-payout"
                    onClick={handleSimulatePayout}
                    disabled={streaming}
                    className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-brand-600 hover:from-cyan-400 hover:to-brand-500 text-white font-bold text-xs rounded-lg transition shadow-md shadow-cyan-500/25 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {streaming ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Stream</span>
                  </button>
                </div>
              </div>

              {/* Quick preset chips */}
              <div className="flex gap-2 text-xs">
                {[600, 1000, 1400].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setPayoutInputRupees(amt)}
                    className="flex-1 py-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition text-[11px]"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-8 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">No Active Loan</h2>
          <p className="text-sm text-slate-400">
            This worker currently has no outstanding micro-credit balance.
          </p>
        </div>
      )}

      {/* Stream Simulation Toast / Receipt Card */}
      {lastReceipt && (
        <div className="glass-panel p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 animate-slideDown">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <span>{lastReceipt.message}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                  Tx Confirmed
                </span>
              </div>
              <div className="text-slate-300 font-mono grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 pt-1">
                <div>Payout Received: ₹{(lastReceipt.payout.amountPaise / 100).toFixed(2)}</div>
                <div>Streaming Deduction: ₹{(lastReceipt.deductionCalculatedPaise / 100).toFixed(2)}</div>
                <div>UPI AutoPay Ref: {lastReceipt.debitResult?.upiRef || 'SIMULATED'}</div>
                <div>Updated Outstanding: ₹{((lastReceipt.updatedLoan?.outstandingBalancePaise || 0) / 100).toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          id="card-daily-avg-earnings"
          title="30-Day Avg Daily Earnings"
          value={`₹${(workerData?.earningsSummary?.averageDailyEarningsPaise / 100 || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`}
          subtitle={`Across ${workerData?.earningsSummary?.activeDaysCount || 0} active gig days`}
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor="cyan"
        />
        <MetricCard
          id="card-active-mandate"
          title="UPI AutoPay Mandate"
          value={mandate?.status || 'Active'}
          subtitle={`Cap: ₹${(mandate?.maxAmountPaise / 100 || 0).toLocaleString('en-IN')} (UMRN: ${mandate?.umrn?.slice(0, 12)}...)`}
          icon={<CreditCard className="w-5 h-5" />}
          accentColor="emerald"
        />
        <MetricCard
          id="card-cashflow-volatility"
          title="Income Volatility"
          value={`±₹${(workerData?.earningsSummary?.volatilityPaise / 100 || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`}
          subtitle="Cash flow stability index"
          icon={<ArrowDownRight className="w-5 h-5" />}
          accentColor="purple"
        />
        <MetricCard
          id="card-credit-risk-score"
          title="Drunix Credit Health"
          value={`${worker?.riskScore || 75} / 100`}
          subtitle={`Credit Tier: ${worker?.creditTier || 'STANDARD_B'}`}
          icon={<Wallet className="w-5 h-5" />}
          accentColor="amber"
        />
      </div>

      {/* Two Column Layout: Earnings Chart & Repayment Stream Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Earnings & Deduction Chart */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Daily Earnings & Streaming Deductions
              </h3>
              <p className="text-xs text-slate-400">
                Notice how deductions scale smoothly with daily income instead of a fixed monthly cliff.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-cyan-500" />
                Gross Earnings
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                Streaming Repayment
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#374151',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, '']}
                />
                <Bar dataKey="earnings" name="Gross Payout" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="deductionEstimated" name="Streaming Deduction" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Repayment Stream Ledger */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Streaming Repayment Ledger
              </h3>
              <p className="text-xs text-slate-400">
                Verified on Drunix ledger • Real-time AutoPay settlements
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {repayments.length} transactions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Deduction</th>
                  <th className="py-2.5 px-3">Remaining</th>
                  <th className="py-2.5 px-3">UPI Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {repayments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No repayments recorded yet. Use the simulator above to stream your first repayment.
                    </td>
                  </tr>
                ) : (
                  repayments.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 text-slate-300 font-mono">
                        {rep.settledAt ? rep.settledAt.slice(0, 10) : 'Recent'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-400">
                        ₹{(rep.amountPaise / 100).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        ₹{(rep.newOutstandingBalancePaise / 100).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
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
    </div>
  );
};
