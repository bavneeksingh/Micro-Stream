package main

import (
	"strings"
	"testing"
)

func TestSmartContractFunctions(t *testing.T) {
	contract := &SmartContract{}
	ctx := NewMockContext()

	// 1. RegisterWorkerDID
	t.Run("RegisterWorkerDID - Success and Validation", func(t *testing.T) {
		worker, err := contract.RegisterWorkerDID(ctx, "did:drunix:worker:ravi-01", "wrk_ravi_01", "zomato-in", "04b281f6e2c842b09a7b973ef808298192809182")
		if err != nil {
			t.Fatalf("expected successful registration, got: %v", err)
		}
		if worker.DID != "did:drunix:worker:ravi-01" || worker.Status != "ACTIVE" {
			t.Fatalf("unexpected worker state: %+v", worker)
		}

		// Duplicate registration should fail
		_, err = contract.RegisterWorkerDID(ctx, "did:drunix:worker:ravi-01", "wrk_ravi_01", "zomato-in", "04b281f6e2c842b09a7b973ef808298192809182")
		if err == nil || !strings.Contains(err.Error(), "already registered") {
			t.Fatalf("expected duplicate registration error, got: %v", err)
		}

		// Empty DID should fail
		_, err = contract.RegisterWorkerDID(ctx, "", "wrk_ravi_01", "zomato-in", "pubkey")
		if err == nil {
			t.Fatalf("expected empty DID validation error")
		}

		// Retrieve registered worker
		retrieved, err := contract.GetWorkerDID(ctx, "did:drunix:worker:ravi-01")
		if err != nil || retrieved.DID != "did:drunix:worker:ravi-01" {
			t.Fatalf("failed retrieving worker DID: %v", err)
		}
	})

	// 2. GrantConsent & RevokeConsent
	t.Run("GrantConsent and RevokeConsent", func(t *testing.T) {
		consent, err := contract.GrantConsent(
			ctx,
			"cns_001",
			"did:drunix:worker:ravi-01",
			"lender-kotak-micro",
			"earnings:read, deduction:debit",
			"Micro-credit variable AutoPay deduction",
			"2027-10-24T00:00:00Z",
		)
		if err != nil {
			t.Fatalf("expected successful consent grant, got: %v", err)
		}
		if consent.Status != "ACTIVE" || len(consent.Scope) != 2 {
			t.Fatalf("unexpected consent state: %+v", consent)
		}

		// Verify retrieval
		fetched, err := contract.GetConsent(ctx, "cns_001")
		if err != nil || fetched.Status != "ACTIVE" {
			t.Fatalf("failed fetching consent: %v", err)
		}

		// Revoke consent
		revoked, err := contract.RevokeConsent(ctx, "cns_001", "did:drunix:worker:ravi-01")
		if err != nil || revoked.Status != "REVOKED" {
			t.Fatalf("failed revoking consent: %v", err)
		}

		// Mismatched worker DID should fail revocation
		_, err = contract.RevokeConsent(ctx, "cns_001", "did:drunix:worker:other-02")
		if err == nil || !strings.Contains(err.Error(), "does not belong") {
			t.Fatalf("expected mismatched worker error, got: %v", err)
		}
	})

	// 3. LogDailyEarnings & GetEarningsSummary
	t.Run("LogDailyEarnings and GetEarningsSummary", func(t *testing.T) {
		// Log day 1: ₹1,000 (100,000 paise)
		e1, err := contract.LogDailyEarnings(ctx, "did:drunix:worker:ravi-01", "zomato-in", "2026-10-20", 100000, "REF-ZOM-101")
		if err != nil {
			t.Fatalf("expected successful earnings log, got: %v", err)
		}

		// Duplicate reference should safely return existing without creating another record
		e1Dup, err := contract.LogDailyEarnings(ctx, "did:drunix:worker:ravi-01", "zomato-in", "2026-10-20", 100000, "REF-ZOM-101")
		if err != nil || e1Dup != e1 {
			t.Fatalf("duplicate earnings reference should return existing ID safely, got %s vs %s", e1Dup, e1)
		}

		// Log day 2: ₹1,400 (140,000 paise)
		_, err = contract.LogDailyEarnings(ctx, "did:drunix:worker:ravi-01", "zomato-in", "2026-10-21", 140000, "REF-ZOM-102")
		if err != nil {
			t.Fatalf("failed logging day 2 earnings: %v", err)
		}

		// Negative earnings should be rejected
		_, err = contract.LogDailyEarnings(ctx, "did:drunix:worker:ravi-01", "zomato-in", "2026-10-22", -500, "REF-ZOM-NEG")
		if err == nil {
			t.Fatalf("expected rejection for negative earnings")
		}

		// Get earnings summary over 30 days
		summary, err := contract.GetEarningsSummary(ctx, "did:drunix:worker:ravi-01", 30)
		if err != nil {
			t.Fatalf("failed getting earnings summary: %v", err)
		}
		if summary.TotalEarningsPaise != 240000 { // 100,000 + 140,000 = 240,000 paise (₹2,400)
			t.Fatalf("expected total 240000 paise, got: %d", summary.TotalEarningsPaise)
		}
		if summary.ActiveDaysCount != 2 {
			t.Fatalf("expected 2 active days, got: %d", summary.ActiveDaysCount)
		}
		if summary.AverageDailyEarningsPaise != 120000 {
			t.Fatalf("expected average 120000 paise, got: %d", summary.AverageDailyEarningsPaise)
		}
	})

	// 4. IssueLoan & GetLoan
	t.Run("IssueLoan and GetLoan", func(t *testing.T) {
		loan, err := contract.IssueLoan(
			ctx,
			"LN-2026-001",
			"did:drunix:worker:ravi-01",
			"lender-kotak-micro",
			1000000, // ₹10,000 principal
			1200,    // 12% interest
			500,     // 5% deduction rate (500 bps)
			20000,   // ₹200 daily cap
			"mnd_ravi_01",
		)
		if err != nil {
			t.Fatalf("expected successful loan issuance, got: %v", err)
		}
		if loan.OutstandingBalancePaise != 1000000 || loan.Status != "ACTIVE" {
			t.Fatalf("unexpected loan state: %+v", loan)
		}

		// Duplicate loan should fail
		_, err = contract.IssueLoan(ctx, "LN-2026-001", "did:drunix:worker:ravi-01", "lender-kotak-micro", 1000000, 1200, 500, 20000, "mnd_01")
		if err == nil || !strings.Contains(err.Error(), "already exists") {
			t.Fatalf("expected duplicate loan error, got: %v", err)
		}

		// Zero or negative principal should fail
		_, err = contract.IssueLoan(ctx, "LN-2026-BAD", "did:drunix:worker:ravi-01", "lender-kotak-micro", 0, 1200, 500, 20000, "mnd_01")
		if err == nil {
			t.Fatalf("expected non-positive principal validation error")
		}

		// Retrieve loan
		fetched, err := contract.GetLoan(ctx, "LN-2026-001")
		if err != nil || fetched.LoanId != "LN-2026-001" {
			t.Fatalf("failed fetching loan: %v", err)
		}
	})

	// 5. CalculateDeduction - Required Business Rules
	t.Run("CalculateDeduction - Rules & Constraints", func(t *testing.T) {
		// Rule 1: ₹1,000 payout at 5% produces ₹50 (5,000 paise)
		out1, err := contract.CalculateDeduction(ctx, "LN-2026-001", 100000, "PAY-001")
		if err != nil {
			t.Fatalf("calculation failed: %v", err)
		}
		if out1.DeductionAmountPaise != 5000 {
			t.Fatalf("expected 5000 paise deduction for ₹1,000 at 5%%, got %d", out1.DeductionAmountPaise)
		}

		// Rule 2: ₹300 payout at 5% produces ₹15 (1,500 paise)
		out2, err := contract.CalculateDeduction(ctx, "LN-2026-001", 30000, "PAY-002")
		if err != nil {
			t.Fatalf("calculation failed: %v", err)
		}
		if out2.DeductionAmountPaise != 1500 {
			t.Fatalf("expected 1500 paise deduction for ₹300 at 5%%, got %d", out2.DeductionAmountPaise)
		}

		// Rule 3: Zero payout produces zero deduction
		outZero, err := contract.CalculateDeduction(ctx, "LN-2026-001", 0, "PAY-ZERO")
		if err != nil {
			t.Fatalf("calculation failed: %v", err)
		}
		if outZero.DeductionAmountPaise != 0 {
			t.Fatalf("expected 0 deduction for zero payout, got %d", outZero.DeductionAmountPaise)
		}

		// Rule 4: Daily cap clamping (e.g. ₹5,000 payout at 5% would be ₹250 = 25,000 paise, but cap is ₹200 = 20,000 paise)
		outCap, err := contract.CalculateDeduction(ctx, "LN-2026-001", 500000, "PAY-CAP")
		if err != nil {
			t.Fatalf("calculation failed: %v", err)
		}
		if outCap.DeductionAmountPaise != 20000 {
			t.Fatalf("expected cap clamped deduction of 20000 paise, got %d", outCap.DeductionAmountPaise)
		}
	})

	// 6. RecordDebitInstruction
	t.Run("RecordDebitInstruction - Idempotency & Duplicate Rejection", func(t *testing.T) {
		ins, err := contract.RecordDebitInstruction(
			ctx,
			"ins_test_01",
			"LN-2026-001",
			"did:drunix:worker:ravi-01",
			5000,
			"IDEMP_TEST_01",
		)
		if err != nil {
			t.Fatalf("failed recording debit instruction: %v", err)
		}
		if ins.Status != "PENDING" || ins.AmountPaise != 5000 {
			t.Fatalf("unexpected instruction state: %+v", ins)
		}

		// Duplicate instruction ID must be strictly rejected
		_, err = contract.RecordDebitInstruction(
			ctx,
			"ins_test_01",
			"LN-2026-001",
			"did:drunix:worker:ravi-01",
			5000,
			"IDEMP_TEST_01",
		)
		if err == nil || !strings.Contains(err.Error(), "already exists") {
			t.Fatalf("expected duplicate instruction rejection, got: %v", err)
		}
	})

	// 7. UpdateLoanBalance - Success, Balance Retention on Failure, and Duplicate Callback Prevention
	t.Run("UpdateLoanBalance - Execution & Duplicate Callback Protection", func(t *testing.T) {
		// Execute confirmed payment: ₹50 (5,000 paise) deduction
		loan, err := contract.UpdateLoanBalance(
			ctx,
			"LN-2026-001",
			"ins_test_01",
			"SUCCESS",
			5000,
			"UPI/20261024/9998881111",
		)
		if err != nil {
			t.Fatalf("failed updating loan balance: %v", err)
		}
		if loan.OutstandingBalancePaise != 995000 || loan.TotalRepaidPaise != 5000 {
			t.Fatalf("expected balance 995000 paise, got %d", loan.OutstandingBalancePaise)
		}

		// CRITICAL RULE: Duplicate payment callbacks must NOT record a repayment twice
		_, err = contract.UpdateLoanBalance(
			ctx,
			"LN-2026-001",
			"ins_test_01",
			"SUCCESS",
			5000,
			"UPI/20261024/9998881111",
		)
		if err == nil || !strings.Contains(err.Error(), "already been settled") {
			t.Fatalf("expected duplicate callback rejection error, got: %v", err)
		}

		// Test failure: create instruction 2 and fail it
		ins2, err := contract.RecordDebitInstruction(
			ctx,
			"ins_test_02",
			"LN-2026-001",
			"did:drunix:worker:ravi-01",
			7000,
			"IDEMP_TEST_02",
		)
		if err != nil {
			t.Fatalf("failed creating instruction 2: %v", err)
		}

		loanFailed, err := contract.UpdateLoanBalance(
			ctx,
			"LN-2026-001",
			ins2.InstructionId,
			"FAILED",
			0,
			"",
		)
		if err != nil {
			t.Fatalf("failed handling failed payment callback: %v", err)
		}
		// Balance MUST be preserved intact
		if loanFailed.OutstandingBalancePaise != 995000 {
			t.Fatalf("failed payment should preserve loan balance, got %d", loanFailed.OutstandingBalancePaise)
		}

		// Test full settlement closing at zero
		smallLoan, err := contract.IssueLoan(
			ctx,
			"LN-SMALL-002",
			"did:drunix:worker:ravi-01",
			"lender-kotak-micro",
			5000, // ₹50 principal
			0,
			500,
			0,
			"mnd_small",
		)
		if err != nil {
			t.Fatalf("failed creating small loan: %v", err)
		}

		insSmall, _ := contract.RecordDebitInstruction(
			ctx,
			"ins_small_01",
			smallLoan.LoanId,
			"did:drunix:worker:ravi-01",
			5000,
			"IDEMP_SMALL",
		)

		settledLoan, err := contract.UpdateLoanBalance(
			ctx,
			smallLoan.LoanId,
			insSmall.InstructionId,
			"SUCCESS",
			5000,
			"UPI/20261024/SMALL123",
		)
		if err != nil {
			t.Fatalf("failed settling loan: %v", err)
		}
		if settledLoan.OutstandingBalancePaise != 0 || settledLoan.Status != "PAID" {
			t.Fatalf("expected loan to close at zero with status PAID, got balance=%d status=%s", settledLoan.OutstandingBalancePaise, settledLoan.Status)
		}
	})

	// 8. Verify Caller Identity & MSP Authorization Rules
	t.Run("Verify Caller Identity & MSP Authorization", func(t *testing.T) {
		// Unauthorized MSP attempting to log earnings should be rejected
		unauthorizedCtx := NewMockContextWithMSP("HackerMSP")
		_, err := contract.LogDailyEarnings(unauthorizedCtx, "did:drunix:worker:ravi-01", "zomato-in", "2026-10-23", 50000, "REF-HACK")
		if err == nil || !strings.Contains(err.Error(), "access denied") {
			t.Fatalf("expected access denied for HackerMSP, got: %v", err)
		}

		// Authorized PlatformMSP should be permitted
		platformCtx := NewMockContextWithMSP("PlatformMSP")
		platformCtx.stub.state = ctx.stub.state // share world state
		ernId, err := contract.LogDailyEarnings(platformCtx, "did:drunix:worker:ravi-01", "zomato-in", "2026-10-23", 50000, "REF-PLATFORM-OK")
		if err != nil || ernId == "" {
			t.Fatalf("expected PlatformMSP to succeed, got: %v", err)
		}

		// Unauthorized MSP attempting to issue a loan should be rejected
		_, err = contract.IssueLoan(unauthorizedCtx, "LN-AUTH-TEST", "did:drunix:worker:ravi-01", "lender-fake", 50000, 1000, 500, 0, "mnd_fake")
		if err == nil || !strings.Contains(err.Error(), "access denied") {
			t.Fatalf("expected access denied for unauthorized loan issuer, got: %v", err)
		}

		// Authorized LenderMSP should succeed
		lenderCtx := NewMockContextWithMSP("LenderMSP")
		lenderCtx.stub.state = ctx.stub.state
		authLoan, err := contract.IssueLoan(lenderCtx, "LN-AUTH-TEST", "did:drunix:worker:ravi-01", "lender-kotak-micro", 50000, 1000, 500, 0, "mnd_auth")
		if err != nil || authLoan.Status != "ACTIVE" {
			t.Fatalf("expected LenderMSP to succeed issuing loan, got: %v", err)
		}
	})
}
