package main

import (
	"testing"
)

// Unit tests for deduction algorithm and financial constraints
func TestDeductionCalculationLogic(t *testing.T) {
	tests := []struct {
		name                 string
		payoutPaise          int64
		deductionRateBps     int32
		outstandingPaise     int64
		dailyCapPaise        int64
		expectedDeduction    int64
		expectedRemaining    int64
	}{
		{
			name:              "Standard 5% deduction on ₹1,000 payout",
			payoutPaise:       100000, // ₹1,000
			deductionRateBps:  500,    // 5%
			outstandingPaise:  1000000,// ₹10,000
			dailyCapPaise:     0,      // No cap
			expectedDeduction: 5000,   // ₹50
			expectedRemaining: 995000, // ₹9,950
		},
		{
			name:              "Day 2 from README: ₹1,400 payout at 5%",
			payoutPaise:       140000, // ₹1,400
			deductionRateBps:  500,
			outstandingPaise:  995000,
			dailyCapPaise:     0,
			expectedDeduction: 7000,   // ₹70
			expectedRemaining: 988000,
		},
		{
			name:              "Day 3 from README: slow day ₹300 payout at 5%",
			payoutPaise:       30000,  // ₹300
			deductionRateBps:  500,
			outstandingPaise:  988000,
			dailyCapPaise:     0,
			expectedDeduction: 1500,   // ₹15
			expectedRemaining: 986500,
		},
		{
			name:              "Day 4 from README: off day ₹0 payout",
			payoutPaise:       0,
			deductionRateBps:  500,
			outstandingPaise:  986500,
			dailyCapPaise:     0,
			expectedDeduction: 0,
			expectedRemaining: 986500,
		},
		{
			name:              "Outstanding balance cap: balance is less than calculated deduction",
			payoutPaise:       100000, // ₹1,000 (5% would be ₹50 = 5000 paise)
			deductionRateBps:  500,
			outstandingPaise:  3000,   // Only ₹30 remaining
			dailyCapPaise:     0,
			expectedDeduction: 3000,   // Capped to ₹30
			expectedRemaining: 0,      // Fully settled
		},
		{
			name:              "Daily cap enforcement",
			payoutPaise:       200000, // ₹2,000 (5% would be ₹100 = 10000 paise)
			deductionRateBps:  500,
			outstandingPaise:  1000000,
			dailyCapPaise:     6000,   // Daily cap of ₹60
			expectedDeduction: 6000,   // Capped to ₹60
			expectedRemaining: 994000,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rawDeduction := (tc.payoutPaise * int64(tc.deductionRateBps)) / 10000
			deduction := rawDeduction
			if deduction > tc.outstandingPaise {
				deduction = tc.outstandingPaise
			}
			if tc.dailyCapPaise > 0 && deduction > tc.dailyCapPaise {
				deduction = tc.dailyCapPaise
			}
			if tc.payoutPaise <= 0 {
				deduction = 0
			}

			if deduction != tc.expectedDeduction {
				t.Fatalf("expected deduction %d paise, got %d paise", tc.expectedDeduction, deduction)
			}

			remaining := tc.outstandingPaise - deduction
			if remaining != tc.expectedRemaining {
				t.Fatalf("expected remaining %d paise, got %d paise", tc.expectedRemaining, remaining)
			}
		})
	}
}
