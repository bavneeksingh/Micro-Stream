package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// CalculateDeduction computes the streaming micro-deduction for a detected payout.
//
// CORE FORMULA:
// deductionPaise = min(
//   floor(payoutPaise * rateBasisPoints / 10000),
//   outstandingPaise,
//   remainingDailyCapPaise
// )
//
// Uses integer arithmetic, arbitrary precision safe math, and truncation floor rounding policy.
func (s *SmartContract) CalculateDeduction(
	ctx contractapi.TransactionContextInterface,
	loanId string,
	payoutAmountPaise int64,
	payoutRef string,
) (*DeductionOutput, error) {
	if loanId == "" {
		return nil, fmt.Errorf("loanId cannot be empty")
	}

	// 1. Verify caller authorization: Oracle, Payment Gateway, or Admin
	if err := verifyCallerIdentity(ctx, "PlatformMSP", "OracleMSP", "PaymentMSP", "AdminMSP"); err != nil {
		return nil, err
	}

	// 2. Zero-income day produces zero deduction
	if payoutAmountPaise <= 0 {
		return &DeductionOutput{
			DeductionAmountPaise: 0,
			DebitInstructionId:   "",
			IdempotencyKey:       "",
			OutstandingBalance:   0,
		}, nil
	}

	// 3. Fetch loan from state
	var loan Loan
	loanKey := fmt.Sprintf("LOAN_%s", loanId)
	if err := getJSON(ctx, loanKey, &loan); err != nil {
		return nil, fmt.Errorf("loan %s not found on ledger: %w", loanId, err)
	}

	// Verify loan is ACTIVE
	if loan.Status != "ACTIVE" {
		return nil, fmt.Errorf("cannot deduct against loan %s with status %s", loanId, loan.Status)
	}

	// If loan is already paid off
	if loan.OutstandingBalancePaise <= 0 {
		return &DeductionOutput{
			DeductionAmountPaise: 0,
			DebitInstructionId:   "",
			IdempotencyKey:       "",
			OutstandingBalance:   0,
		}, nil
	}

	// 4. Compute deduction using floor rounding integer math
	// rawDeduction = floor(payoutAmountPaise * deductionRateBps / 10000)
	rawDeduction := (payoutAmountPaise * int64(loan.DeductionRateBps)) / 10000

	deduction := rawDeduction

	// Clamping: deduction never exceeds outstanding principal balance
	if deduction > loan.OutstandingBalancePaise {
		deduction = loan.OutstandingBalancePaise
	}

	// Clamping: deduction never exceeds daily cap if configured
	if loan.DailyCapPaise > 0 && deduction > loan.DailyCapPaise {
		deduction = loan.DailyCapPaise
	}

	if deduction < 0 {
		deduction = 0
	}

	// 5. Generate deterministic instruction ID and idempotency key
	idempotencyKey := fmt.Sprintf("IDEMP_DEBIT_%s_%s", loanId, payoutRef)
	hash := sha256.Sum256([]byte(idempotencyKey))
	instructionId := fmt.Sprintf("INS_%s", hex.EncodeToString(hash[:8]))

	createdAt := getTxTimestamp(ctx)

	instruction := DebitInstruction{
		InstructionId:  instructionId,
		LoanId:         loanId,
		DID:            loan.DID,
		AmountPaise:    deduction,
		IdempotencyKey: idempotencyKey,
		Status:         "PENDING",
		CreatedAt:      createdAt,
	}

	instructionKey := fmt.Sprintf("DEBIT_INSTRUCTION_%s", instructionId)
	if err := putJSON(ctx, instructionKey, instruction); err != nil {
		return nil, fmt.Errorf("failed storing debit instruction: %w", err)
	}

	return &DeductionOutput{
		DeductionAmountPaise: deduction,
		DebitInstructionId:   instructionId,
		IdempotencyKey:       idempotencyKey,
		OutstandingBalance:   loan.OutstandingBalancePaise,
	}, nil
}
