import React, { useState } from 'react';
import {
  TrendingUp,
  Filter,
  Search,
  Download,
  Calendar,
  CheckCircle2,
  Coins,
  ChevronDown,
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
} from 'recharts';
import { useApp } from '../context/AppContext.js';
import { MetricCard } from '../components/MetricCard.js';
import { StatusBadge } from '../components/StatusBadge.js';

export const EarningsHistoryPage: React.FC = () => {
  const { activeWorker, earnings } = useApp();
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const workerEarnings = earnings.filter((e) => e.did === activeWorker?.did);

  // Filtered list
  const filteredEarnings = workerEarnings.filter((e) => {
    if (platformFilter !== 'ALL' && !e.platformId.toLowerCase().includes(platformFilter.toLowerCase())) {
      return false;
    }
    if (searchQuery && !e.reference.toLowerCase().includes(searchQuery.toLowerCase()) && !e.date.includes(searchQuery)) {
      return false;
    }
    return true;
  });

  // Financial aggregates
  const totalGrossPaise = filteredEarnings.reduce((sum, e) => sum + e.grossEarningsPaise, 0);
  const totalNetPaise = filteredEarnings.reduce((sum, e) => sum + e.netEarningsPaise, 0);
  const platformFeePaise = totalGrossPaise - totalNetPaise;
  const avgDailyPaise = filteredEarnings.length > 0 ? Math.round(totalGrossPaise / filteredEarnings.length) : 0;

  // Chart data
  const chartData = [...filteredEarnings]
    .slice(0, 14)
    .reverse()
    .map((e) => ({
      date: e.date.slice(5),
      gross: e.grossEarningsPaise / 100,
      net: e.netEarningsPaise / 100,
    }));

  const handleExportCsv = () => {
    const headers = ['Date', 'Platform', 'Gross (INR)', 'Net (INR)', 'Orders Count', 'Reference', 'Ledger Block'];
    const rows = filteredEarnings.map((e) => [
      e.date,
      e.platformId,
      (e.grossEarningsPaise / 100).toFixed(2),
      (e.netEarningsPaise / 100).toFixed(2),
      e.ordersOrTripsCount || 0,
      e.reference,
      e.blockNumber || 'N/A',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `microstream_earnings_${activeWorker?.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Earnings & Payout Ledger
          </h2>
          <p className="text-xs text-slate-500">
            Immutable daily earnings logged on-chain by authorized gig platforms for {activeWorker?.name}.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV Statement</span>
        </button>
      </div>

      {/* Aggregate Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Gross Income"
          value={`₹${(totalGrossPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle={`Across ${filteredEarnings.length} logged earning days`}
          icon={<Coins className="w-5 h-5" />}
          accentColor="teal"
        />
        <MetricCard
          title="Daily Average Income"
          value={`₹${(avgDailyPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Baseline for risk underwriting"
          icon={<TrendingUp className="w-5 h-5" />}
          accentColor="blue"
        />
        <MetricCard
          title="Platform Deductions"
          value={`₹${(platformFeePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Taxes, platform & fuel fees (est.)"
          icon={<Calendar className="w-5 h-5" />}
          accentColor="amber"
        />
        <MetricCard
          title="Net Cash Credited"
          value={`₹${(totalNetPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          subtitle="Deposited directly into bank account"
          icon={<CheckCircle2 className="w-5 h-5" />}
          accentColor="emerald"
        />
      </div>

      {/* Earnings Trend Bar Chart */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Daily Payout Trajectory (Past 14 Days)
          </h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              <span className="w-2.5 h-2.5 rounded bg-teal-600" />
              Gross Income
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              <span className="w-2.5 h-2.5 rounded bg-blue-500" />
              Net in Account
            </span>
          </div>
        </div>

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
                formatter={(val: any) => [`₹${Number(val).toFixed(2)}`, '']}
              />
              <Bar dataKey="gross" fill="#0d9488" radius={[4, 4, 0, 0]} name="Gross Income" />
              <Bar dataKey="net" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Net Income" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter Bar & Detailed Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-card overflow-hidden">
        {/* Filters Header */}
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search reference, date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 whitespace-nowrap">Platform:</span>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            >
              <option value="ALL">All Platforms</option>
              <option value="zomato">Zomato</option>
              <option value="swiggy">Swiggy</option>
              <option value="uber">Uber</option>
              <option value="urban-company">Urban Company</option>
              <option value="zepto">Zepto</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px] bg-slate-50">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Platform</th>
                <th className="py-3 px-4">Orders / Trips</th>
                <th className="py-3 px-4">Gross Payout</th>
                <th className="py-3 px-4">Net Deposited</th>
                <th className="py-3 px-4">Settlement Ref</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEarnings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No earnings matching current search criteria.
                  </td>
                </tr>
              ) : (
                filteredEarnings.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono text-slate-700">{e.date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 uppercase text-[11px]">
                      {e.platformId.replace('-in', '')}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {e.ordersOrTripsCount || 15}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                      ₹{(e.grossEarningsPaise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-bold text-teal-700 tabular-nums">
                      ₹{(e.netEarningsPaise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {e.reference}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={e.status} size="sm" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
