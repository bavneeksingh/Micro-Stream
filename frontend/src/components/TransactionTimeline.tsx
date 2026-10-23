import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Wallet,
  Building,
  CreditCard,
  FileCheck,
} from 'lucide-react';

export interface TimelineData {
  payoutId?: string;
  reference?: string;
  workerName?: string;
  platformId?: string;
  amountRupees?: number;
  deductionRupees?: number;
  ratePercent?: number;
  mandateUmrn?: string;
  instructionId?: string;
  idempotencyKey?: string;
  debitStatus?: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'RETRY_PENDING' | 'TIMEOUT';
  upiRef?: string;
  failureReason?: string;
  retryCount?: number;
  maxRetries?: number;
  previousBalanceRupees?: number;
  newBalanceRupees?: number;
  isPaidInFull?: boolean;
  timestamp?: string;
  isIdempotentReplay?: boolean;
}

interface TransactionTimelineProps {
  currentStage: number; // 0 = standby, 1 = payout received, 2 = deduction calculated, 3 = debit requested, 4 = debit result, 5 = loan balance updated
  data?: TimelineData | null;
  isExecuting?: boolean;
}

export const TransactionTimeline: React.FC<TransactionTimelineProps> = ({
  currentStage,
  data,
  isExecuting = false,
}) => {
  const stages = [
    {
      id: 1,
      title: '1. Payout Received',
      shortTitle: 'Payout Received',
      icon: Building,
      description: 'Gig platform daily settlement event ingested via webhook oracle.',
      renderDetails: () => (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div>
            <span className="text-slate-400 block text-[10px]">Platform</span>
            <span className="font-bold text-slate-800">
              {data?.platformId ? data.platformId.replace('-in', '').toUpperCase() : 'ZOMATO'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Gross Payout</span>
            <span className="font-bold text-slate-900">
              ₹{data?.amountRupees?.toFixed(2) || '1,000.00'}
            </span>
          </div>
          <div className="col-span-2 truncate">
            <span className="text-slate-400 block text-[10px]">External Payout Ref</span>
            <span className="text-teal-700 font-bold truncate block">
              {data?.reference || 'PAY-REF-PENDING'}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: '2. Deduction Calculated',
      shortTitle: 'Deduction Calculated',
      icon: Wallet,
      description: 'Deterministic integer floor formula: min(floor(payout × rate), balance, dailyCap)',
      renderDetails: () => (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div>
            <span className="text-slate-400 block text-[10px]">Deduction Rate</span>
            <span className="font-bold text-slate-800">{data?.ratePercent ?? 5.0}% (500 bps)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Calculated Deduction</span>
            <span className="font-bold text-teal-700">
              ₹{data?.deductionRupees !== undefined ? data.deductionRupees.toFixed(2) : '50.00'}
            </span>
          </div>
          <div className="col-span-2 text-[10px] text-slate-500">
            Guaranteed integer floor arithmetic with zero floating-point drift.
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: '3. Debit Requested',
      shortTitle: 'Debit Requested',
      icon: CreditCard,
      description: 'Variable e-mandate debit initiated with stable idempotency key.',
      renderDetails: () => (
        <div className="mt-2 space-y-1.5 text-[11px] font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="flex justify-between">
            <span className="text-slate-400">NPCI UMRN:</span>
            <span className="font-bold text-slate-800">{data?.mandateUmrn || 'UMRN2026MOCK...'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Instruction ID:</span>
            <span className="text-slate-700 truncate max-w-[140px]">{data?.instructionId || 'ins_pending'}</span>
          </div>
          <div className="truncate text-[10px] text-teal-700 pt-1 border-t border-slate-200">
            <span className="text-slate-400">Idempotency Key: </span>
            {data?.idempotencyKey || 'IDEM-PAYOUT-...'}
          </div>
        </div>
      ),
    },
    {
      id: 4,
      title: '4. Debit Result',
      shortTitle: 'Debit Result',
      icon: FileCheck,
      description: 'Validated PSP callback. Never modifies loan balance before confirmed success.',
      renderDetails: () => {
        const isSuccess = data?.debitStatus === 'SUCCEEDED';
        const isTimeout = data?.debitStatus === 'TIMEOUT';
        const isFailed = data?.debitStatus === 'FAILED' || data?.debitStatus === 'RETRY_PENDING';

        return (
          <div className={`mt-2 p-2.5 rounded-lg border text-[11px] font-mono ${
            isSuccess
              ? 'bg-teal-50 border-teal-200 text-teal-900'
              : isTimeout
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center justify-between font-bold">
              <span>Status:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${
                isSuccess
                  ? 'bg-teal-600 text-white'
                  : isTimeout
                  ? 'bg-amber-600 text-white'
                  : 'bg-rose-600 text-white'
              }`}>
                {data?.debitStatus || 'SUCCEEDED'}
              </span>
            </div>

            {isSuccess && (
              <div className="mt-1 text-[10px] truncate">
                <span className="opacity-75">UPI Ref: </span>
                <span className="font-bold">{data?.upiRef || 'UPI/20261024/...'}</span>
              </div>
            )}

            {isTimeout && (
              <div className="mt-1 text-[10px]">
                PSP Timeout simulated. Debit instruction remains PENDING without spawning duplicates.
              </div>
            )}

            {isFailed && (
              <div className="mt-1 text-[10px]">
                Reason: {data?.failureReason || 'INSUFFICIENT_FUNDS'} (Attempt {data?.retryCount || 1} of {data?.maxRetries || 3})
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 5,
      title: '5. Loan Balance Updated',
      shortTitle: 'Loan Updated',
      icon: ShieldCheck,
      description: 'Ledger state transition: balance reduced on success, or invariant on failure.',
      renderDetails: () => (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div>
            <span className="text-slate-400 block text-[10px]">Previous Balance</span>
            <span className="font-bold text-slate-700">
              ₹{data?.previousBalanceRupees !== undefined ? data.previousBalanceRupees.toFixed(2) : '10,000.00'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">New Balance</span>
            <span className={`font-bold text-sm ${
              data?.isPaidInFull ? 'text-emerald-700' : 'text-teal-700'
            }`}>
              ₹{data?.newBalanceRupees !== undefined ? data.newBalanceRupees.toFixed(2) : '9,950.00'}
            </span>
          </div>
          {data?.isIdempotentReplay && (
            <div className="col-span-2 text-[10px] font-sans text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
              ⚠️ Idempotent Replay Verified: Duplicate detected. 0 additional deduction.
            </div>
          )}
          {data?.isPaidInFull && (
            <div className="col-span-2 text-[10px] font-sans text-emerald-800 bg-emerald-50 p-1.5 rounded border border-emerald-200 font-bold flex items-center gap-1">
              🎉 Loan fully settled (Status: PAID)
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-card space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Transaction Lifecycle Timeline</span>
          </h3>
          <p className="text-xs text-slate-500">
            5-Stage execution pipeline from payout receipt to ledger loan balance settlement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isExecuting && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-xs font-medium animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Processing Stage {currentStage} of 5</span>
            </span>
          )}
          {!isExecuting && currentStage === 5 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Pipeline Complete</span>
            </span>
          )}
          {!isExecuting && currentStage === 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Standby</span>
            </span>
          )}
        </div>
      </div>

      {/* Progress Stepper Bar */}
      <div className="relative">
        <div className="overflow-hidden h-1.5 mb-4 text-xs flex rounded-full bg-slate-100">
          <div
            style={{ width: `${(Math.min(currentStage, 5) / 5) * 100}%` }}
            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-teal-600 transition-all duration-500 ease-out"
          />
        </div>
      </div>

      {/* 5 Sequential Stages */}
      <div className="space-y-4">
        {stages.map((stage) => {
          const isCurrent = currentStage === stage.id;
          const isPassed = currentStage > stage.id;
          const isPending = currentStage < stage.id;
          const Icon = stage.icon;

          return (
            <div
              key={stage.id}
              className={`p-4 rounded-xl border transition-all duration-300 ${
                isCurrent
                  ? 'border-teal-400 bg-teal-50/40 shadow-sm ring-1 ring-teal-300/60'
                  : isPassed
                  ? 'border-slate-200 bg-white text-slate-800'
                  : 'border-slate-100 bg-slate-50/50 text-slate-400 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition ${
                      isPassed
                        ? 'bg-teal-600 text-white'
                        : isCurrent
                        ? 'bg-teal-100 text-teal-800 ring-2 ring-teal-500'
                        : 'bg-white border border-slate-200 text-slate-400'
                    }`}
                  >
                    {isPassed ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <span>{stage.id}</span>
                    )}
                  </div>

                  <div>
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                      <span>{stage.title}</span>
                      {isCurrent && isExecuting && (
                        <span className="inline-block w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {stage.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isPassed && (
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      CONFIRMED
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded border border-teal-300">
                      ACTIVE
                    </span>
                  )}
                  {isPending && (
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      WAITING
                    </span>
                  )}
                </div>
              </div>

              {/* Render Stage Data Card when stage is reached or completed */}
              {(isPassed || isCurrent) && data && stage.renderDetails()}
            </div>
          );
        })}
      </div>

      {/* Safety Compliance Footer */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>MOCK ONLY — No real banking operations or UPI PINs collected.</span>
        </span>
        <span className="font-mono text-[10px] text-slate-400">
          NPCI Drunix Protocol Compliant
        </span>
      </div>
    </div>
  );
};
