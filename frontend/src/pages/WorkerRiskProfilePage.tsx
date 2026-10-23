import React, { useState } from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import {
  UserCheck,
  TrendingUp,
  Database,
  Coins,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Code,
  FilePlus,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { MetricCard } from '../components/MetricCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const WorkerRiskProfilePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { workers, earnings, loans } = useApp();

  const initialDid = searchParams.get('did') || workers[0]?.did || '';
  const [selectedDid, setSelectedDid] = useState<string>(initialDid);
  const [showSql, setShowSql] = useState<boolean>(true);

  const worker = workers.find((w) => w.did === selectedDid) || workers[0];
  const workerEarnings = earnings.filter((e) => e.did === selectedDid);
  const activeLoan = loans.find((l) => l.did === selectedDid && l.status === 'ACTIVE');

  // Statistics calculation
  const totalGrossPaise = workerEarnings.reduce((s, e) => s + e.grossEarningsPaise, 0);
  const avgDailyPaise =
    workerEarnings.length > 0 ? Math.round(totalGrossPaise / workerEarnings.length) : 0;

  const sqDiffs = workerEarnings.map((e) => Math.pow(e.grossEarningsPaise - avgDailyPaise, 2));
  const variance = workerEarnings.length > 0 ? sqDiffs.reduce((a, b) => a + b, 0) / workerEarnings.length : 0;
  const volatilityPaise = Math.round(Math.sqrt(variance));

  // Recommended terms based on cash flow health
  let recommendedLimitRupees = 8000;
  let recommendedRatePct = 7.0;

  if (worker?.riskScore >= 85 && workerEarnings.length >= 7) {
    recommendedLimitRupees = 25000;
    recommendedRatePct = 5.0;
  } else if (worker?.riskScore >= 70 && workerEarnings.length >= 5) {
    recommendedLimitRupees = 15000;
    recommendedRatePct = 6.0;
  }

  // Chart data
  const chartData = [...workerEarnings]
    .slice(0, 10)
    .reverse()
    .map((e) => ({
      date: e.date.slice(5),
      income: e.grossEarningsPaise / 100,
    }));

  return (
    <div className="space-y-6">
      {/* Header and Worker Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Worker Cash-Flow Risk Underwriting
          </h2>
          <p className="text-xs text-slate-500">
            Automated credit scoring and volatility analysis calculated directly on Drunix ledger state via YugabyteDB.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">Profile:</label>
          <select
            value={selectedDid}
            onChange={(e) => setSelectedDid(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-teal-500 shadow-sm"
          >
            {workers.map((w) => (
              <option key={w.did} value={w.did}>
                {w.name} ({w.primaryPlatform}) • {w.creditTier}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Identity Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-teal-400 font-mono flex items-center justify-center font-bold text-base shadow-sm">
            DID
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">{worker?.name}</h3>
              <StatusBadge status={worker?.creditTier || 'PRIME_A'} size="sm" />
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              {worker?.did} • {worker?.primaryPlatform} Partner
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-slate-400 block text-[10px]">Underwriting Score</span>
            <span className="text-base font-bold text-slate-900">
              {worker?.riskScore || 75} / 100
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block text-[10px]">Active Earning Days</span>
            <span className="text-base font-bold text-teal-700">
              {workerEarnings.length} days
            </span>
          </div>
        </div>
      </div>

      {/* 4 Risk Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="60-Day Avg Daily Gross"
          value={`₹${(avgDailyPaise / 100).toFixed(0)}`}
          subtitle="Stable daily earning baseline"
          icon={<Coins className="w-5 h-5" />}
          accentColor="teal"
        />
        <MetricCard
          title="Income Volatility (StdDev)"
          value={`±₹${(volatilityPaise / 100).toFixed(0)}`}
          subtitle="Lower indicates predictable cash flow"
          icon={<Activity className="w-5 h-5" />}
          accentColor="blue"
        />
        <MetricCard
          title="Algorithmic Credit Limit"
          value={`₹${recommendedLimitRupees.toLocaleString('en-IN')}`}
          subtitle="Instant underwriting clearance"
          icon={<ShieldCheck className="w-5 h-5" />}
          accentColor="emerald"
        />
        <MetricCard
          title="Recommended Deduction Rate"
          value={`${recommendedRatePct.toFixed(1)}%`}
          subtitle="Per daily gig payout"
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor="purple"
        />
      </div>

      {/* Two Column: Daily Income Volatility Chart & YugabyteDB SQL Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volatility Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Daily Earnings Consistency
          </h3>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
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
                  formatter={(val: any) => [`₹${Number(val).toFixed(2)}`, 'Daily Gross']}
                />
                <Bar dataKey="income" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live YugabyteDB SQL Query Inspector */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-teal-600" />
              <span>YugabyteDB State Query</span>
            </h3>
            <span className="text-[10px] font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              Zero Data Movement
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Lenders assess risk by running standard SQL directly on ledger tables in YugabyteDB:
          </p>

          <pre className="p-3 bg-slate-900 text-teal-300 font-mono text-[11px] rounded-xl overflow-x-auto leading-relaxed border border-slate-800">
{`-- Cash-Flow Underwriting on Ledger State
SELECT
  did,
  COUNT(DISTINCT date)             AS active_days,
  ROUND(AVG(gross_earnings_paise)) AS avg_daily_gross,
  ROUND(STDDEV(gross_earnings_paise)) AS volatility
FROM earnings_records
WHERE did = '${worker?.did}'
  AND date >= CURRENT_DATE - INTERVAL '60 days'
GROUP BY did;`}
          </pre>

          <div className="pt-2 flex justify-between items-center text-xs">
            <span className="text-slate-500">Current Facility:</span>
            {activeLoan ? (
              <span className="font-bold text-teal-700">
                {activeLoan.loanId} (₹{(activeLoan.outstandingBalancePaise / 100).toFixed(2)} remaining)
              </span>
            ) : (
              <NavLink
                to="/loans/apply"
                className="font-bold text-teal-700 hover:text-teal-900 underline flex items-center gap-1"
              >
                <span>Issue Approved Limit</span>
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
