import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import {
  Activity,
  Play,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Code,
  Sparkles,
} from 'lucide-react';

export const SimulatorPage: React.FC = () => {
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedDid, setSelectedDid] = useState<string>('did:drunix:worker:ravi-kumar-01');
  const [platform, setPlatform] = useState<string>('zomato-in');
  const [payoutRupees, setPayoutRupees] = useState<number>(1000);
  const [executing, setExecuting] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [receipt, setReceipt] = useState<any>(null);
  const [recentPayouts, setRecentPayouts] = useState<any[]>([]);
  const [showJson, setShowJson] = useState(false);

  const loadData = async () => {
    try {
      const [workersRes, payoutsRes] = await Promise.all([
        api.getWorkers(),
        api.getPayouts(),
      ]);
      setWorkers(workersRes.workers);
      setRecentPayouts(payoutsRes.payouts || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunSimulation = async () => {
    setExecuting(true);
    setReceipt(null);
    setActiveStep(1);

    try {
      // Step animation sequence
      setTimeout(() => setActiveStep(2), 300);
      setTimeout(() => setActiveStep(3), 600);
      setTimeout(() => setActiveStep(4), 900);

      const amountPaise = Math.round(payoutRupees * 100);
      const res = await api.simulatePayout({
        did: selectedDid,
        platformId: platform,
        amountPaise,
      });

      setTimeout(() => {
        setActiveStep(5);
        setReceipt(res);
        setExecuting(false);
        loadData();
      }, 1200);
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
      setExecuting(false);
      setActiveStep(0);
    }
  };

  const selectedWorker = workers.find((w) => w.did === selectedDid);

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-purple-500/30 shadow-xl shadow-purple-950/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              MicroStream End-to-End Streaming Simulator
            </h1>
            <p className="text-xs text-slate-400">
              Interactive sandbox demonstrating the 5-phase loop from daily platform payout to UPI AutoPay micro-debit and Drunix smart contract ledger commit.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Input */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 glass-panel p-6 rounded-2xl space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Simulation Parameters
          </h2>

          <div className="space-y-3">
            <div>
              <label htmlFor="sim-worker-select" className="text-xs font-semibold text-slate-300">
                1. Select Gig Worker
              </label>
              <select
                id="sim-worker-select"
                value={selectedDid}
                onChange={(e) => setSelectedDid(e.target.value)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500"
              >
                {workers.map((w) => (
                  <option key={w.did} value={w.did}>
                    {w.name} ({w.primaryPlatform})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sim-platform-select" className="text-xs font-semibold text-slate-300">
                2. Gig Platform Payer
              </label>
              <select
                id="sim-platform-select"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full mt-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500"
              >
                <option value="zomato-in">Zomato India (Delivery Payout)</option>
                <option value="swiggy-in">Swiggy (Daily Settlement)</option>
                <option value="uber-in">Uber India (Driver Trip Payout)</option>
                <option value="urban-company-in">Urban Company (Service Earnings)</option>
                <option value="zepto-in">Zepto (Rider Daily Settlement)</option>
              </select>
            </div>

            <div>
              <label htmlFor="sim-payout-amount" className="text-xs font-semibold text-slate-300">
                3. Daily Payout Amount (INR)
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                <input
                  id="sim-payout-amount"
                  type="number"
                  value={payoutRupees}
                  onChange={(e) => setPayoutRupees(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-base focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                Stored in engine as {Math.round(payoutRupees * 100)} integer paise
              </div>
            </div>

            {/* Quick preset chips */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[300, 1000, 1400, 2000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setPayoutRupees(amt)}
                  className="py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition text-center"
                >
                  ₹{amt}
                </button>
              ))}
            </div>

            <button
              id="btn-run-simulation"
              type="button"
              onClick={handleRunSimulation}
              disabled={executing}
              className="w-full mt-4 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {executing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Executing Stream Pipeline...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Execute Streaming Deduction</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 5-Step Visual Pipeline */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Real-Time Pipeline Execution Stages
            </h2>
            <span className="text-xs font-mono text-purple-400">
              {activeStep > 0 ? `Stage ${activeStep} of 5` : 'Standby'}
            </span>
          </div>

          <div className="space-y-3">
            {/* Step 1 */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                activeStep >= 1
                  ? 'border-purple-500/50 bg-purple-950/20 text-white'
                  : 'border-white/5 bg-slate-900/40 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-purple-400">
                    1
                  </span>
                  <div>
                    <div className="font-bold text-xs">Gig Platform Payout Emitted</div>
                    <div className="text-[11px] text-slate-400">
                      Platform credits ₹{payoutRupees} into worker bank account and emits webhook.
                    </div>
                  </div>
                </div>
                {activeStep >= 1 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
            </div>

            {/* Step 2 */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                activeStep >= 2
                  ? 'border-cyan-500/50 bg-cyan-950/20 text-white'
                  : 'border-white/5 bg-slate-900/40 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-cyan-400">
                    2
                  </span>
                  <div>
                    <div className="font-bold text-xs">Drunix Payout Oracle Ingestion</div>
                    <div className="text-[11px] text-slate-400">
                      Oracle verifies worker consent and commits daily gross earnings record to chain.
                    </div>
                  </div>
                </div>
                {activeStep >= 2 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
            </div>

            {/* Step 3 */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                activeStep >= 3
                  ? 'border-brand-500/50 bg-brand-950/20 text-white'
                  : 'border-white/5 bg-slate-900/40 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-brand-400">
                    3
                  </span>
                  <div>
                    <div className="font-bold text-xs">Go Chaincode: CalculateDeduction</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      deduction = min( payoutAmount × deductionRate , outstandingBalance , dailyCap )
                    </div>
                  </div>
                </div>
                {activeStep >= 3 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
            </div>

            {/* Step 4 */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                activeStep >= 4
                  ? 'border-emerald-500/50 bg-emerald-950/20 text-white'
                  : 'border-white/5 bg-slate-900/40 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-emerald-400">
                    4
                  </span>
                  <div>
                    <div className="font-bold text-xs">UPI AutoPay Variable Debit (Simulated)</div>
                    <div className="text-[11px] text-slate-400">
                      Executes variable debit under pre-authorized UMRN mandate with idempotency key.
                    </div>
                  </div>
                </div>
                {activeStep >= 4 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
            </div>

            {/* Step 5 */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                activeStep >= 5
                  ? 'border-amber-500/50 bg-amber-950/20 text-white'
                  : 'border-white/5 bg-slate-900/40 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-amber-400">
                    5
                  </span>
                  <div>
                    <div className="font-bold text-xs">Ledger Balance Update & Settlement</div>
                    <div className="text-[11px] text-slate-400">
                      Chaincode reduces outstanding balance and records immutable repayment block.
                    </div>
                  </div>
                </div>
                {activeStep >= 5 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Execution Receipt Box */}
      {receipt && (
        <div className="glass-panel p-6 rounded-2xl border border-emerald-500/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">
                Streaming Execution Confirmed
              </h3>
            </div>
            <button
              onClick={() => setShowJson(!showJson)}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <Code className="w-3.5 h-3.5" />
              <span>{showJson ? 'Hide JSON' : 'View Raw Ledger Receipt'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[11px]">Payout Credited</span>
              <span className="text-white font-bold text-sm">
                ₹{(receipt.payout.amountPaise / 100).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Deducted (Repaid)</span>
              <span className="text-emerald-400 font-bold text-sm">
                ₹{(receipt.deductionCalculatedPaise / 100).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">New Outstanding</span>
              <span className="text-cyan-400 font-bold text-sm">
                ₹{((receipt.updatedLoan?.outstandingBalancePaise || 0) / 100).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">UPI AutoPay Ref</span>
              <span className="text-slate-200 truncate block">
                {receipt.debitResult?.upiRef || 'N/A'}
              </span>
            </div>
          </div>

          {showJson && (
            <pre className="p-4 rounded-xl bg-slate-950 text-slate-300 text-[11px] font-mono overflow-x-auto border border-slate-800 max-h-60">
              {JSON.stringify(receipt, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Recent Payout Simulation History */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h3 className="text-base font-bold text-white">Recent Payout Oracle Events</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Worker DID</th>
                <th className="py-2.5 px-3">Platform</th>
                <th className="py-2.5 px-3">Payout Amount</th>
                <th className="py-2.5 px-3">Reference</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentPayouts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-mono text-slate-300">{p.payoutDate}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{p.did}</td>
                  <td className="py-2.5 px-3 text-cyan-300 font-medium">{p.platformId}</td>
                  <td className="py-2.5 px-3 font-bold text-white">
                    ₹{(p.amountPaise / 100).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{p.reference}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
