package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// CalculateDeduction computes the streaming micro-deduction for a detected payout.
// Formula: deduction = min( payoutAmount * deductionRate, outstandingBalance, dailyCap )
// All math performed on integer paise.
func (s *SmartContract) CalculateDeduction(
	ctx contractapi.TransactionContextInterface,
	loanId string,
	payoutAmountPaise int64,
	payoutRef string,
) (*DeductionOutput, error) {
	if loanId == "" {
		return nil, fmt.Errorf("loanId cannot be empty")
	}
	if payoutAmountPaise <= 0 {
		return &DeductionOutput{
			DeductionAmountPaise: 0,
			DebitInstructionId:   "",
			IdempotencyKey:       "",
			OutstandingBalance:   0,
		}, nil
	}

	// 1. Fetch loan
	var loan Loan
	loanKey := fmt.Sprintf("LOAN_%s", loanId)
	if err := getJSON(ctx, loanKey, &loan); err != nil {
		return nil, fmt.Errorf("loan %s not found: %w", loanId, err)
	}

	if loan.Status != "ACTIVE" {
		return nil, fmt.Errorf("loan %s is not ACTIVE (status: %s)", loanId, loan.Status)
	}
	if loan.OutstandingBalancePaise <= 0 {
		return &DeductionOutput{
			DeductionAmountPaise: 0,
			DebitInstructionId:   "",
			IdempotencyKey:       "",
			OutstandingBalance:   0,
		}, nil
	}

	// 2. Compute raw deduction in integer paise
	// deductionRateBps is in basis points (e.g. 500 = 5.00%)
	// rawDeduction = (payoutAmountPaise * deductionRateBps) / 10000
	rawDeduction := (payoutAmountPaise * int64(loan.DeductionRateBps)) / 10000

	deduction := rawDeduction

	// 3. Guardrail: never exceed remaining balance
	if deduction > loan.OutstandingBalancePaise {
		deduction = loan.OutstandingBalancePaise
	}

	// 4. Guardrail: apply daily cap if configured
	if loan.DailyCapPaise > 0 && deduction > loan.DailyCapPaise {
		deduction = loan.DailyCapPaise
	}

	if deduction < 0 {
		deduction = 0
	}

	// 5. Generate idempotent debit instruction
	idempotencyKey := fmt.Sprintf("IDEMP_DEBIT_%s_%s", loanId, payoutRef)
	hash := sha256.Sum256([]byte(idempotencyKey))
	instructionId := fmt.Sprintf("INS_%s", hex.EncodeToString(hash[:8]))

	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	createdAt := time.Now().UTC().Format(time.RFC3339)
	if err == nil && txTimestamp != nil {
		createdAt = time.Unix(txTimestamp.Seconds, int64(txTimestamp.Nanos)).UTC().Format(time.RFC3339)
	}

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
