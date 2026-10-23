import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { MetricCard } from '../components/MetricCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import {
  ShieldAlert,
  TrendingUp,
  Database,
  Coins,
  CheckCircle,
  PlusCircle,
  Search,
  ExternalLink,
} from 'lucide-react';

export const LenderDashboard: React.FC = () => {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [riskProfiles, setRiskProfiles] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueForm, setIssueForm] = useState({
    did: 'did:drunix:worker:priya-uc-04',
    principalRupees: 20000,
    deductionRatePct: 5,
    dailyCapRupees: 200,
    mandateId: 'mnd_priya_04',
    purpose: 'Equipment purchase and working capital',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [portRes, riskRes, loansRes] = await Promise.all([
        api.getPortfolio(),
        api.getRiskProfiles(),
        api.getLoans(),
      ]);

      setPortfolio(portRes);
      setRiskProfiles(riskRes.profiles || []);
      setLoans(loansRes.loans || []);
    } catch (err) {
      console.error('Failed to load lender dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleIssueLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          did: issueForm.did,
          principalPaise: Math.round(issueForm.principalRupees * 100),
          deductionRateBps: Math.round(issueForm.deductionRatePct * 100),
          dailyCapPaise: Math.round(issueForm.dailyCapRupees * 100),
          mandateId: issueForm.mandateId,
          purpose: issueForm.purpose,
        }),
      });

      setShowIssueModal(false);
      await loadData();
      alert('Loan issued successfully on Drunix ledger!');
    } catch (err: any) {
      alert(`Failed to issue loan: ${err.message}`);
    }
  };

  const totalPrincipalRupees = portfolio ? portfolio.totalPrincipalPaise / 100 : 0;
  const totalRepaidRupees = portfolio ? portfolio.totalRepaidPaise / 100 : 0;
  const totalOutstandingRupees = portfolio ? portfolio.totalOutstandingPaise / 100 : 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-emerald-500/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Lender Portfolio & Real-Time Risk Engine
            </h1>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Underwrite gig workers by running SQL risk queries directly on ledger cash-flow state in YugabyteDB. Collect repayments via real-time AutoPay streaming without collection agencies.
          </p>
        </div>

        <button
          id="btn-issue-loan"
          onClick={() => setShowIssueModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 whitespace-nowrap"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Issue Micro-Loan</span>
        </button>
      </div>

      {/* Portfolio Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          id="card-total-deployed"
          title="Total Capital Deployed"
          value={`₹${totalPrincipalRupees.toLocaleString('en-IN')}`}
          subtitle={`Across ${portfolio?.activeLoansCount || 0} active loans`}
          icon={<Coins className="w-5 h-5" />}
          accentColor="emerald"
        />
        <MetricCard
          id="card-streaming-recovered"
          title="Streaming Recoveries"
          value={`₹${totalRepaidRupees.toLocaleString('en-IN')}`}
          subtitle={`${portfolio?.repaymentProgressPct || 0}% overall recovered`}
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor="cyan"
        />
        <MetricCard
          id="card-active-outstanding"
          title="Outstanding Portfolio"
          value={`₹${totalOutstandingRupees.toLocaleString('en-IN')}`}
          subtitle="Streaming continuously per daily payout"
          icon={<Database className="w-5 h-5" />}
          accentColor="blue"
        />
        <MetricCard
          id="card-portfolio-defaults"
          title="Portfolio Defaults"
          value="0.00%"
          subtitle="Eliminated by proportional daily stream"
          icon={<CheckCircle className="w-5 h-5" />}
          accentColor="purple"
        />
      </div>

      {/* YugabyteDB SQL Risk Assessment Table */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>YugabyteDB Cash-Flow Risk Underwriting (Direct Ledger SQL)</span>
            </h2>
            <p className="text-xs text-slate-400">
              Evaluates earning regularity, 60-day average cash-flow, and volatility without requiring bank statements or CIBIL.
            </p>
          </div>
          <span className="px-2.5 py-1 text-xs font-mono bg-slate-900 border border-slate-700 text-slate-400 rounded-lg">
            SELECT * FROM v_worker_cashflow_metrics
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3">Worker DID / Alias</th>
                <th className="py-3 px-3">Platform</th>
                <th className="py-3 px-3">Credit Tier</th>
                <th className="py-3 px-3">Avg Daily Income</th>
                <th className="py-3 px-3">Volatility (StdDev)</th>
                <th className="py-3 px-3">Active Days</th>
                <th className="py-3 px-3">Eligible Limit</th>
                <th className="py-3 px-3">Recommended Rate</th>
                <th className="py-3 px-3">Active Loan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {riskProfiles.map((p) => (
                <tr key={p.did} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 font-medium text-white">
                    <div>{p.name}</div>
                    <div className="text-[11px] font-mono text-slate-400">{p.did}</div>
                  </td>
                  <td className="py-3 px-3 text-cyan-300 font-medium">{p.primaryPlatform}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={p.creditTier} size="sm" />
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-200">
                    ₹{(p.avgDailyGrossPaise / 100).toFixed(0)}
                  </td>
                  <td className="py-3 px-3 text-slate-400">
                    ±₹{(p.volatilityPaise / 100).toFixed(0)}
                  </td>
                  <td className="py-3 px-3 text-slate-300 font-mono">
                    {p.activeEarningDays} days
                  </td>
                  <td className="py-3 px-3 font-bold text-emerald-400">
                    ₹{(p.recommendedCreditLimitPaise / 100).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-amber-400 font-semibold">
                    {(p.recommendedDeductionRateBps / 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-3">
                    {p.hasActiveLoan ? (
                      <span className="text-xs font-mono text-cyan-400">{p.activeLoanId}</span>
                    ) : (
                      <span className="text-xs text-slate-500">None (Eligible)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Loans Portfolio Table */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h2 className="text-base font-bold text-white tracking-tight">
          Active Loans & Streaming Recovery Status
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3">Loan ID</th>
                <th className="py-2.5 px-3">Borrower DID</th>
                <th className="py-2.5 px-3">Principal</th>
                <th className="py-2.5 px-3">Outstanding</th>
                <th className="py-2.5 px-3">Recovered</th>
                <th className="py-2.5 px-3">Streaming Rate</th>
                <th className="py-2.5 px-3">Mandate</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loans.map((l) => (
                <tr key={l.loanId} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 font-mono font-bold text-white">{l.loanId}</td>
                  <td className="py-3 px-3 font-mono text-slate-400">{l.did}</td>
                  <td className="py-3 px-3 text-slate-300 font-medium">
                    ₹{(l.principalPaise / 100).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 font-bold text-cyan-400">
                    ₹{(l.outstandingBalancePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 font-bold text-emerald-400">
                    ₹{(l.totalRepaidPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-amber-300 font-mono">
                    {(l.deductionRateBps / 100).toFixed(1)}% / payout
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-400">{l.mandateId}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={l.status} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Issue Loan */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-lg w-full space-y-4 border border-white/20">
            <h3 className="text-lg font-bold text-white">Issue Simulated Micro-Loan</h3>
            <p className="text-xs text-slate-400">
              Create a smart contract loan instance linked to the worker's decentralized identity and UPI AutoPay variable mandate.
            </p>

            <form onSubmit={handleIssueLoan} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Borrower DID</label>
                <select
                  value={issueForm.did}
                  onChange={(e) => setIssueForm({ ...issueForm, did: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs focus:ring-2 focus:ring-emerald-500"
                >
                  {riskProfiles.map((r) => (
                    <option key={r.did} value={r.did}>
                      {r.name} ({r.primaryPlatform}) — {r.did}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Principal (INR)</label>
                  <input
                    type="number"
                    value={issueForm.principalRupees}
                    onChange={(e) => setIssueForm({ ...issueForm, principalRupees: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Streaming Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={issueForm.deductionRatePct}
                    onChange={(e) => setIssueForm({ ...issueForm, deductionRatePct: parseFloat(e.target.value) || 5 })}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Daily Safety Cap (INR)</label>
                <input
                  type="number"
                  value={issueForm.dailyCapRupees}
                  onChange={(e) => setIssueForm({ ...issueForm, dailyCapRupees: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Loan Purpose</label>
                <input
                  type="text"
                  value={issueForm.purpose}
                  onChange={(e) => setIssueForm({ ...issueForm, purpose: e.target.value })}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-500/20"
                >
                  Issue Loan on Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
