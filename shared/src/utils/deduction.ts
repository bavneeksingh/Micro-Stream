/**
 * Deterministic Repayment Engine Math & Rounding Policy for MicroStream
 *
 * CORE FORMULA:
 *   deductionPaise = min(
 *     floor(payoutPaise * rateBasisPoints / 10000),
 *     outstandingPaise,
 *     remainingDailyCapPaise
 *   )
 *
 * ROUNDING & OVERFLOW POLICY:
 * 1. Integer Arithmetic & Overflow Safety:
 *    Multiplication is calculated using JavaScript `BigInt` (arbitrary-precision integer arithmetic):
 *    (BigInt(payoutPaise) * BigInt(rateBasisPoints)) / 10000n
 *    This completely avoids 32-bit integer overflow and floating-point inaccuracy.
 * 2. Documented Rounding Policy:
 *    Explicit `floor` integer division (truncation toward zero) is applied.
 *    Any fractional sub-paise remainder is truncated, ensuring the worker is never
 *    overcharged by even 1 fraction of a paise.
 * 3. Non-Negative Guarantee:
 *    Deductions are clamped to >= 0. Zero payouts or zero income days produce strictly 0 deduction.
 * 4. Boundary Protection:
 *    Deductions never exceed the current outstanding balance or the remaining daily cap.
 * 5. Minimum Deduction Threshold:
 *    If a minimum deduction threshold is configured and raw deduction falls below it,
 *    the deduction is set to 0 to prevent micro-dust transactions.
 */

export interface CalculateDeductionParams {
  payoutAmountPaise: number;
  deductionRateBps: number; // e.g. 500 = 5.00%
  outstandingBalancePaise: number;
  dailyCapPaise?: number; // 0 or undefined means no daily cap
  alreadyDeductedTodayPaise?: number; // Total paise already deducted today towards cap
  minimumDeductionThresholdPaise?: number; // Minimum deduction threshold (e.g. 100 paise)
}

export interface DeductionResult {
  payoutAmountPaise: number;
  deductionRateBps: number;
  rawCalculatedPaise: number;
  deductionPaise: number;
  remainingBalancePaise: number;
  remainingDailyCapPaise: number;
  isCappedByBalance: boolean;
  isCappedByDailyLimit: boolean;
  isBelowThreshold: boolean;
  isZeroPayout: boolean;
}

export function calculateDeduction(params: CalculateDeductionParams): DeductionResult {
  const {
    payoutAmountPaise,
    deductionRateBps,
    outstandingBalancePaise,
    dailyCapPaise = 0,
    alreadyDeductedTodayPaise = 0,
    minimumDeductionThresholdPaise = 0,
  } = params;

  // Zero income or zero balance rules
  if (payoutAmountPaise <= 0 || outstandingBalancePaise <= 0 || deductionRateBps <= 0) {
    return {
      payoutAmountPaise: Math.max(0, Math.floor(payoutAmountPaise || 0)),
      deductionRateBps,
      rawCalculatedPaise: 0,
      deductionPaise: 0,
      remainingBalancePaise: Math.max(0, Math.floor(outstandingBalancePaise || 0)),
      remainingDailyCapPaise: dailyCapPaise > 0 ? Math.max(0, dailyCapPaise - alreadyDeductedTodayPaise) : Infinity,
      isCappedByBalance: false,
      isCappedByDailyLimit: false,
      isBelowThreshold: false,
      isZeroPayout: payoutAmountPaise <= 0,
    };
  }

  // 1. Overflow-safe integer multiplication & floor division via BigInt
  const safePayout = BigInt(Math.floor(payoutAmountPaise));
  const safeRate = BigInt(Math.floor(deductionRateBps));
  const rawBigInt = (safePayout * safeRate) / 10000n;
  const rawCalculatedPaise = Number(rawBigInt);

  // 2. Minimum deduction threshold check
  if (minimumDeductionThresholdPaise > 0 && rawCalculatedPaise < minimumDeductionThresholdPaise) {
    return {
      payoutAmountPaise: Math.floor(payoutAmountPaise),
      deductionRateBps,
      rawCalculatedPaise,
      deductionPaise: 0,
      remainingBalancePaise: Math.floor(outstandingBalancePaise),
      remainingDailyCapPaise: dailyCapPaise > 0 ? Math.max(0, dailyCapPaise - alreadyDeductedTodayPaise) : Infinity,
      isCappedByBalance: false,
      isCappedByDailyLimit: false,
      isBelowThreshold: true,
      isZeroPayout: false,
    };
  }

  // 3. Compute remaining daily cap
  let remainingDailyCapPaise = Infinity;
  if (dailyCapPaise > 0) {
    remainingDailyCapPaise = Math.max(0, dailyCapPaise - alreadyDeductedTodayPaise);
  }

  // 4. Apply min(raw, outstanding, remainingDailyCap)
  let deductionPaise = rawCalculatedPaise;
  let isCappedByBalance = false;
  let isCappedByDailyLimit = false;

  if (deductionPaise > outstandingBalancePaise) {
    deductionPaise = outstandingBalancePaise;
    isCappedByBalance = true;
  }

  if (deductionPaise > remainingDailyCapPaise) {
    deductionPaise = remainingDailyCapPaise;
    isCappedByDailyLimit = true;
  }

  // Final non-negative clamp
  deductionPaise = Math.max(0, Math.floor(deductionPaise));
  const remainingBalancePaise = Math.max(0, Math.floor(outstandingBalancePaise - deductionPaise));

  return {
    payoutAmountPaise: Math.floor(payoutAmountPaise),
    deductionRateBps,
    rawCalculatedPaise,
    deductionPaise,
    remainingBalancePaise,
    remainingDailyCapPaise: remainingDailyCapPaise === Infinity ? 0 : remainingDailyCapPaise,
    isCappedByBalance,
    isCappedByDailyLimit,
    isBelowThreshold: false,
    isZeroPayout: false,
  };
}

export const calculateDeterministicDeduction = calculateDeduction;
