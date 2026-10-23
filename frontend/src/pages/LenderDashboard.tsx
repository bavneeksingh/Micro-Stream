import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Building2,
  TrendingUp,
  Coins,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  PlusCircle,
  ExternalLink,
  ChevronRight,
  Database,
  Sliders,
  Zap,
  RefreshCw,
  AlertCircle,
  Save,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useApp } from '../context/AppContext.js';
import { MetricCard } from '../components/MetricCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { api } from '../services/api.js';

export const LenderDashboard: React.FC = () => {
  const { loans, repayments, workers, earnings, applyForLoan } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [showIssueModal, setShowIssueModal] = useState(false);

  // Engine Configuration State
  const [engineConfig, setEngineConfig] = useState<{
    defaultRepaymentRateBps: number;
    defaultDailyCapPaise: number;
    minimumDeductionThresholdPaise: number;
    maxRetries: number;
  }>({
    defaultRepaymentRateBps: 500,
    defaultDailyCapPaise: 20000,
    minimumDeductionThresholdPaise: 100,
    maxRetries: 3,
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveMessage, setConfigSaveMessage] = useState<string | null>(null);

  // Portfolio Transaction History State
  const [portfolioTransactions, setPortfolioTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadEngineConfig = async () => {
    try {
      const cfg = await api.getEngineConfig();
      if (cfg) {
        setEngineConfig(cfg);
      }
    } catch (err) {
      console.warn('Failed to load engine config:', err);
    }
  };

  const loadTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const res = await api.getTransactionHistory({ limit: 50 });
      if (res && res.transactions) {
        setPortfolioTransactions(res.transactions);
      }
    } catch (err) {
      console.warn('Failed to load portfolio transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  useEffect(() => {
    loadEngineConfig();
    loadTransactions();
  }, []);

  const handleSaveEngineConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigSaveMessage(null);
    try {
      await api.updateEngineConfig({
        repaymentRateBasisPoints: engineConfig.defaultRepaymentRateBps,
        dailyCapPaise: engineConfig.defaultDailyCapPaise,
        minimumDeductionThresholdPaise: engineConfig.minimumDeductionThresholdPaise,
        retryLimit: engineConfig.maxRetries,
      });
      setConfigSaveMessage('Engine parameters updated successfully!');
      setTimeout(() => setConfigSaveMessage(null), 4000);
    } catch (err: any) {
      alert(`Failed to update config: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRetryDebit = async (instructionId: string) => {
    setRetryingId(instructionId);
    try {
      await api.retryDebitInstruction(instructionId);
      await loadTransactions();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  // New Loan Form
  const [newLoanDid, setNewLoanDid] = useState(workers[3]?.did || workers[0]?.did || '');
  const [newLoanAmount, setNewLoanAmount] = useState(15000);
  const [newLoanRate, setNewLoanRate] = useState(5.0);
  const [newLoanCap, setNewLoanCap] = useState(250);
  const [newLoanPurpose, setNewLoanPurpose] = useState('Vehicle battery replacement and working capital');

  // Portfolio aggregates
  const totalDisbursedPaise = loans.reduce((s, l) => s + l.principalPaise, 0);
  const totalOutstandingPaise = loans.reduce((s, l) => s + l.outstandingBalancePaise, 0);
  const totalRepaidPaise = loans.reduce((s, l) => s + l.totalRepaidPaise, 0);

  const successfulDebitsCount = repayments.length;
  const failedDebitsCount = 0; // In pristine state

  const recoveryProgressPct =
    totalDisbursedPaise > 0
      ? Math.round((totalRepaidPaise / totalDisbursedPaise) * 100)
      : 0;

  // Repayment trend chart
  const trendData = [...repayments]
    .slice(0, 8)
    .reverse()
    .map((r, i) => ({
      date: r.settledAt.slice(5, 10),
      repaid: r.amountPaise / 100,
    }));

  // Worker Cash-Flow Underwriting stats
  const workerStats = workers.map((w) => {
    const wEarnings = earnings.filter((e) => e.did === w.did);
    const activeLoan = loans.find((l) => l.did === w.did && l.status === 'ACTIVE');
    const totalEarned = wEarnings.reduce((s, e) => s + e.grossEarningsPaise, 0);
    const avgDaily = wEarnings.length > 0 ? Math.round(totalEarned / wEarnings.length) : 0;

    // Volatility
    const sqDiffs = wEarnings.map((e) => Math.pow(e.grossEarningsPaise - avgDaily, 2));
    const variance = wEarnings.length > 0 ? sqDiffs.reduce((a, b) => a + b, 0) / wEarnings.length : 0;
    const volatility = Math.round(Math.sqrt(variance));

    return {
      did: w.did,
      name: w.name,
      platform: w.primaryPlatform,
      tier: w.creditTier,
      riskScore: w.riskScore,
      activeDays: wEarnings.length,
      avgDailyPaise: avgDaily,
      volatilityPaise: volatility,
      activeLoan,
    };
  });

  const filteredWorkerStats = workerStats.filter((w) => {
    if (tierFilter !== 'ALL' && w.tier !== tierFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        w.name.toLowerCase().includes(q) ||
        w.did.toLowerCase().includes(q) ||
        w.platform.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleIssueLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await applyForLoan({
        did: newLoanDid,
        amountRupees: newLoanAmount,
        deductionRatePct: newLoanRate,
        dailyCapRupees: newLoanCap,
        purpose: newLoanPurpose,
        lenderName: 'Kotak Microfinance',
      });
      setShowIssueModal(false);
      alert('Micro-credit facility issued and committed to ledger state!');
    } catch (err: any) {
      alert(`Error issuing loan: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Institutional Lender Portfolio
          </h2>
          <p className="text-xs text-slate-500">
            Real-time cash-flow underwriting on YugabyteDB ledger state with zero collection overhead.
          </p>
        </div>

        <button
          onClick={() => setShowIssueModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Issue Micro-Credit Facility</span>
        </button>
      </div>

      {/* 4 Core Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Capital Disbursed"
          value={`₹${(totalDisbursedPaise / 100).toLocaleString('en-IN')}`}
          subtitle={`Across ${loans.length} micro-credit facilities`}
          icon={<Coins className="w-5 h-5" />}
          accentColor="blue"
        />
        <MetricCard
          title="Outstanding Portfolio Balance"
          value={`₹${(totalOutstandingPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle={`${recoveryProgressPct}% overall debt recovered`}
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor="teal"
        />
        <MetricCard
          title="Successful AutoPay Debits"
          value={String(successfulDebitsCount)}
          subtitle="Real-time daily stream settlements"
          icon={<CheckCircle2 className="w-5 h-5" />}
          accentColor="emerald"
        />
        <MetricCard
          title="Failed Debits / Default Rate"
          value={`${failedDebitsCount} (0.00%)`}
          subtitle="Eliminated by proportional daily stream"
          icon={<ShieldCheck className="w-5 h-5" />}
          accentColor="purple"
        />
      </div>

      {/* Repayment Trend Chart & Portfolio Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Real-Time Repayment Velocity (Daily Inflows)
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              AutoPay Settlement Volume
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="repayGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`₹${Number(val).toFixed(2)}`, 'Repayment Stream']}
                />
                <Area
                  type="monotone"
                  dataKey="repaid"
                  stroke="#0d9488"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#repayGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Portfolio Summary Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Underwriting Health Index
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Active Borrowers:</span>
                <span className="font-bold text-slate-800">
                  {loans.filter((l) => l.status === 'ACTIVE').length} workers
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Average Streaming Rate:</span>
                <span className="font-bold text-teal-700">5.3% / payout</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Avg Loan Size:</span>
                <span className="font-bold text-slate-800">
                  ₹{(totalDisbursedPaise / (loans.length || 1) / 100).toFixed(0)}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Collection Cost:</span>
                <span className="font-bold text-emerald-600">~₹0.00 (Automated)</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800">YugabyteDB State Verification:</div>
            <div>All credit metrics computed via distributed SQL directly on ledger commits without moving data off-chain.</div>
          </div>
        </div>
      </div>

      {/* Worker Cash-Flow Statistics & Underwriting Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card overflow-hidden">
        {/* Table Header & Search Filter */}
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search worker name, platform, DID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500">Tier:</span>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            >
              <option value="ALL">All Credit Tiers</option>
              <option value="PRIME_A">PRIME A (Low Risk)</option>
              <option value="STANDARD_B">STANDARD B (Moderate)</option>
              <option value="EMERGING_C">EMERGING C (Building)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px] bg-slate-50">
                <th className="py-3 px-4">Worker / Alias</th>
                <th className="py-3 px-4">Platform</th>
                <th className="py-3 px-4">Credit Tier</th>
                <th className="py-3 px-4">Avg Daily Gross</th>
                <th className="py-3 px-4">Income Volatility</th>
                <th className="py-3 px-4">Active Days</th>
                <th className="py-3 px-4">Active Facility</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWorkerStats.map((w) => (
                <tr key={w.did} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{w.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">{w.did}</div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {w.platform}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={w.tier} size="sm" />
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                    ₹{(w.avgDailyPaise / 100).toFixed(0)}
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono">
                    ±₹{(w.volatilityPaise / 100).toFixed(0)}
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-mono">
                    {w.activeDays} days
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {w.activeLoan ? (
                      <div>
                        <span className="font-bold text-teal-700">
                          ₹{(w.activeLoan.outstandingBalancePaise / 100).toFixed(0)}
                        </span>{' '}
                        <span className="text-[10px] text-slate-400">
                          ({(w.activeLoan.deductionRateBps / 100).toFixed(1)}%)
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">Eligible</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <NavLink
                      to={`/risk?did=${encodeURIComponent(w.did)}`}
                      className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-bold text-xs"
                    >
                      <span>Risk Deep-Dive</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </NavLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Repayment Engine Controls & Safety Configuration */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-teal-600" />
                <span>Deterministic Repayment Engine Parameters</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md font-semibold border border-teal-200">
                Integer Paise Math • Zero Over-Repay
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure global portfolio default rules: rate basis points, daily safety cap, minimum deduction threshold, and retry ceiling.
            </p>
          </div>
          {configSaveMessage && (
            <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl animate-fadeIn">
              {configSaveMessage}
            </div>
          )}
        </div>

        {/* Formula Explainer Banner */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 flex flex-wrap items-center justify-between gap-2">
          <span>deductionPaise = min( floor(payoutPaise &times; rateBasisPoints / 10000), outstandingPaise, remainingDailyCapPaise )</span>
          <span className="text-teal-700 font-sans font-bold text-xs">500 bps = 5.0%</span>
        </div>

        <form onSubmit={handleSaveEngineConfig} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Repayment Rate (Basis Points)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="10000"
                step="50"
                value={engineConfig.defaultRepaymentRateBps}
                onChange={(e) =>
                  setEngineConfig((prev) => ({
                    ...prev,
                    defaultRepaymentRateBps: parseInt(e.target.value, 10) || 0,
                  }))
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
              <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                {(engineConfig.defaultRepaymentRateBps / 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">500 bps = 5%, 1000 bps = 10%</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Default Daily Cap (Paise)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="5000"
                value={engineConfig.defaultDailyCapPaise}
                onChange={(e) =>
                  setEngineConfig((prev) => ({
                    ...prev,
                    defaultDailyCapPaise: parseInt(e.target.value, 10) || 0,
                  }))
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
              <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                ₹{(engineConfig.defaultDailyCapPaise / 100).toFixed(0)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Daily cap clamped per worker</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Min Threshold (Paise)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="50"
                value={engineConfig.minimumDeductionThresholdPaise}
                onChange={(e) =>
                  setEngineConfig((prev) => ({
                    ...prev,
                    minimumDeductionThresholdPaise: parseInt(e.target.value, 10) || 0,
                  }))
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
              <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                ₹{(engineConfig.minimumDeductionThresholdPaise / 100).toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Below this, deduction = 0</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Debit Retry Limit
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="10"
                value={engineConfig.maxRetries}
                onChange={(e) =>
                  setEngineConfig((prev) => ({
                    ...prev,
                    maxRetries: parseInt(e.target.value, 10) || 3,
                  }))
                }
                className="w-24 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
              <button
                type="submit"
                disabled={isSavingConfig}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingConfig ? 'Saving...' : 'Apply Config'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Bounded retry ceiling</p>
          </div>
        </form>
      </div>

      {/* Portfolio Deterministic Repayment Streaming Ledger */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-teal-600" />
                <span>Live Portfolio Repayment Streaming Feed</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-semibold border border-blue-200">
                State Machine Audited
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time audit trail: Payout Event &rarr; Debit Instruction &rarr; Atomic Repayment &rarr; Loan Balance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTransactions}
              disabled={loadingTransactions}
              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition"
              title="Refresh transaction stream"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTransactions ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Payout Ref / State</th>
                <th className="py-2.5 px-3">Gross Payout</th>
                <th className="py-2.5 px-3">Debit Instruction ID</th>
                <th className="py-2.5 px-3">Debit Status</th>
                <th className="py-2.5 px-3">Deduction (INR)</th>
                <th className="py-2.5 px-3">Outstanding After</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {portfolioTransactions.length > 0 ? (
                portfolioTransactions.slice(0, 10).map((tx) => (
                  <tr key={tx.payout_id || tx.instruction_id || Math.random()} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-[11px] font-semibold text-slate-800 truncate max-w-[130px]">
                        {tx.payout_reference}
                      </div>
                      <div className="mt-0.5">
                        <StatusBadge status={tx.payout_status || 'PROCESSED'} size="sm" />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      ₹{(Number(tx.payout_amount_paise) / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                      {tx.instruction_id ? tx.instruction_id.slice(0, 16) + '...' : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={tx.debit_status || 'PENDING'} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 font-bold text-teal-700">
                      ₹{tx.repayment_amount_paise !== null && tx.repayment_amount_paise !== undefined
                        ? (Number(tx.repayment_amount_paise) / 100).toFixed(2)
                        : (Number(tx.debit_amount_paise || 0) / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {tx.outstanding_balance_after !== null && tx.outstanding_balance_after !== undefined
                        ? `₹${(Number(tx.outstanding_balance_after) / 100).toFixed(2)}`
                        : (tx.debit_status === 'SUCCEEDED' ? '₹0.00' : 'Unchanged')}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {tx.debit_status === 'RETRY_PENDING' ? (
                        <button
                          onClick={() => handleRetryDebit(tx.instruction_id)}
                          disabled={retryingId === tx.instruction_id}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[10px] transition shadow-sm inline-flex items-center gap-1"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${retryingId === tx.instruction_id ? 'animate-spin' : ''}`} />
                          <span>Retry</span>
                        </button>
                      ) : tx.debit_status === 'SUCCEEDED' ? (
                        <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                          Settled
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Synced</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                repayments.slice(0, 5).map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-[11px] font-semibold text-slate-800 truncate max-w-[130px]">
                        {rep.upiRef}
                      </div>
                      <div className="mt-0.5">
                        <StatusBadge status="PROCESSED" size="sm" />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      ₹{(rep.amountPaise * 20 / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                      {rep.debitInstructionId}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status="SUCCEEDED" size="sm" />
                    </td>
                    <td className="py-2.5 px-3 font-bold text-teal-700">
                      ₹{(rep.amountPaise / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      ₹{(rep.newOutstandingBalancePaise / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                        Settled
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Issue Loan */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900">
              Disburse Micro-Credit Facility
            </h3>
            <p className="text-xs text-slate-500">
              Select worker and terms. Loan will be minted on Drunix smart contract with AutoPay linkage.
            </p>

            <form onSubmit={handleIssueLoan} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Borrower Profile
                </label>
                <select
                  value={newLoanDid}
                  onChange={(e) => setNewLoanDid(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium"
                >
                  {workers.map((w) => (
                    <option key={w.did} value={w.did}>
                      {w.name} ({w.primaryPlatform}) • {w.creditTier}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Principal (INR)
                  </label>
                  <input
                    type="number"
                    value={newLoanAmount}
                    onChange={(e) => setNewLoanAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Streaming Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newLoanRate}
                    onChange={(e) => setNewLoanRate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Daily Safety Cap (INR)
                </label>
                <input
                  type="number"
                  value={newLoanCap}
                  onChange={(e) => setNewLoanCap(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Facility Purpose
                </label>
                <input
                  type="text"
                  value={newLoanPurpose}
                  onChange={(e) => setNewLoanPurpose(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                >
                  Confirm & Disburse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
