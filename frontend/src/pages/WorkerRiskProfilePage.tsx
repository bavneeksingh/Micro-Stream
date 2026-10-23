import React, { useState, useEffect } from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import {
  ShieldCheck,
  TrendingUp,
  Activity,
  Coins,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Calendar,
  Lock,
  RefreshCw,
  Sliders,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { MetricCard } from '../components/MetricCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { api } from '../services/api.js';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

export const WorkerRiskProfilePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { workers, activeWorker } = useApp();

  const paramId = searchParams.get('workerId') || searchParams.get('did') || '';
  const matchedWorker = workers.find(
    (w) => w.did === paramId || (w as any).id === paramId || w.userId === paramId
  );
  const initialDid = matchedWorker?.did || paramId || activeWorker?.did || workers[0]?.did || '';
  const [selectedDid, setSelectedDid] = useState<string>(initialDid);
  const [windowDays, setWindowDays] = useState<30 | 60>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Live analytics state from backend
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [riskAssessment, setRiskAssessment] = useState<any>(null);
  const [workerInfo, setWorkerInfo] = useState<any>(null);
  const [consentInfo, setConsentInfo] = useState<any>(null);
  const [showSql, setShowSql] = useState<boolean>(false);

  const selectedWorker = workers.find((w) => w.did === selectedDid) || workers[0];

  const fetchRiskData = async () => {
    setLoading(true);
    setError(null);
    try {
      // First try lender risk endpoint (which enforces consent and privacy)
      const res = await api.getLenderWorkerRisk(selectedDid, windowDays);
      if (res) {
        setAnalyticsData(res.analytics);
        setRiskAssessment(res.riskAssessment);
        setWorkerInfo(res.worker);
        setConsentInfo(res.consent);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('403')) {
        setError('CONSENT_REQUIRED: Worker has not granted active consent for credit assessment.');
      } else {
        // Fallback to direct analytics endpoint if lender token not set
        try {
          const directAnalytics = await api.getWorkerCashFlowAnalytics(selectedDid, windowDays);
          const directRisk = await api.getWorkerRiskAssessment(selectedDid, windowDays);
          setAnalyticsData(directAnalytics);
          setRiskAssessment(directRisk);
          setWorkerInfo({
            id: directAnalytics.workerId,
            pseudonymId: directAnalytics.pseudonymId,
            primaryPlatform: directAnalytics.platform,
            creditTier: selectedWorker?.creditTier || 'STANDARD_B',
          });
        } catch (innerErr: any) {
          setError(innerErr.message || 'Failed to load cash-flow analytics');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
  }, [selectedDid, windowDays]);

  // Chart data mapping
  const chartData = (analyticsData?.dailySeries || []).map((d: any) => ({
    date: d.date.slice(5),
    grossRupees: (d.grossEarningsPaise || 0) / 100,
    status: d.status,
    orders: d.ordersCount || 0,
  }));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Window Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Cash-Flow Analytics & Transparent Underwriting
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 text-[10px] font-mono font-bold border border-teal-200">
              PostgreSQL SQL Engine
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Rules-based assessment derived deterministically from persisted gig settlement records and AutoPay reliability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Worker Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Worker:</span>
            <select
              value={selectedDid}
              onChange={(e) => setSelectedDid(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-teal-500 shadow-sm"
            >
              {workers.map((w) => (
                <option key={w.did} value={w.did}>
                  {w.name} ({w.primaryPlatform})
                </option>
              ))}
            </select>
          </div>

          {/* Rolling Window Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setWindowDays(30)}
              className={`px-3 py-1 rounded-lg transition ${
                windowDays === 30
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rolling 30 Days
            </button>
            <button
              onClick={() => setWindowDays(60)}
              className={`px-3 py-1 rounded-lg transition ${
                windowDays === 60
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rolling 60 Days
            </button>
          </div>
        </div>
      </div>

      {/* Consent Error Banner if applicable */}
      {error && error.includes('CONSENT_REQUIRED') && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3 text-xs">
          <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Privacy Consent Enforcement Active</div>
            <p>
              Under the MicroStream & NPCI Consent Framework, lender access to cash-flow records requires an active consent grant from the worker.
              This worker has not yet granted or has revoked <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">EARNINGS_READ</code> consent.
            </p>
            <div className="pt-2">
              <NavLink to="/consents" className="font-bold underline text-amber-900 hover:text-amber-950">
                Manage Consent Grants & Permissions →
              </NavLink>
            </div>
          </div>
        </div>
      )}

      {/* Privacy-Preserving Worker Identity Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-teal-400 font-mono flex items-center justify-center font-bold text-sm shadow-sm">
            {workerInfo?.pseudonymId ? workerInfo.pseudonymId.slice(0, 3) : 'GIG'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {workerInfo?.pseudonymId || 'GIG-WRK-0000'}
              </h3>
              <StatusBadge status={selectedWorker?.creditTier || 'STANDARD_B'} size="sm" />
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono border border-slate-200">
                Pseudonymized
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-2">
              <span>{selectedWorker?.primaryPlatform} Partner</span>
              <span>•</span>
              <span>{selectedWorker?.did}</span>
              {workerInfo?.phoneMasked && (
                <>
                  <span>•</span>
                  <span>{workerInfo.phoneMasked}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Data Window</span>
            <span className="text-sm font-bold text-slate-900">
              {windowDays} Days ({analyticsData?.startDate?.slice(5)} to {analyticsData?.endDate?.slice(5)})
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Sample Completeness</span>
            <span className="text-sm font-bold text-teal-700">
              {analyticsData?.sampleCompletenessPct ?? 90}%
            </span>
          </div>
        </div>
      </div>

      {/* 9 Calculated Cash-Flow Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Average Daily Earnings */}
        <MetricCard
          title={`Avg Daily Earnings (${windowDays}d)`}
          value={`₹${((analyticsData?.avgDailyEarningsPaise || 0) / 100).toFixed(0)}`}
          subtitle={`₹${((analyticsData?.calendarAvgDailyEarningsPaise || 0) / 100).toFixed(0)} across all calendar days`}
          icon={<Coins className="w-5 h-5" />}
          accentColor="teal"
          tooltip="Average gross income on active earning days vs across the full calendar window."
        />

        {/* 2. Median Daily Earnings */}
        <MetricCard
          title="Median Daily Earnings"
          value={`₹${((analyticsData?.medianDailyEarningsPaise || 0) / 100).toFixed(0)}`}
          subtitle="Resistant to single-day outlier spikes"
          icon={<Activity className="w-5 h-5" />}
          accentColor="blue"
          tooltip="Midpoint of daily earnings: provides a stable baseline unaffected by occasional extreme surge days."
        />

        {/* 3. Earnings Volatility */}
        <MetricCard
          title="Earnings Volatility (CV)"
          value={`CV: ${analyticsData?.volatilityCoefficient ?? '0.25'}`}
          subtitle={`Tier: ${analyticsData?.volatilityTier || 'LOW'} (±₹${((analyticsData?.volatilityPaise || 0) / 100).toFixed(0)})`}
          icon={<Activity className="w-5 h-5" />}
          accentColor={analyticsData?.volatilityTier === 'HIGH' ? 'red' : 'purple'}
          tooltip="Coefficient of Variation (StdDev / Mean). Lower CV indicates highly consistent and predictable daily cash flow."
        />

        {/* 4. Active Days vs Zero vs Missing */}
        <MetricCard
          title="Active Earning Days"
          value={`${analyticsData?.activeEarningDays ?? 0} of ${windowDays} Days`}
          subtitle={`${analyticsData?.zeroIncomeDays ?? 0} zero-income • ${analyticsData?.missingDataDays ?? 0} missing`}
          icon={<Calendar className="w-5 h-5" />}
          accentColor="emerald"
          tooltip="Explicitly distinguishes active earning days, genuine recorded zero-earning days, and unsubmitted missing data."
        />

        {/* 5. Recent Earnings Trend */}
        <MetricCard
          title="Recent Earnings Trend"
          value={`${analyticsData?.recentTrend?.changePct >= 0 ? '+' : ''}${analyticsData?.recentTrend?.changePct ?? 0}%`}
          subtitle={`Status: ${analyticsData?.recentTrend?.trend || 'STABLE'}`}
          icon={
            analyticsData?.recentTrend?.trend === 'RISING' ? (
              <ArrowUpRight className="w-5 h-5 text-emerald-600" />
            ) : analyticsData?.recentTrend?.trend === 'FALLING' ? (
              <ArrowDownRight className="w-5 h-5 text-rose-600" />
            ) : (
              <Minus className="w-5 h-5 text-slate-500" />
            )
          }
          accentColor={
            analyticsData?.recentTrend?.trend === 'RISING'
              ? 'emerald'
              : analyticsData?.recentTrend?.trend === 'FALLING'
              ? 'red'
              : 'teal'
          }
          tooltip="Compares average daily income in the second half of the rolling period vs the first half."
        />

        {/* 6. Payout Frequency */}
        <MetricCard
          title="Payout Frequency"
          value={`Every ${analyticsData?.payoutFrequencyDays ?? 1.2} Days`}
          subtitle={`${analyticsData?.payoutsCount ?? 0} total settlements in window`}
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor="teal"
          tooltip="Average interval between gig platform payout settlements."
        />

        {/* 7. Outstanding Balance */}
        <MetricCard
          title="Outstanding Loan Balance"
          value={`₹${((analyticsData?.outstandingLoanBalancePaise || 0) / 100).toFixed(2)}`}
          subtitle="Current active micro-credit facility"
          icon={<ShieldCheck className="w-5 h-5" />}
          accentColor="blue"
          tooltip="Principal plus accrued interest remaining on active micro-credit facilities."
        />

        {/* 8. Repayment-to-Earnings Ratio */}
        <MetricCard
          title="Repayment-to-Earnings Ratio"
          value={`${analyticsData?.repaymentToEarningsRatioPct ?? '5.0'}%`}
          subtitle={`₹${((analyticsData?.totalRepaymentsPaise || 0) / 100).toFixed(0)} total repayments`}
          icon={<Coins className="w-5 h-5" />}
          accentColor="purple"
          tooltip="Proportion of total gross income dedicated to loan repayments in this window. Safe benchmark is ≤ 10%."
        />

        {/* 9. Debit Success & Failure Rate */}
        <MetricCard
          title="AutoPay Debit Reliability"
          value={`${analyticsData?.debitSuccessRatePct ?? '100'}% Success`}
          subtitle={`${analyticsData?.failedDebitsCount ?? 0} failed attempts of ${analyticsData?.totalDebitAttempts ?? 0}`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          accentColor={analyticsData?.debitSuccessRatePct < 80 ? 'red' : 'emerald'}
          tooltip="Percentage of UPI AutoPay variable debits successfully settled on the first attempt without NSF failure."
        />
      </div>

      {/* Daily Earnings Breakdown Chart with Zero and Missing Data Markers */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>Rolling {windowDays}-Day Daily Income & Volatility Series</span>
            </h3>
            <p className="text-xs text-slate-500">
              Visualizes daily gross income while explicitly distinguishing active earning days from genuine zero-income days and missing data.
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-teal-600 inline-block" />
              <span>Active Earning</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-400 inline-block" />
              <span>Genuine Zero Income</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-200 inline-block" />
              <span>Missing Data</span>
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} interval={windowDays === 60 ? 3 : 1} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#cbd5e1',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                }}
                formatter={(val: any, _name: any, item: any) => [
                  item.payload.status === 'ACTIVE_EARNING'
                    ? `₹${Number(val).toFixed(2)} (${item.payload.orders} orders)`
                    : item.payload.status === 'ZERO_INCOME'
                    ? '₹0.00 (Genuine Zero Income Day)'
                    : 'Missing Platform Settlement Record',
                  'Income',
                ]}
              />
              <Bar dataKey="grossRupees" radius={[3, 3, 0, 0]}>
                {chartData.map((entry: any, index: number) => {
                  let fill = '#0d9488'; // active
                  if (entry.status === 'ZERO_INCOME') fill = '#f59e0b';
                  if (entry.status === 'MISSING_DATA') fill = '#e2e8f0';
                  return <Cell key={`cell-${index}`} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transparent Rules-Based Risk Engine Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Transparent Rules-Based Risk Assessment
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic, explainable indicators based exclusively on cash-flow metrics. Zero black-box AI scores or demographic attributes.
            </p>
          </div>

          <div>
            {riskAssessment?.status === 'INSUFFICIENT_DATA' ? (
              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300 flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>INSUFFICIENT DATA STATUS</span>
              </span>
            ) : (
              <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                riskAssessment?.riskCategory === 'LOW_RISK'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : riskAssessment?.riskCategory === 'MODERATE_RISK'
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{riskAssessment?.riskCategory?.replace('_', ' ') || 'EVALUATED'}</span>
              </span>
            )}
          </div>
        </div>

        {/* Insufficient Data Notice if applicable */}
        {riskAssessment?.status === 'INSUFFICIENT_DATA' && (
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 text-xs space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <span>Insufficient Earnings Sample Size</span>
            </div>
            <p className="leading-relaxed">
              This worker has only <strong>{riskAssessment.sampleSizeDays} active earning days</strong> recorded in the {windowDays}-day window.
              MicroStream's rules engine requires a minimum of <strong>10 active days</strong> before full credit underwriting can be performed.
            </p>
            <div className="text-[11px] text-amber-800 font-mono">
              Action: Underwriting deferred or limited to starter micro-credit limit (₹2,000) until sufficient earnings history is accumulated.
            </div>
          </div>
        )}

        {/* Table of Transparent Risk Indicators */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase">
                <th className="py-2.5 font-bold">Indicator</th>
                <th className="py-2.5 font-bold">Measured Value</th>
                <th className="py-2.5 font-bold">Regulatory Benchmark</th>
                <th className="py-2.5 font-bold">Level</th>
                <th className="py-2.5 font-bold">Contributing Factors & Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(riskAssessment?.indicators || []).map((ind: any) => (
                <tr key={ind.indicator} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 font-bold text-slate-900">{ind.name}</td>
                  <td className="py-3 font-mono text-slate-800">{ind.measuredValue}</td>
                  <td className="py-3 font-mono text-slate-500 text-[11px]">{ind.benchmark}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ind.level === 'POSITIVE'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : ind.level === 'NEUTRAL'
                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                        : ind.level === 'INSUFFICIENT_DATA'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      {ind.level}
                    </span>
                  </td>
                  <td className="py-3 text-slate-600 max-w-xs">{ind.contributingFactors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Underwriting Recommendation & Rationale */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Recommended Limit</span>
            <span className="font-bold text-slate-900 text-base">
              ₹{((riskAssessment?.underwritingRecommendation?.recommendedCreditLimitPaise || 800000) / 100).toLocaleString('en-IN')}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Deduction Rate</span>
            <span className="font-bold text-teal-700 text-base">
              {((riskAssessment?.underwritingRecommendation?.recommendedDeductionRateBps || 500) / 100).toFixed(1)}% per payout
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Daily Safety Cap</span>
            <span className="font-bold text-slate-900 text-base">
              ₹{((riskAssessment?.underwritingRecommendation?.recommendedDailyCapPaise || 20000) / 100).toFixed(2)}
            </span>
          </div>
          <div className="sm:col-span-3 pt-2 border-t border-slate-200 text-[11px] font-sans text-slate-600">
            <strong>Rationale: </strong>{riskAssessment?.underwritingRecommendation?.rationale}
          </div>
        </div>

        {/* Assumptions & Regulatory Disclaimer */}
        <div className="p-4 rounded-xl bg-slate-100/70 border border-slate-200 text-[11px] text-slate-500 space-y-2">
          <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
            Methodology, Assumptions & Legal Disclaimer
          </div>
          <ul className="list-disc pl-4 space-y-1 text-slate-600">
            <li>Evaluates primary platform payout settlements over a rolling {windowDays}-day period (Sample size: {analyticsData?.activeEarningDays ?? 0} active days).</li>
            <li>Zero-income days are distinguished from missing data when settlement callbacks report zero deliveries.</li>
            <li>No black-box neural networks, no sensitive demographic attributes (age, gender, religion, race).</li>
            <li className="font-semibold text-slate-700">
              Regulatory Note: {riskAssessment?.methodologyAndAssumptions?.regulatoryDisclaimer || 'This transparent assessment does not guarantee loan default prediction or overall creditworthiness.'}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
