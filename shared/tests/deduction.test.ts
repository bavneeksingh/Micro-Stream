import { describe, it, expect } from 'vitest';
import { calculateDeduction } from '../src/utils/deduction.js';
import { rupeesToPaise, paiseToRupees, formatPaise } from '../src/utils/currency.js';

describe('Currency Utilities (Paise Math)', () => {
  it('converts rupees to paise without floating point issues', () => {
    expect(rupeesToPaise(10)).toBe(1000);
    expect(rupeesToPaise(14.50)).toBe(1450);
    expect(rupeesToPaise(0.05)).toBe(5);
  });

  it('converts paise to rupees accurately', () => {
    expect(paiseToRupees(1000)).toBe(10);
    expect(paiseToRupees(1450)).toBe(14.5);
    expect(paiseToRupees(5)).toBe(0.05);
  });

  it('formats paise correctly in Indian number format', () => {
    expect(formatPaise(100000)).toBe('₹1,000.00');
    expect(formatPaise(100000, { showPaiseDecimals: false })).toBe('₹1,000');
    expect(formatPaise(15000000, { compact: true })).toBe('₹1.5L');
  });
});

describe('Deterministic Repayment Engine Formula Tests', () => {
  // Test case 1: ₹1,000 payout at 5% produces ₹50
  it('₹1,000 payout at 5% produces ₹50', () => {
    const result = calculateDeduction({
      payoutAmountPaise: 100000, // ₹1,000 in paise
      deductionRateBps: 500,     // 500 bps = 5%
      outstandingBalancePaise: 1000000, // ₹10,000
    });

    expect(result.deductionPaise).toBe(5000); // ₹50.00
    expect(result.remainingBalancePaise).toBe(995000);
    expect(result.isCappedByBalance).toBe(false);
  });

  // Test case 2: ₹300 payout at 5% produces ₹15
  it('₹300 payout at 5% produces ₹15', () => {
    const result = calculateDeduction({
      payoutAmountPaise: 30000, // ₹300 in paise
      deductionRateBps: 500,    // 500 bps = 5%
      outstandingBalancePaise: 1000000,
    });

    expect(result.deductionPaise).toBe(1500); // ₹15.00
    expect(result.remainingBalancePaise).toBe(998500);
  });

  // Test case 3: Zero payout produces zero deduction
  it('zero payout produces zero deduction', () => {
    const result = calculateDeduction({
      payoutAmountPaise: 0,
      deductionRateBps: 500,
      outstandingBalancePaise: 875500,
    });

    expect(result.deductionPaise).toBe(0);
    expect(result.remainingBalancePaise).toBe(875500);
    expect(result.isZeroPayout).toBe(true);
  });

  // Test case 4: Deduction never exceeds outstanding principal
  it('deduction never exceeds outstanding principal', () => {
    const result = calculateDeduction({
      payoutAmountPaise: 100000, // 5% = ₹50
      deductionRateBps: 500,
      outstandingBalancePaise: 2500, // Outstanding is only ₹25
    });

    expect(result.deductionPaise).toBe(2500); // capped at outstanding
    expect(result.remainingBalancePaise).toBe(0);
    expect(result.isCappedByBalance).toBe(true);
  });

  // Test case 5: Deduction never exceeds remaining daily cap
  it('deduction never exceeds configured daily cap or remaining daily cap', () => {
    // Total cap is ₹100 (10,000 paise). Worker already had ₹70 deducted earlier today.
    // Remaining cap is ₹30 (3,000 paise).
    // Payout is ₹1,000, 5% is ₹50 (5,000 paise).
    // Result should be capped at remaining ₹30 (3,000 paise).
    const result = calculateDeduction({
      payoutAmountPaise: 100000,
      deductionRateBps: 500,
      outstandingBalancePaise: 500000,
      dailyCapPaise: 10000,
      alreadyDeductedTodayPaise: 7000,
    });

    expect(result.deductionPaise).toBe(3000); // ₹30
    expect(result.remainingBalancePaise).toBe(497000);
    expect(result.isCappedByDailyLimit).toBe(true);
  });

  // Test case 6: Minimum deduction threshold avoids micro-dust deductions
  it('enforces minimum deduction threshold', () => {
    // ₹10 payout at 5% produces 5 paise.
    // Minimum threshold is 100 paise (₹1).
    const result = calculateDeduction({
      payoutAmountPaise: 1000, // ₹10
      deductionRateBps: 500,
      outstandingBalancePaise: 500000,
      minimumDeductionThresholdPaise: 100, // ₹1.00 min threshold
    });

    expect(result.rawCalculatedPaise).toBe(50);
    expect(result.deductionPaise).toBe(0);
    expect(result.isBelowThreshold).toBe(true);
  });

  // Test case 7: Overflow-safe integer multiplication for large payouts
  it('handles extremely large payouts without overflow', () => {
    const hugePayoutPaise = 5000000000; // ₹5 crore (50,000,000 INR)
    const result = calculateDeduction({
      payoutAmountPaise: hugePayoutPaise,
      deductionRateBps: 500, // 5%
      outstandingBalancePaise: 10000000000,
    });

    expect(result.deductionPaise).toBe(250000000); // ₹25 Lakh (25,000,000 paise)
    expect(Number.isSafeInteger(result.deductionPaise)).toBe(true);
  });
});
