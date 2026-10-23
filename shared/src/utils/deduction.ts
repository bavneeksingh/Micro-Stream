/**
 * Core deduction calculation logic specified for MicroStream chaincode and adapters.
 * Formula:
 *   rawDeduction = round( payoutAmountPaise * (deductionRateBps / 10000) )
 *   deduction = min( rawDeduction, outstandingBalancePaise, dailyCapPaise )
 *
 * Guarantees:
 * - Deduction is always an integer number of paise >= 0.
 * - Deduction never exceeds the remaining outstanding loan balance.
 * - Deduction respects optional daily caps.
 */

export interface CalculateDeductionParams {
  payoutAmountPaise: number;
  deductionRateBps: number; // e.g. 500 = 5.00%
  outstandingBalancePaise: number;
  dailyCapPaise?: number; // 0 or undefined means no daily cap
}

export interface DeductionResult {
  payoutAmountPaise: number;
  deductionRateBps: number;
  rawCalculatedPaise: number;
  deductionPaise: number;
  remainingBalancePaise: number;
  isCappedByBalance: boolean;
  isCappedByDailyLimit: boolean;
  isZeroPayout: boolean;
}

export function calculateDeduction(params: CalculateDeductionParams): DeductionResult {
  const { payoutAmountPaise, deductionRateBps, outstandingBalancePaise, dailyCapPaise = 0 } = params;

  if (payoutAmountPaise <= 0 || outstandingBalancePaise <= 0 || deductionRateBps <= 0) {
    return {
      payoutAmountPaise: Math.max(0, Math.round(payoutAmountPaise)),
      deductionRateBps,
      rawCalculatedPaise: 0,
      deductionPaise: 0,
      remainingBalancePaise: Math.max(0, Math.round(outstandingBalancePaise)),
      isCappedByBalance: false,
      isCappedByDailyLimit: false,
      isZeroPayout: payoutAmountPaise <= 0,
    };
  }

  // Integer math: (payoutAmountPaise * deductionRateBps + 5000) / 10000 for standard rounding
  const rawCalculatedPaise = Math.round((payoutAmountPaise * deductionRateBps) / 10000);

  let deductionPaise = rawCalculatedPaise;
  let isCappedByBalance = false;
  let isCappedByDailyLimit = false;

  // Rule 1: Never exceed outstanding loan balance
  if (deductionPaise > outstandingBalancePaise) {
    deductionPaise = outstandingBalancePaise;
    isCappedByBalance = true;
  }

  // Rule 2: Respect daily cap if configured
  if (dailyCapPaise > 0 && deductionPaise > dailyCapPaise) {
    deductionPaise = dailyCapPaise;
    isCappedByDailyLimit = true;
  }

  // Final sanity clamp: cannot be negative
  deductionPaise = Math.max(0, deductionPaise);
  const remainingBalancePaise = Math.max(0, outstandingBalancePaise - deductionPaise);

  return {
    payoutAmountPaise: Math.round(payoutAmountPaise),
    deductionRateBps,
    rawCalculatedPaise,
    deductionPaise,
    remainingBalancePaise,
    isCappedByBalance,
    isCappedByDailyLimit,
    isZeroPayout: false,
  };
}
