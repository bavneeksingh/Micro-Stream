package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// IssueLoan creates a new micro-loan on the ledger linked to a worker DID
func (s *SmartContract) IssueLoan(
	ctx contractapi.TransactionContextInterface,
	loanId string,
	did string,
	lenderId string,
	principalPaise int64,
	interestRateBps int32,
	deductionRateBps int32,
	dailyCapPaise int64,
	mandateId string,
) (*Loan, error) {
	if loanId == "" || did == "" || lenderId == "" {
		return nil, fmt.Errorf("loanId, did, and lenderId must not be empty")
	}
	if principalPaise <= 0 {
		return nil, fmt.Errorf("principalPaise must be greater than zero")
	}
	if deductionRateBps <= 0 || deductionRateBps > 5000 {
		return nil, fmt.Errorf("deductionRateBps must be between 1 and 5000 (0.01%% to 50.00%%)")
	}

	loanKey := fmt.Sprintf("LOAN_%s", loanId)
	existing, err := ctx.GetStub().GetState(loanKey)
	if err != nil {
		return nil, fmt.Errorf("failed checking loan existence: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("loan with ID %s already exists", loanId)
	}

	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	issuedAt := time.Now().UTC().Format(time.RFC3339)
	if err == nil && txTimestamp != nil {
		issuedAt = time.Unix(txTimestamp.Seconds, int64(txTimestamp.Nanos)).UTC().Format(time.RFC3339)
	}

	loan := Loan{
		LoanId:                  loanId,
		DID:                     did,
		LenderId:                lenderId,
		PrincipalPaise:          principalPaise,
		OutstandingBalancePaise: principalPaise,
		InterestRateBps:         interestRateBps,
		DeductionRateBps:        deductionRateBps,
		DailyCapPaise:           dailyCapPaise,
		TotalRepaidPaise:        0,
		MandateID:               mandateId,
		Status:                  "ACTIVE",
		IssuedAt:                issuedAt,
	}

	if err := putJSON(ctx, loanKey, loan); err != nil {
		return nil, fmt.Errorf("failed creating loan: %w", err)
	}

	return &loan, nil
}

// UpdateLoanBalance applies the outcome of a UPI AutoPay debit callback to the loan state
func (s *SmartContract) UpdateLoanBalance(
	ctx contractapi.TransactionContextInterface,
	loanId string,
	debitInstructionId string,
	status string, // SUCCESS or FAILED
	amountDebitedPaise int64,
	upiRef string,
) (*Loan, error) {
	var loan Loan
	loanKey := fmt.Sprintf("LOAN_%s", loanId)
	if err := getJSON(ctx, loanKey, &loan); err != nil {
		return nil, fmt.Errorf("loan %s not found: %w", loanId, err)
	}

	var instruction DebitInstruction
	insKey := fmt.Sprintf("DEBIT_INSTRUCTION_%s", debitInstructionId)
	if err := getJSON(ctx, insKey, &instruction); err != nil {
		return nil, fmt.Errorf("debit instruction %s not found: %w", debitInstructionId, err)
	}

	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	settledAt := time.Now().UTC().Format(time.RFC3339)
	if err == nil && txTimestamp != nil {
		settledAt = time.Unix(txTimestamp.Seconds, int64(txTimestamp.Nanos)).UTC().Format(time.RFC3339)
	}

	if status == "SUCCESS" {
		if amountDebitedPaise <= 0 {
			return nil, fmt.Errorf("successful debit must have amountDebitedPaise > 0")
		}

		// Ensure we don't reduce below zero
		actualDeduction := amountDebitedPaise
		if actualDeduction > loan.OutstandingBalancePaise {
			actualDeduction = loan.OutstandingBalancePaise
		}

		loan.OutstandingBalancePaise -= actualDeduction
		loan.TotalRepaidPaise += actualDeduction

		if loan.OutstandingBalancePaise == 0 {
			loan.Status = "SETTLED"
			loan.SettledAt = settledAt
		}

		instruction.Status = "SUCCESS"

		// Record repayment event
		hash := sha256.Sum256([]byte(fmt.Sprintf("REP_%s_%s", loanId, debitInstructionId)))
		repId := fmt.Sprintf("REP_%s", hex.EncodeToString(hash[:8]))
		repayment := RepaymentRecord{
			ID:                    repId,
			LoanId:                loanId,
			DebitInstructionId:    debitInstructionId,
			AmountPaise:           actualDeduction,
			SettledAt:             settledAt,
			UPIRef:                upiRef,
			RemainingBalancePaise: loan.OutstandingBalancePaise,
		}

		repKey := fmt.Sprintf("REPAYMENT_%s", repId)
		if err := putJSON(ctx, repKey, repayment); err != nil {
			return nil, fmt.Errorf("failed saving repayment record: %w", err)
		}
	} else {
		instruction.Status = "FAILED"
	}

	// Save updated instruction
	if err := putJSON(ctx, insKey, instruction); err != nil {
		return nil, fmt.Errorf("failed updating instruction: %w", err)
	}

	// Save updated loan
	if err := putJSON(ctx, loanKey, loan); err != nil {
		return nil, fmt.Errorf("failed updating loan: %w", err)
	}

	return &loan, nil
}

// GetLoan retrieves loan by ID
func (s *SmartContract) GetLoan(ctx contractapi.TransactionContextInterface, loanId string) (*Loan, error) {
	var loan Loan
	loanKey := fmt.Sprintf("LOAN_%s", loanId)
	if err := getJSON(ctx, loanKey, &loan); err != nil {
		return nil, err
	}
	return &loan, nil
}
