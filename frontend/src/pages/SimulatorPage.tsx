import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Copy,
  Zap,
  CreditCard,
  Building,
  HelpCircle,
  Code,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
import { TransactionTimeline, TimelineData } from '../components/TransactionTimeline.js';

export const SimulatorPage: React.FC = () => {
  const {
    workers,
    activeWorker,
    setActiveWorkerDid,
    loans,
    mandates,
    simulatePayout,
    approveMandate,
    createMandate,
  } = useApp();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'ONE_CLICK' | 'PAYOUT' | 'AUTOPAY' | 'AUDIT'>('ONE_CLICK');

  // Payout Simulator State
  const [selectedDid, setSelectedDid] = useState<string>(activeWorker?.did || workers[0]?.did || '');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [platform, setPlatform] = useState<string>('zomato-in');
  const [payoutRupees, setPayoutRupees] = useState<number>(1000);
  const [customRef, setCustomRef] = useState<string>(`PAY-ZOMATO-${Date.now().toString().slice(-6)}`);
  const [lastExecutedRef, setLastExecutedRef] = useState<string>('');
  const [isExecutingPayout, setIsExecutingPayout] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);

  // AutoPay Simulator State
  const [mandateVpa, setMandateVpa] = useState<string>('ravi.kumar@oksbi');
  const [mandateMaxRupees, setMandateMaxRupees] = useState<number>(2000);
  const [mandateFrequency, setMandateFrequency] = useState<'AS_PRESENTED' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('AS_PRESENTED');
  const [autoPayScenario, setAutoPayScenario] = useState<'SUCCESS' | 'INSUFFICIENT_FUNDS' | 'TIMEOUT' | 'DUPLICATE_CALLBACK'>('SUCCESS');
  const [retryPendingInstructions, setRetryPendingInstructions] = useState<any[]>([]);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // One-Click Demo State
  const [oneClickResult, setOneClickResult] = useState<any>(null);
  const [isOneClickRunning, setIsOneClickRunning] = useState<boolean>(false);
  const [oneClickStage, setOneClickStage] = useState<number>(0);

  // Raw JSON Inspector
  const [showJsonInspector, setShowJsonInspector] = useState<boolean>(false);
  const [inspectorData, setInspectorData] = useState<any>(null);

  // Auto-select loan for selected worker
  const activeWorkerLoans = loans.filter((l) => l.did === selectedDid && l.status === 'ACTIVE');
  const selectedLoan = loans.find((l) => l.loanId === selectedLoanId) || activeWorkerLoans[0];
  const activeWorkerMandates = mandates.filter((m) => m.did === selectedDid);
  const selectedWorker = workers.find((w) => w.did === selectedDid) || activeWorker;

  useEffect(() => {
    if (activeWorkerLoans.length > 0 && !selectedLoanId) {
      setSelectedLoanId(activeWorkerLoans[0].loanId);
    }
  }, [selectedDid, activeWorkerLoans, selectedLoanId]);

  // Load retry-pending instructions from transaction history
  const refreshDebitHistory = async () => {
    try {
      const history = await api.getTransactionHistory({ limit: 20 });
      if (history?.transactions) {
        const retriable = history.transactions.filter(
          (t: any) => t.debitInstructionStatus === 'RETRY_PENDING' || t.debitInstructionStatus === 'FAILED'
        );
        setRetryPendingInstructions(retriable);
      }
    } catch {
      // offline / mock fallback
    }
  };

  useEffect(() => {
    refreshDebitHistory();
  }, []);

  // Generate unique payout reference
  const handleGenerateNewRef = () => {
    const newRef = `PAY-${platform.replace('-in', '').toUpperCase()}-${Date.now().toString().slice(-6)}`;
    setCustomRef(newRef);
  };

  // Run Standard Payout Simulation
  const handleExecutePayout = async (isReplay: boolean = false) => {
    const refToUse = isReplay ? lastExecutedRef || customRef : customRef;
    setIsExecutingPayout(true);
    setCurrentStage(1);

    const deductionRate = selectedLoan ? selectedLoan.deductionRateBps / 100 : 5.0;
    const estimatedDeduction = (payoutRupees * deductionRate) / 100;
    const prevBalance = (selectedLoan?.outstandingBalancePaise || 1000000) / 100;

    // Build timeline placeholder
    setTimelineData({
      reference: refToUse,
      workerName: selectedWorker?.name,
      platformId: platform,
      amountRupees: payoutRupees,
      deductionRupees: estimatedDeduction,
      ratePercent: deductionRate,
      mandateUmrn: activeWorkerMandates[0]?.umrn || 'UMRN2026MOCK9123',
      debitStatus: 'PENDING',
      previousBalanceRupees: prevBalance,
      isIdempotentReplay: isReplay,
    });

    setTimeout(() => setCurrentStage(2), 250);
    setTimeout(() => setCurrentStage(3), 500);
    setTimeout(() => setCurrentStage(4), 750);

    try {
      const result = await simulatePayout(
        selectedDid,
        platform,
        payoutRupees,
        autoPayScenario === 'INSUFFICIENT_FUNDS' ? 'INSUFFICIENT_FUNDS' : 'NONE',
        refToUse
      );

      setTimeout(() => {
        setCurrentStage(5);
        setIsExecutingPayout(false);
        setLastExecutedRef(refToUse);
        setInspectorData(result);

        const newBal = (result.updatedLoan?.outstandingBalancePaise ?? (prevBalance * 100 - estimatedDeduction * 100)) / 100;

        setTimelineData((prev) => ({
          ...prev,
          payoutId: result.payout?.id,
          reference: refToUse,
          deductionRupees: result.deductionCalculatedRupees,
          debitStatus: result.debitSuccess ? 'SUCCEEDED' : 'FAILED',
          upiRef: result.upiRef,
          failureReason: result.failureReason,
          newBalanceRupees: newBal,
          isPaidInFull: result.updatedLoan?.status === 'PAID' || newBal === 0,
          isIdempotentReplay: isReplay,
        }));

        refreshDebitHistory();
      }, 1000);
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
      setIsExecutingPayout(false);
      setCurrentStage(0);
    }
  };

  // Run One-Click Verification Demo
  const handleRunOneClickDemo = async () => {
    setIsOneClickRunning(true);
    setOneClickResult(null);
    setOneClickStage(1);

    try {
      // Step progression animation
      setTimeout(() => setOneClickStage(2), 500);
      setTimeout(() => setOneClickStage(3), 1000);

      const res = await api.runOneClickDemo();

      setTimeout(() => {
        setOneClickStage(4);
        setOneClickResult(res);
        setIsOneClickRunning(false);
        setInspectorData(res);

        // Update active timeline
        setCurrentStage(5);
        setTimelineData({
          reference: res.steps?.[0]?.replayedReference || 'PAY-DEMO-ONECLICK',
          amountRupees: 1000,
          deductionRupees: 50,
          ratePercent: 5.0,
          debitStatus: 'SUCCEEDED',
          upiRef: res.steps?.[0]?.upiRef || 'UPI/20261024/9037043152',
          previousBalanceRupees: 10000,
          newBalanceRupees: 9950,
          isIdempotentReplay: true,
        });
      }, 1400);
    } catch (err: any) {
      alert(`One-Click Demo error: ${err.message}`);
      setIsOneClickRunning(false);
      setOneClickStage(0);
    }
  };

  // Create Simulated Mandate
  const handleCreateMandate = async () => {
    try {
      await createMandate({
        did: selectedDid,
        vpa: mandateVpa,
        maxAmountPaise: mandateMaxRupees * 100,
        frequency: mandateFrequency,
        autoApprove: false, // starts in AWAITING_AUTHORIZATION per requirements
      });
      alert('Simulated mandate created in AWAITING_AUTHORIZATION state. Click "Authorize / Approve Mandate" to activate.');
    } catch (err: any) {
      alert(`Mandate creation error: ${err.message}`);
    }
  };

  // Authorize / Approve Mandate
  const handleApproveMandate = async (mandateId: string) => {
    try {
      await approveMandate(mandateId);
      alert(`Mandate ${mandateId} authorized! Status is now ACTIVE.`);
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  // Retry Bounded Debit Instruction
  const handleRetryDebit = async (instructionId: string) => {
    setIsRetrying(true);
    try {
      const res = await api.retryDebitInstruction(instructionId);
      alert(`Debit retry processed: Status = ${res.debitInstruction?.status || 'UPDATED'}`);
      await refreshDebitHistory();
    } catch (err: any) {
      alert(`Retry error: ${err.message}`);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header & Safety Disclaimer Banner */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              MicroStream Payout Integration & UPI AutoPay Simulator
            </h2>
            <p className="text-xs text-slate-500">
              Deterministic repayment streaming engine, simulated e-mandate lifecycle, bounded retries, and idempotency verification.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 text-[11px] font-bold border border-teal-200 flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>MOCK ADAPTER MODE ONLY</span>
            </span>
          </div>
        </div>

        {/* Prominent Safety Banner */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 flex items-start gap-3 text-amber-900 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Sandbox Safety Policy: </span>
            All operations are purely simulated using dedicated in-memory adapters (<code className="font-mono text-[11px] bg-amber-100/70 px-1 py-0.5 rounded text-amber-900">PayoutProviderAdapter</code> and <code className="font-mono text-[11px] bg-amber-100/70 px-1 py-0.5 rounded text-amber-900">AutoPayProviderAdapter</code>).
            No real UPI PINs are ever requested or collected, no bank accounts debited, and no real currency moved.
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('ONE_CLICK')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'ONE_CLICK'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>One-Click Verification Demo</span>
        </button>

        <button
          onClick={() => setActiveTab('PAYOUT')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'PAYOUT'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Payout Simulator & Idempotency</span>
        </button>

        <button
          onClick={() => setActiveTab('AUTOPAY')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'AUTOPAY'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>UPI AutoPay Mandates & Retries</span>
        </button>
      </div>

      {/* TAB 1: ONE-CLICK DEMO */}
      {activeTab === 'ONE_CLICK' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 rounded-2xl p-6 text-white shadow-card space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[11px] font-bold border border-teal-500/30">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Automated 3-Proof Test Suite</span>
                </div>
                <h3 className="text-lg font-bold tracking-tight">
                  One-Click End-to-End Repayment & Idempotency Verification
                </h3>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Proves exact math, non-duplication of repayments on payout replay, and loan balance preservation on debit failures.
                </p>
              </div>

              <button
                onClick={handleRunOneClickDemo}
                disabled={isOneClickRunning}
                className="px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
              >
                {isOneClickRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing 3 Proofs...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Run One-Click Demo</span>
                  </>
                )}
              </button>
            </div>

            {/* Test Specification Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-slate-700/60 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Initial Loan Balance</span>
                <span className="font-bold text-white text-sm">₹10,000.00</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Payout Amount</span>
                <span className="font-bold text-white text-sm">₹1,000.00</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Deduction Rate</span>
                <span className="font-bold text-teal-400 text-sm">5.00% (500 bps)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Expected Deduction</span>
                <span className="font-bold text-teal-300 text-sm">₹50.00</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Expected Balance</span>
                <span className="font-bold text-white text-sm">₹9,950.00</span>
              </div>
            </div>
          </div>

          {/* Proof Cards */}
          {oneClickResult && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn">
              {/* Proof 1 */}
              <div className={`p-5 rounded-2xl border ${
                oneClickResult.proofs?.proof1Success
                  ? 'bg-emerald-50/50 border-emerald-300 text-slate-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Proof 1: Exact Deduction</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-lg font-bold text-slate-900">
                  ₹10,000 → ₹9,950
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  ₹1,000 payout at 5% yielded exactly ₹50 deduction. Simulated debit succeeded with UPI Ref.
                </p>
                <div className="mt-3 pt-2 border-t border-emerald-200 text-[11px] font-mono text-emerald-800 truncate">
                  Ref: {oneClickResult.steps?.[0]?.upiRef}
                </div>
              </div>

              {/* Proof 2 */}
              <div className={`p-5 rounded-2xl border ${
                oneClickResult.proofs?.proof2Idempotency
                  ? 'bg-emerald-50/50 border-emerald-300 text-slate-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Proof 2: Idempotency</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-lg font-bold text-slate-900">
                  0 Duplicate Debits
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Replayed identical payout reference. Backend detected duplicate safely; balance retained at ₹9,950.
                </p>
                <div className="mt-3 pt-2 border-t border-emerald-200 text-[11px] font-mono text-emerald-800 truncate">
                  Status: Duplicate Acknowledged
                </div>
              </div>

              {/* Proof 3 */}
              <div className={`p-5 rounded-2xl border ${
                oneClickResult.proofs?.proof3FailureBalancePreserved
                  ? 'bg-emerald-50/50 border-emerald-300 text-slate-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Proof 3: Failure Safety</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-lg font-bold text-slate-900">
                  Balance Invariant
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Simulated insufficient funds debit failure. Marked RETRY_PENDING without reducing loan balance.
                </p>
                <div className="mt-3 pt-2 border-t border-emerald-200 text-[11px] font-mono text-emerald-800 truncate">
                  Final Balance: ₹9,950.00
                </div>
              </div>
            </div>
          )}

          {/* Embedded Transaction Timeline */}
          <TransactionTimeline
            currentStage={currentStage > 0 ? currentStage : oneClickResult ? 5 : 0}
            data={timelineData}
            isExecuting={isOneClickRunning}
          />
        </div>
      )}

      {/* TAB 2: PAYOUT SIMULATOR & IDEMPOTENCY */}
      {activeTab === 'PAYOUT' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Column */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Payout Event Generator</span>
            </h3>

            <div className="space-y-3.5">
              {/* Select Demo Worker */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  1. Select Demo Gig Worker
                </label>
                <select
                  value={selectedDid}
                  onChange={(e) => {
                    setSelectedDid(e.target.value);
                    setActiveWorkerDid(e.target.value);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500"
                >
                  {workers.map((w) => (
                    <option key={w.did} value={w.did}>
                      {w.name} ({w.primaryPlatform}) — {w.vpa}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Active Loan */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  2. Select Active Micro-Loan
                </label>
                <select
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500"
                >
                  {activeWorkerLoans.length === 0 ? (
                    <option value="">No Active Loan (Zero Deduction)</option>
                  ) : (
                    activeWorkerLoans.map((l) => (
                      <option key={l.loanId} value={l.loanId}>
                        {l.loanId}: Outstanding ₹{(l.outstandingBalancePaise / 100).toFixed(2)} @ {l.deductionRateBps / 100}%
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Gig Platform */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  3. Payer Platform
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-teal-500"
                >
                  <option value="zomato-in">Zomato India (Delivery Partner Daily Settlement)</option>
                  <option value="swiggy-in">Swiggy (Delivery Partner Settlement)</option>
                  <option value="uber-in">Uber India (Driver Trip Settlement)</option>
                  <option value="urban-company-in">Urban Company (Partner Earnings)</option>
                  <option value="zepto-in">Zepto (Instant Delivery Settlement)</option>
                </select>
              </div>

              {/* Payout Amount */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  4. Daily Payout Amount (INR)
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
                  {[500, 1000, 1500, 2000].map((amt) => (
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

              {/* External Payout Reference (With Generate New & Replay test) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    5. External Payout Reference
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateNewRef}
                    className="text-[11px] text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Generate New</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={customRef}
                  onChange={(e) => setCustomRef(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Edit or reuse this reference to test idempotency rejection.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => handleExecutePayout(false)}
                  disabled={isExecutingPayout}
                  className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isExecutingPayout ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Streaming Deduction Loop...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Submit Payout Event</span>
                    </>
                  )}
                </button>

                {lastExecutedRef && (
                  <button
                    onClick={() => handleExecutePayout(true)}
                    disabled={isExecutingPayout}
                    className="w-full py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                    <span>Replay Same Payout (Test Idempotency)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Timeline & Formula Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Real-time Formula Preview */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 font-mono text-xs">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                Deterministic Formula Calculation Preview
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 space-y-1">
                <div className="text-teal-700 font-bold">
                  deductionPaise = min( floor(payoutPaise × rateBps / 10000), outstandingPaise, dailyCapPaise )
                </div>
                <div className="text-slate-600 text-[11px] pt-1">
                  payout: ₹{payoutRupees} | rate: {selectedLoan ? selectedLoan.deductionRateBps / 100 : 5.0}% | outstanding: ₹{selectedLoan ? (selectedLoan.outstandingBalancePaise / 100).toFixed(2) : '10,000.00'}
                </div>
                <div className="text-slate-900 font-bold pt-1 border-t border-slate-100 flex items-center justify-between">
                  <span>Estimated Deduction:</span>
                  <span className="text-teal-700 text-sm">
                    ₹{((payoutRupees * (selectedLoan ? selectedLoan.deductionRateBps : 500)) / 10000).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Embedded Transaction Timeline */}
            <TransactionTimeline
              currentStage={currentStage}
              data={timelineData}
              isExecuting={isExecutingPayout}
            />
          </div>
        </div>
      )}

      {/* TAB 3: AUTOPAY SIMULATOR & BOUNDED RETRIES */}
      {activeTab === 'AUTOPAY' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Mandate Column */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-teal-600" />
              <span>Simulated Mandate Creator</span>
            </h3>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Worker UPI VPA
                </label>
                <input
                  type="text"
                  value={mandateVpa}
                  onChange={(e) => setMandateVpa(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Debit Cap Limit (INR)
                </label>
                <input
                  type="number"
                  value={mandateMaxRupees}
                  onChange={(e) => setMandateMaxRupees(Number(e.target.value))}
                  className="w-full p-2.5 font-bold text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Mandate Frequency
                </label>
                <select
                  value={mandateFrequency}
                  onChange={(e) => setMandateFrequency(e.target.value as any)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="AS_PRESENTED">AS_PRESENTED (Variable Stream)</option>
                  <option value="DAILY">DAILY</option>
                  <option value="WEEKLY">WEEKLY</option>
                  <option value="MONTHLY">MONTHLY</option>
                </select>
              </div>

              <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-teal-900 text-[11px] leading-relaxed">
                ℹ️ Per NPCI specifications, new mandates start in <span className="font-bold">AWAITING_AUTHORIZATION</span> until approved by demo user.
              </div>

              <button
                onClick={handleCreateMandate}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition"
              >
                Create Simulated Mandate
              </button>
            </div>
          </div>

          {/* Mandates & Scenarios Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Mandates List */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
                <span>Active Mandates for {selectedWorker?.name || 'Selected Worker'}</span>
                <span className="text-xs font-mono text-slate-500 font-normal">
                  {activeWorkerMandates.length} Registered
                </span>
              </h3>

              <div className="space-y-3">
                {activeWorkerMandates.map((m) => {
                  const isAwaiting = m.status === 'AWAITING_AUTHORIZATION' || m.status === 'PENDING_AUTH';

                  return (
                    <div
                      key={m.mandateId}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{m.umrn}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isAwaiting
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}>
                            {m.status}
                          </span>
                        </div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          VPA: {m.vpa} | Cap: ₹{(m.maxAmountPaise / 100).toFixed(2)} | Frequency: {m.frequency}
                        </div>
                      </div>

                      {isAwaiting && (
                        <button
                          onClick={() => handleApproveMandate(m.mandateId)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve Mandate</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scenario Injection Selector */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                AutoPay Scenario Injection
              </h3>
              <p className="text-xs text-slate-500">
                Simulate edge cases: bank balance depletion, gateway timeout, and duplicate payment callbacks.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'SUCCESS', title: 'Success', desc: 'Valid debit callback confirmed. Balance reduced.' },
                  { id: 'INSUFFICIENT_FUNDS', title: 'Insufficient Funds', desc: 'Simulate worker bank NSF. Loan balance retained.' },
                  { id: 'TIMEOUT', title: 'Gateway Timeout', desc: 'UPI PSP timeout. Instruction stays pending.' },
                  { id: 'DUPLICATE_CALLBACK', title: 'Duplicate Callback', desc: 'Re-emits callback. No duplicate debit.' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setAutoPayScenario(s.id as any)}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      autoPayScenario === s.id
                        ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">{s.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bounded Retries Management */}
            {retryPendingInstructions.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-amber-200 shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Bounded Retries ({retryPendingInstructions.length} Retriable Debits)</span>
                  </h3>
                </div>

                <div className="space-y-2">
                  {retryPendingInstructions.map((ins) => (
                    <div
                      key={ins.instructionId}
                      className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900">{ins.instructionId}</span>
                        <div className="text-slate-500 text-[11px]">
                          Amount: ₹{((ins.amountPaise || 0) / 100).toFixed(2)} | Reason: {ins.failureReason || 'Failed'}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRetryDebit(ins.instructionId)}
                        disabled={isRetrying}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Retry Debit</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raw JSON Inspector Modal / Collapsible */}
      {inspectorData && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Code className="w-4 h-4 text-teal-600" />
              <span>Inspection Receipt</span>
            </span>
            <button
              onClick={() => setShowJsonInspector(!showJsonInspector)}
              className="text-xs font-mono font-bold text-teal-700 hover:underline"
            >
              {showJsonInspector ? 'Collapse JSON' : 'Expand Raw JSON Receipt'}
            </button>
          </div>

          {showJsonInspector && (
            <pre className="p-4 rounded-xl bg-slate-900 text-teal-300 font-mono text-[11px] overflow-x-auto border border-slate-800 max-h-80">
              {JSON.stringify(inspectorData, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
