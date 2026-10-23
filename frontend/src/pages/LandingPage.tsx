import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Droplet,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  Cpu,
  Layers,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Activity,
  Coins,
  ChevronRight,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [calcPayout, setCalcPayout] = useState<number>(1200);
  const [calcRate, setCalcRate] = useState<number>(5.0);
  const [calcBalance, setCalcBalance] = useState<number>(10000);

  const calcDeduction = Math.min((calcPayout * calcRate) / 100, calcBalance);
  const newBalance = Math.max(0, calcBalance - calcDeduction);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Navigation */}
      <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm">
            <Droplet className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-base tracking-tight text-slate-900">
            Micro<span className="text-teal-600">Stream</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <NavLink
            to="/login"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            Demo Accounts
          </NavLink>
          <NavLink
            to="/worker"
            className="px-4 py-2 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition shadow-sm flex items-center gap-1.5"
          >
            <span>Launch Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 max-w-6xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          Real-Time Micro-Credit Streaming for Gig Workers
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
          Credit that flows in step with{' '}
          <span className="text-teal-600 underline decoration-teal-300 underline-offset-8">
            every rupee earned.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Replacing the rigid monthly EMI with automatic, proportional micro-deductions from simulated daily gig payouts via UPI AutoPay.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <NavLink
            to="/worker"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition shadow-sm flex items-center justify-center gap-2"
          >
            <span>Enter Worker Portal</span>
            <ArrowRight className="w-4 h-4" />
          </NavLink>
          <NavLink
            to="/lender"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-300 transition shadow-sm flex items-center justify-center gap-2"
          >
            <span>Lender Risk Center</span>
          </NavLink>
        </div>
      </section>

      {/* Comparison: The Problem vs The Solution */}
      <section className="py-12 bg-white border-y border-slate-200 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">
              Why Traditional Lending Fails Platform Workers
            </h2>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              Gig workers earn every day, but monthly EMIs assume fixed 30-day corporate salaries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* The Old Rigid Way */}
            <div className="p-6 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-4">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <XCircle className="w-5 h-5" />
                <span>Conventional Monthly EMI (The Default Trap)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Worker earns ₹6,000, ₹5,500, and ₹6,200 for three weeks, then faces a slow fourth week earning only ₹1,800. Despite making ₹19,500 overall, a ₹5,000 monthly due date triggers a harsh default penalty.
              </p>
              <div className="p-3 bg-white rounded-xl border border-rose-200 text-xs font-mono space-y-1 text-slate-700">
                <div className="text-slate-400 text-[10px]">MONTH-END CLIFF:</div>
                <div className="flex justify-between">
                  <span>Due Date: 30th of month</span>
                  <span className="text-rose-600 font-bold">₹5,000 Fixed Due</span>
                </div>
                <div className="text-rose-600 text-[11px] font-bold">
                  ✖ Slow week cash shortfall = Default & CIBIL Damage
                </div>
              </div>
            </div>

            {/* The MicroStream Way */}
            <div className="p-6 rounded-2xl border border-teal-200 bg-teal-50/40 space-y-4">
              <div className="flex items-center gap-2 text-teal-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <span>MicroStream Real-Time Streaming</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Repayment flows in lockstep with income. When the gig platform credits the daily payout, MicroStream deducts an exact proportional fraction (e.g. 5%) via UPI AutoPay.
              </p>
              <div className="p-3 bg-white rounded-xl border border-teal-200 text-xs font-mono space-y-1 text-slate-700">
                <div className="text-slate-400 text-[10px]">SMOOTH PROPORTIONAL FLOW:</div>
                <div className="flex justify-between">
                  <span>Good Day (₹1,500 payout)</span>
                  <span className="text-teal-700 font-bold">₹75 deduction (5%)</span>
                </div>
                <div className="flex justify-between">
                  <span>Slow Day (₹300 payout)</span>
                  <span className="text-teal-700 font-bold">₹15 deduction (5%)</span>
                </div>
                <div className="text-teal-700 text-[11px] font-bold">
                  ✔ Zero EMI Cliff • Zero Missed Due Dates
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Worked Example Calculator */}
      <section className="py-16 px-4 sm:px-8 max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">
            Interactive Streaming Calculator
          </h2>
          <p className="text-xs text-slate-500">
            Test how daily payout adjustments dynamically alter the streaming deduction in integer paise.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-card space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Simulated Daily Payout</span>
                  <span className="font-bold text-slate-900">₹{calcPayout}</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="3000"
                  step="50"
                  value={calcPayout}
                  onChange={(e) => setCalcPayout(Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Streaming Deduction Rate</span>
                  <span className="font-bold text-teal-700">{calcRate.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="0.5"
                  value={calcRate}
                  onChange={(e) => setCalcRate(Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Current Loan Balance</span>
                  <span className="font-bold text-slate-900">₹{calcBalance.toLocaleString('en-IN')}</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="20000"
                  step="500"
                  value={calcBalance}
                  onChange={(e) => setCalcBalance(Number(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Calculated Receipt Box */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Instant Deduction Preview
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Worker Receives in Bank:</span>
                    <span className="font-bold text-slate-800">
                      ₹{(calcPayout - calcDeduction).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Streamed Toward Loan:</span>
                    <span className="font-extrabold text-teal-700 text-sm">
                      ₹{calcDeduction.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Remaining Balance:</span>
                    <span className="font-bold text-slate-900">
                      ₹{newBalance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-mono bg-white p-2.5 rounded-lg border border-slate-200">
                Formula: min( payout × {calcRate}% , balance , cap )
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Pillars Architecture */}
      <section className="py-16 bg-white border-t border-slate-200 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">The Three Technology Pillars</h2>
            <p className="text-xs text-slate-500">
              A permissioned financial architecture built for zero-default micro-lending.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                1
              </div>
              <h3 className="font-bold text-base text-slate-900">Decentralized Identity</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Worker creates an anonymous Drunix DID. Gig platforms log verified daily earnings to the smart contract with user consent, building a credit footprint without exposing PII.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                2
              </div>
              <h3 className="font-bold text-base text-slate-900">YugabyteDB Underwriting</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Lenders assess income stability and volatility by running SQL risk queries directly on ledger state, eliminating manual document verification and expensive collection agents.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                3
              </div>
              <h3 className="font-bold text-base text-slate-900">UPI AutoPay e-Mandate</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Variable AutoPay e-mandates trigger automatic daily micro-debits matching the exact calculated fraction. Guaranteed idempotency prevents double charging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-slate-900 text-slate-400 px-4 sm:px-8 text-xs text-center border-t border-slate-800 space-y-2">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white font-bold">
            <Droplet className="w-4 h-4 text-teal-400" />
            <span>MicroStream Prototype</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Simulated demonstration for NPCI Drunix & UPI AutoPay Hackathon. No real financial debits.
          </div>
        </div>
      </footer>
    </div>
  );
};
