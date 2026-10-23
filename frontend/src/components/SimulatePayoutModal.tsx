import React, { useState } from 'react';
import { X, Zap, CheckCircle2, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext.js';

interface SimulatePayoutModalProps {
  onClose: () => void;
  defaultWorkerDid?: string;
}

export const SimulatePayoutModal: React.FC<SimulatePayoutModalProps> = ({
  onClose,
  defaultWorkerDid,
}) => {
  const { workers, activeWorker, simulatePayout } = useApp();

  const [selectedDid, setSelectedDid] = useState<string>(
    defaultWorkerDid || activeWorker?.did || workers[0]?.did || ''
  );
  const [platform, setPlatform] = useState<string>('zomato-in');
  const [amountRupees, setAmountRupees] = useState<number>(1200);
  const [failureType, setFailureType] = useState<
    'NONE' | 'INSUFFICIENT_FUNDS' | 'MANDATE_EXCEEDED'
  >('NONE');
  const [isExecuting, setIsExecuting] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const worker = workers.find((w) => w.did === selectedDid) || activeWorker;

  const handleExecute = async () => {
    setIsExecuting(true);
    setReceipt(null);
    try {
      const res = await simulatePayout(selectedDid, platform, amountRupees, failureType);
      setReceipt(res);
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-100 text-teal-700">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Simulate Daily Earnings Payout
              </h2>
              <p className="text-[11px] text-slate-500">
                Trigger simulated platform deposit and watch real-time deduction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {!receipt ? (
            <>
              {/* Worker Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Worker Profile
                </label>
                <select
                  value={selectedDid}
                  onChange={(e) => setSelectedDid(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500 font-medium"
                >
                  {workers.map((w) => (
                    <option key={w.did} value={w.did}>
                      {w.name} ({w.primaryPlatform}) • {w.creditTier}
                    </option>
                  ))}
                </select>
              </div>

              {/* Platform Payer */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Gig Platform Payer
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500 font-medium"
                >
                  <option value="zomato-in">Zomato India (Daily Food Delivery Payout)</option>
                  <option value="swiggy-in">Swiggy (Partner Daily Settlement)</option>
                  <option value="uber-in">Uber India (Driver Daily Payout)</option>
                  <option value="urban-company-in">Urban Company (Service Earnings)</option>
                  <option value="zepto-in">Zepto (Instant Delivery Settlement)</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Daily Payout Amount (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[600, 1000, 1400, 2200].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountRupees(amt)}
                      className={`flex-1 py-1 text-xs rounded-lg border transition font-medium ${
                        amountRupees === amt
                          ? 'bg-teal-50 text-teal-700 border-teal-300 font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edge Case Failure Injection */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Simulation Outcome Scenario
                </label>
                <select
                  value={failureType}
                  onChange={(e) => setFailureType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500 font-medium"
                >
                  <option value="NONE">Standard Flow (Successful Variable AutoPay Debit)</option>
                  <option value="INSUFFICIENT_FUNDS">Simulate Insufficient Bank Balance (Carry-Forward)</option>
                  <option value="MANDATE_EXCEEDED">Simulate Mandate Cap Exceeded</option>
                </select>
              </div>

              {/* Mock Warning */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Safe Hackathon Simulation:</strong> No actual UPI transaction or bank deduction will take place. All math operates in exact integer paise.
                </div>
              </div>
            </>
          ) : (
            /* Result Receipt Card */
            <div className="space-y-4 animate-fadeIn">
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  receipt.debitSuccess
                    ? 'bg-teal-50/70 border-teal-200 text-teal-900'
                    : 'bg-rose-50/70 border-rose-200 text-rose-900'
                }`}
              >
                {receipt.debitSuccess ? (
                  <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-sm">{receipt.message}</div>
                  <div className="text-[11px] opacity-80 font-mono">
                    Timestamp: {new Date(receipt.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Gross Daily Payout</span>
                  <span className="font-bold text-slate-900">
                    ₹{(receipt.payout.amountPaise / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Streaming Deduction</span>
                  <span className="font-bold text-teal-700">
                    ₹{receipt.deductionCalculatedRupees.toFixed(2)}
                  </span>
                </div>
                {receipt.updatedLoan && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Remaining Loan Balance</span>
                    <span className="font-bold text-slate-900">
                      ₹{(receipt.updatedLoan.outstandingBalancePaise / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">AutoPay UPI Ref</span>
                  <span className="font-mono text-[11px] text-slate-600">
                    {receipt.upiRef || 'SIMULATED'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
          {!receipt ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecute}
                disabled={isExecuting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isExecuting ? (
                  <span>Processing Stream...</span>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Execute Stream</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm"
            >
              Done & Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
