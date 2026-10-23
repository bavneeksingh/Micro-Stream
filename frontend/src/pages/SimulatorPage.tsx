import React, { useState } from 'react';
import {
  Activity,
  Play,
  CheckCircle2,
  AlertTriangle,
  Code,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';

export const SimulatorPage: React.FC = () => {
  const { workers, activeWorker, simulatePayout, loans, mandates } = useApp();

  const [selectedDid, setSelectedDid] = useState<string>(activeWorker?.did || workers[0]?.did || '');
  const [platform, setPlatform] = useState<string>('zomato-in');
  const [payoutRupees, setPayoutRupees] = useState<number>(1200);
  const [failureType, setFailureType] = useState<'NONE' | 'INSUFFICIENT_FUNDS' | 'MANDATE_EXCEEDED'>('NONE');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [activeStage, setActiveStage] = useState<number>(0);
  const [receipt, setReceipt] = useState<any>(null);
  const [showJson, setShowJson] = useState<boolean>(false);

  const selectedWorker = workers.find((w) => w.did === selectedDid) || activeWorker;
  const targetLoan = loans.find((l) => l.did === selectedDid && l.status === 'ACTIVE');
  const targetMandate = mandates.find((m) => m.did === selectedDid && m.status === 'ACTIVE');

  const handleRunSimulation = async () => {
    setIsExecuting(true);
    setReceipt(null);
    setActiveStage(1);

    setTimeout(() => setActiveStage(2), 250);
    setTimeout(() => setActiveStage(3), 500);
    setTimeout(() => setActiveStage(4), 750);

    try {
      const res = await simulatePayout(selectedDid, platform, payoutRupees, failureType);
      setTimeout(() => {
        setActiveStage(5);
        setReceipt(res);
        setIsExecuting(false);
      }, 1000);
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
      setIsExecuting(false);
      setActiveStage(0);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          MicroStream Real-Time Payout & Payment Simulator
        </h2>
        <p className="text-xs text-slate-500">
          Interactive testbed demonstrating the complete 5-stage loop from gig payout detection to UPI AutoPay micro-debit and ledger commitment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span>Simulation Parameters</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                1. Select Gig Worker
              </label>
              <select
                value={selectedDid}
                onChange={(e) => setSelectedDid(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500"
              >
                {workers.map((w) => (
                  <option key={w.did} value={w.did}>
                    {w.name} ({w.primaryPlatform})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                2. Gig Platform Payer
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500"
              >
                <option value="zomato-in">Zomato India (Daily Settlement)</option>
                <option value="swiggy-in">Swiggy (Delivery Partner Payout)</option>
                <option value="uber-in">Uber India (Driver Trip Payout)</option>
                <option value="urban-company-in">Urban Company (Service Earnings)</option>
                <option value="zepto-in">Zepto (Instant Delivery Settlement)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                3. Daily Payout Amount (INR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  value={payoutRupees}
                  onChange={(e) => setPayoutRupees(Number(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 font-bold text-sm rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="grid grid-cols-4 gap-1 mt-2">
                {[400, 1000, 1400, 2200].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setPayoutRupees(amt)}
                    className="py-1 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                4. Outcome Scenario Injection
              </label>
              <select
                value={failureType}
                onChange={(e) => setFailureType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500"
              >
                <option value="NONE">Success (Proportional AutoPay Debit)</option>
                <option value="INSUFFICIENT_FUNDS">Insufficient Bank Funds (Carry Forward)</option>
                <option value="MANDATE_EXCEEDED">Simulate Mandate Cap Exceeded</option>
              </select>
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={isExecuting}
              className="w-full mt-2 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Streaming Loop...</span>
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

        {/* Pipeline Execution Stages */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Real-Time Pipeline Stages
            </h3>
            <span className="text-xs font-mono text-teal-700 font-bold">
              {activeStage > 0 ? `Stage ${activeStage} of 5` : 'Standby'}
            </span>
          </div>

          <div className="space-y-3">
            {/* Stage 1 */}
            <div className={`p-3.5 rounded-xl border transition ${
              activeStage >= 1 ? 'border-teal-300 bg-teal-50/50 text-slate-900' : 'border-slate-100 bg-slate-50/60 text-slate-400'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-teal-700 font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <div className="font-bold text-xs">Platform Payout Emitted</div>
                    <div className="text-[11px] text-slate-500">
                      {platform.replace('-in', '').toUpperCase()} credits ₹{payoutRupees} into worker bank account.
                    </div>
                  </div>
                </div>
                {activeStage >= 1 && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
              </div>
            </div>

            {/* Stage 2 */}
            <div className={`p-3.5 rounded-xl border transition ${
              activeStage >= 2 ? 'border-teal-300 bg-teal-50/50 text-slate-900' : 'border-slate-100 bg-slate-50/60 text-slate-400'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-teal-700 font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <div className="font-bold text-xs">Drunix Payout Oracle Ingestion</div>
                    <div className="text-[11px] text-slate-500">
                      Verified webhook event ingests daily gross earnings into ledger block state.
                    </div>
                  </div>
                </div>
                {activeStage >= 2 && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
              </div>
            </div>

            {/* Stage 3 */}
            <div className={`p-3.5 rounded-xl border transition ${
              activeStage >= 3 ? 'border-teal-300 bg-teal-50/50 text-slate-900' : 'border-slate-100 bg-slate-50/60 text-slate-400'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-teal-700 font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <div className="font-bold text-xs">Go Chaincode: CalculateDeduction</div>
                    <div className="text-[11px] font-mono text-slate-500">
                      deduction = min( payoutAmount × deductionRate , outstandingBalance , dailyCap )
                    </div>
                  </div>
                </div>
                {activeStage >= 3 && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
              </div>
            </div>

            {/* Stage 4 */}
            <div className={`p-3.5 rounded-xl border transition ${
              activeStage >= 4 ? 'border-teal-300 bg-teal-50/50 text-slate-900' : 'border-slate-100 bg-slate-50/60 text-slate-400'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-teal-700 font-bold text-xs flex items-center justify-center">
                    4
                  </span>
                  <div>
                    <div className="font-bold text-xs">UPI AutoPay Variable Debit (Simulated)</div>
                    <div className="text-[11px] text-slate-500">
                      Executes variable debit under UMRN {targetMandate?.umrn || 'UMRN...'} with idempotency.
                    </div>
                  </div>
                </div>
                {activeStage >= 4 && (
                  failureType === 'NONE' ? (
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  )
                )}
              </div>
            </div>

            {/* Stage 5 */}
            <div className={`p-3.5 rounded-xl border transition ${
              activeStage >= 5 ? 'border-teal-300 bg-teal-50/50 text-slate-900' : 'border-slate-100 bg-slate-50/60 text-slate-400'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-teal-700 font-bold text-xs flex items-center justify-center">
                    5
                  </span>
                  <div>
                    <div className="font-bold text-xs">Ledger Loan Balance Update</div>
                    <div className="text-[11px] text-slate-500">
                      Reduces outstanding loan balance and emits verified repayment event block.
                    </div>
                  </div>
                </div>
                {activeStage >= 5 && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmed Receipt Box */}
      {receipt && (
        <div className="bg-white rounded-2xl p-6 border border-teal-200 shadow-card space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">
                {receipt.message}
              </h3>
            </div>
            <button
              onClick={() => setShowJson(!showJson)}
              className="text-xs font-mono text-teal-700 hover:text-teal-900 flex items-center gap-1 font-bold"
            >
              <Code className="w-3.5 h-3.5" />
              <span>{showJson ? 'Hide JSON' : 'Inspect Ledger Block JSON'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">Gross Payout</span>
              <span className="font-bold text-slate-900 text-sm">
                ₹{(receipt.payout.amountPaise / 100).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Stream Deduction</span>
              <span className="font-bold text-teal-700 text-sm">
                ₹{receipt.deductionCalculatedRupees.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Updated Balance</span>
              <span className="font-bold text-slate-900 text-sm">
                ₹{((receipt.updatedLoan?.outstandingBalancePaise || 0) / 100).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">UPI AutoPay Ref</span>
              <span className="text-slate-700 truncate block">
                {receipt.upiRef || 'SIMULATED'}
              </span>
            </div>
          </div>

          {showJson && (
            <pre className="p-4 rounded-xl bg-slate-900 text-teal-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
              {JSON.stringify(receipt, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
