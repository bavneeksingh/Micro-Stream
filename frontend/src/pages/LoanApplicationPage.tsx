import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus,
  Coins,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Zap,
  Sparkles,
  CreditCard,
  Building2,
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { StatusBadge } from '../components/StatusBadge.js';

export const LoanApplicationPage: React.FC = () => {
  const { activeWorker, activeMandate, applyForLoan, activeLoan } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState<number>(1);
  const [amountRupees, setAmountRupees] = useState<number>(12000);
  const [purpose, setPurpose] = useState<string>('EV Two-Wheeler Battery Replacement');
  const [deductionRatePct, setDeductionRatePct] = useState<number>(5.0);
  const [dailyCapRupees, setDailyCapRupees] = useState<number>(200);
  const [lenderName, setLenderName] = useState<string>('Kotak Microfinance');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdLoanId, setCreatedLoanId] = useState<string>('');

  const handleApply = async () => {
    if (!activeWorker) return;
    setIsSubmitting(true);
    try {
      const loan = await applyForLoan({
        did: activeWorker.did,
        amountRupees,
        deductionRatePct,
        dailyCapRupees,
        purpose,
        lenderName,
      });
      setCreatedLoanId(loan.loanId);
      setStep(4);
    } catch (err: any) {
      alert(`Loan application error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Apply for Income-Linked Micro-Credit
        </h2>
        <p className="text-xs text-slate-500">
          Instant underwriting powered by your immutable on-chain gig earnings history. Zero CIBIL required.
        </p>
      </div>

      {/* Stepper Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-card">
        <div className="flex items-center justify-between text-xs font-semibold">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-teal-700' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= 1 ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              1
            </span>
            <span>Credit Terms</span>
          </div>

          <div className="h-0.5 w-12 bg-slate-200" />

          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-teal-700' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= 2 ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              2
            </span>
            <span>Cash-Flow Review</span>
          </div>

          <div className="h-0.5 w-12 bg-slate-200" />

          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-teal-700' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= 3 ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              3
            </span>
            <span>AutoPay Authorize</span>
          </div>
        </div>
      </div>

      {/* Existing Loan Alert if applicable */}
      {activeLoan && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <span>Notice: Active Micro-Loan Detected ({activeLoan.loanId})</span>
          </div>
          <p className="opacity-90">
            You currently have ₹{(activeLoan.outstandingBalancePaise / 100).toFixed(2)} outstanding. Applying will create a concurrent credit facility or increase your active streaming allocation.
          </p>
        </div>
      )}

      {/* Step 1: Credit Request Form */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-card space-y-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            1. Select Requested Amount & Purpose
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1 text-xs font-semibold text-slate-700">
                <span>Requested Amount (INR)</span>
                <span className="text-lg font-extrabold text-slate-900 tabular-nums">
                  ₹{amountRupees.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min="5000"
                max="25000"
                step="1000"
                value={amountRupees}
                onChange={(e) => setAmountRupees(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                <span>Min: ₹5,000</span>
                <span>Max: ₹25,000</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Loan Purpose
              </label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500"
              >
                <option value="EV Two-Wheeler Battery Replacement">EV Two-Wheeler Battery Replacement</option>
                <option value="Smartphone Upgrade for Dispatch">Smartphone Upgrade for Delivery Dispatch</option>
                <option value="Vehicle Service & Tire Replacement">Vehicle Service & Tire Replacement</option>
                <option value="Salon & Equipment Supplies">Salon & Equipment Supplies</option>
                <option value="Emergency Working Capital">Emergency Working Capital</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Lending Partner
              </label>
              <select
                value={lenderName}
                onChange={(e) => setLenderName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500"
              >
                <option value="Kotak Microfinance">Kotak Microfinance (Interest: 12.0% APR)</option>
                <option value="Bajaj Finserv Micro">Bajaj Finserv Micro (Interest: 11.5% APR)</option>
                <option value="IDFC First Bharat">IDFC First Bharat Banking (Interest: 12.5% APR)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
            >
              <span>Continue to Underwriting</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Underwriting & Streaming Rate Review */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-card space-y-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            2. Algorithmic Cash-Flow Underwriting
          </h3>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Worker Credit Health Tier</span>
              <StatusBadge status={activeWorker?.creditTier || 'PRIME_A'} size="sm" />
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">
              Based on your verified 30-day delivery earnings on Drunix ledger, your cash flow stability qualifies for instant loan disbursement with automatic UPI streaming.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Streaming Deduction Rate
              </label>
              <select
                value={deductionRatePct}
                onChange={(e) => setDeductionRatePct(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500"
              >
                <option value="4.0">4.0% per daily payout (Relaxed pace)</option>
                <option value="5.0">5.0% per daily payout (Recommended)</option>
                <option value="6.5">6.5% per daily payout (Faster clearance)</option>
                <option value="8.0">8.0% per daily payout (Accelerated)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Daily Safety Cap (INR)
              </label>
              <input
                type="number"
                value={dailyCapRupees}
                onChange={(e) => setDailyCapRupees(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 font-bold focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                Maximum deduction allowed on a single day
              </span>
            </div>
          </div>

          {/* Dynamic Example Preview */}
          <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200 text-xs space-y-2">
            <div className="font-bold text-teal-900">
              Streaming Repayment Simulation:
            </div>
            <div className="text-slate-700 text-[11px] leading-relaxed">
              On a typical day earning <strong>₹1,200</strong>, your deduction is <strong>₹{((1200 * deductionRatePct) / 100).toFixed(2)}</strong>. You keep <strong>₹{(1200 - (1200 * deductionRatePct) / 100).toFixed(2)}</strong>. On an off day with ₹0 payout, deduction is <strong>₹0.00</strong>.
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
            >
              <span>Authorize AutoPay Mandate</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: AutoPay Mandate Authorization */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-card space-y-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            3. Authorize Variable UPI AutoPay e-Mandate
          </h3>

          <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">Payer VPA:</span>
              <span className="font-mono font-bold text-slate-900">{activeWorker?.vpa}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">Linked Bank Account:</span>
              <span className="font-mono text-slate-700">{activeMandate?.bankAccountMasked || 'XXXX5678'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">Mandate Frequency:</span>
              <span className="font-semibold text-slate-700">AS_PRESENTED (Daily proportional)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">Approved Mandate Cap:</span>
              <span className="font-bold text-slate-900">₹{(activeMandate?.maxAmountPaise ? activeMandate.maxAmountPaise / 100 : 2000).toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Unique Mandate Ref (UMRN):</span>
              <span className="font-mono text-[11px] text-teal-700 font-bold">{activeMandate?.umrn || 'UMRN2026MOCK991'}</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
            By clicking Disburse, you authorize variable debits matching {deductionRatePct}% of each daily payout, capped at ₹{dailyCapRupees}/day. No real UPI debit will occur in prototype mock mode.
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Minting Smart Contract...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Confirm & Disburse ₹{amountRupees.toLocaleString('en-IN')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success & Disbursement Receipt */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-teal-200/90 p-8 shadow-card text-center space-y-5 animate-fadeIn">
          <div className="w-14 h-14 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-extrabold text-slate-900">
              Micro-Credit Disbursed Successfully!
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              ₹{amountRupees.toLocaleString('en-IN')} has been simulated into your bank account. Repayments will stream automatically from each daily payout.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 max-w-md mx-auto text-xs space-y-2 text-left font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Loan Reference:</span>
              <span className="font-bold text-slate-900">{createdLoanId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Principal:</span>
              <span className="font-bold text-slate-900">₹{amountRupees.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Streaming Rate:</span>
              <span className="font-bold text-teal-700">{deductionRatePct}% / payout</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Daily Safety Cap:</span>
              <span className="text-slate-700">₹{dailyCapRupees} / day</span>
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-3">
            <button
              onClick={() => navigate('/worker')}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition"
            >
              Go to Worker Dashboard
            </button>
            <button
              onClick={() => navigate('/loans')}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shadow-sm transition"
            >
              View Loan Terms
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
