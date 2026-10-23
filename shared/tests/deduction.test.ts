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

describe('Deduction Calculation (README Worked Example)', () => {
  // Worked Example from README.md:
  // ₹10,000 loan (1,000,000 paise), 5% deduction rate (500 bps)
  // Day 1: Payout ₹1,000 (100,000 paise) -> Deduction ₹50 (5,000 paise) -> Remaining ₹9,950 (995,000 paise)
  // Day 2: Payout ₹1,400 (140,000 paise) -> Deduction ₹70 (7,000 paise) -> Remaining ₹9,880 (988,000 paise)
  // Day 3: Payout ₹300 (30,000 paise) -> Deduction ₹15 (1,500 paise) -> Remaining ₹9,865 (986,500 paise)
  // Day 4: Payout ₹0 -> Deduction ₹0 -> Remaining ₹9,865

  it('calculates 5% deduction on ₹1,000 payout accurately', () => {
    const result = calculateDeduction({
      payoutAmountPaise: 100000, // ₹1,000
      deductionRateBps: 500,     // 5%
      outstandingBalancePaise: 1000000, // ₹10,000
    });

    expect(result.deductionPaise).toBe(5000); // ₹50
    expect(result.remainingBalancePaise).toBe(995000); // ₹9,950
    expect(result.isCappedByBalance).toBe(false);
  });

  it('handles zero payout without deducting', () => {
    const result = calculateDeduction({
      payoutAmountPaise: 0,
      deductionRateBps: 500,
      outstandingBalancePaise: 986500,
    });

    expect(result.deductionPaise).toBe(0);
    expect(result.remainingBalancePaise).toBe(986500);
    expect(result.isZeroPayout).toBe(true);
  });

  it('caps deduction at remaining balance when remaining balance is less than percentage', () => {
    // Outstanding balance is only ₹30 (3000 paise), but 5% of ₹1,000 is ₹50 (5000 paise)
    const result = calculateDeduction({
      payoutAmountPaise: 100000,
      deductionRateBps: 500,
      outstandingBalancePaise: 3000,
    });

    expect(result.deductionPaise).toBe(3000);
    expect(result.remainingBalancePaise).toBe(0);
    expect(result.isCappedByBalance).toBe(true);
  });

  it('caps deduction at daily cap if provided', () => {
    // Daily cap is ₹40 (4000 paise), 5% of ₹1,000 is ₹50 (5000 paise)
    const result = calculateDeduction({
      payoutAmountPaise: 100000,
      deductionRateBps: 500,
      outstandingBalancePaise: 1000000,
      dailyCapPaise: 4000,
    });

    expect(result.deductionPaise).toBe(4000);
    expect(result.remainingBalancePaise).toBe(996000);
    expect(result.isCappedByDailyLimit).toBe(true);
  });
});
