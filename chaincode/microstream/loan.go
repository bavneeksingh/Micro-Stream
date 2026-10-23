package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// IssueLoan creates a new micro-loan on the ledger linked to a worker DID.
// Enforces caller authorization, worker existence, and strict financial bounds.
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
		return nil, fmt.Errorf("principalPaise must be greater than zero, got %d", principalPaise)
	}
	if deductionRateBps <= 0 || deductionRateBps > 10000 {
		return nil, fmt.Errorf("deductionRateBps must be between 1 and 10000 (0.01%% to 100.00%%), got %d", deductionRateBps)
	}
	if dailyCapPaise < 0 {
		return nil, fmt.Errorf("dailyCapPaise cannot be negative, got %d", dailyCapPaise)
	}

	// 1. Verify caller authorization: Lender or Admin
	if err := verifyCallerIdentity(ctx, "LenderMSP", "AdminMSP", "DrunixAdminMSP", "BankMSP"); err != nil {
		return nil, err
	}

	// 2. Verify worker DID exists
	didKey := fmt.Sprintf("DID_%s", did)
	workerBytes, err := ctx.GetStub().GetState(didKey)
	if err != nil {
		return nil, fmt.Errorf("error verifying borrower DID: %w", err)
	}
	if workerBytes == nil {
		return nil, fmt.Errorf("borrower DID %s not registered on ledger", did)
	}

	// 3. Reject duplicate loan ID
	loanKey := fmt.Sprintf("LOAN_%s", loanId)
	existing, err := ctx.GetStub().GetState(loanKey)
	if err != nil {
		return nil, fmt.Errorf("failed checking loan existence: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("loan with ID %s already exists on ledger", loanId)
	}

	issuedAt := getTxTimestamp(ctx)

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

// GetLoan retrieves a loan by ID from world state
func (s *SmartContract) GetLoan(ctx contractapi.TransactionContextInterface, loanId string) (*Loan, error) {
	if loanId == "" {
		return nil, fmt.Errorf("loanId cannot be empty")
	}

	var loan Loan
	loanKey := fmt.Sprintf("LOAN_%s", loanId)
	if err := getJSON(ctx, loanKey, &loan); err != nil {
		return nil, err
	}
	return &loan, nil
}

// RecordDebitInstruction records a debit instruction on the immutable ledger.
// Enforces caller authorization, active loan status, and strict rejection of duplicate instruction IDs.
func (s *SmartContract) RecordDebitInstruction(
	ctx contractapi.TransactionContextInterface,
	instructionId string,
	loanId string,
	did string,
	amountPaise int64,
	idempotencyKey string,
) (*DebitInstruction, error) {
	if instructionId == "" || loanId == "" || did == "" {
		return nil, fmt.Errorf("instructionId, loanId, and did cannot be empty")
	}
	if amountPaise <= 0 {
		return nil, fmt.Errorf("amountPaise must be positive, got %d", amountPaise)
	}

	// 1. Verify caller authorization: Payment Gateway, Engine, or Admin
	if err := verifyCallerIdentity(ctx, "PaymentMSP", "GatewayMSP", "OracleMSP", "AdminMSP"); err != nil {
		return nil, err
	}

	// 2. Reject duplicate instruction ID
	insKey := fmt.Sprintf("DEBIT_INSTRUCTION_%s", instructionId)
	existing, err := ctx.GetStub().GetState(insKey)
	if err != nil {
		return nil, fmt.Errorf("failed checking instruction existence: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("duplicate instruction rejected: debit instruction with ID %s already exists", instructionId)
	}

	// 3. Verify loan exists and is ACTIVE
	loanKey := fmt.Sprintf("LOAN_%s", loanId)
	var loan Loan
	if err := getJSON(ctx, loanKey, &loan); err != nil {
		return nil, fmt.Errorf("target loan %s not found: %w", loanId, err)
	}
	if loan.Status != "ACTIVE" {
		return nil, fmt.Errorf("cannot create debit instruction for loan with status %s", loan.Status)
	}

	createdAt := getTxTimestamp(ctx)

	instruction := DebitInstruction{
		InstructionId:  instructionId,
		LoanId:         loanId,
		DID:            did,
		AmountPaise:    amountPaise,
		IdempotencyKey: idempotencyKey,
		Status:         "PENDING",
		CreatedAt:      createdAt,
	}

	if err := putJSON(ctx, insKey, instruction); err != nil {
		return nil, fmt.Errorf("failed saving debit instruction: %w", err)
	}

	return &instruction, nil
}

// UpdateLoanBalance applies the confirmed outcome of a UPI AutoPay payment callback.
// Enforces caller authorization, strict balance integrity, and prevents duplicate repayments on retry callbacks.
func (s *SmartContract) UpdateLoanBalance(
	ctx contractapi.TransactionContextInterface,
	loanId string,
	debitInstructionId string,
	status string, // SUCCESS / SUCCEEDED or FAILED
	amountDebitedPaise int64,
	upiRef string,
) (*Loan, error) {
	if loanId == "" || debitInstructionId == "" {
		return nil, fmt.Errorf("loanId and debitInstructionId must not be empty")
	}

	// 1. Verify caller authorization
	if err := verifyCallerIdentity(ctx, "PaymentMSP", "GatewayMSP", "OracleMSP", "AdminMSP"); err != nil {
		return nil, err
	}

	// 2. Fetch target loan
	var loan Loan
	loanKey := fmt.Sprintf("LOAN_%s", loanId)
	if err := getJSON(ctx, loanKey, &loan); err != nil {
		return nil, fmt.Errorf("loan %s not found: %w", loanId, err)
	}

	// 3. Fetch debit instruction
	var instruction DebitInstruction
	insKey := fmt.Sprintf("DEBIT_INSTRUCTION_%s", debitInstructionId)
	if err := getJSON(ctx, insKey, &instruction); err != nil {
		return nil, fmt.Errorf("debit instruction %s not found: %w", debitInstructionId, err)
	}

	// 4. CRITICAL RULE: Prevent duplicate payment callbacks from recording a repayment twice
	if instruction.Status == "SUCCESS" || instruction.Status == "SUCCEEDED" {
		return nil, fmt.Errorf("duplicate callback rejected: debit instruction %s has already been settled and credited", debitInstructionId)
	}

	settledAt := getTxTimestamp(ctx)

	if status == "SUCCESS" || status == "SUCCEEDED" {
		if amountDebitedPaise <= 0 {
			return nil, fmt.Errorf("successful payment must have positive amountDebitedPaise, got %d", amountDebitedPaise)
		}

		// Ensure deductions never exceed remaining balance
		actualDeduction := amountDebitedPaise
		if actualDeduction > loan.OutstandingBalancePaise {
			actualDeduction = loan.OutstandingBalancePaise
		}

		// Atomically reduce balance and increment total repaid
		loan.OutstandingBalancePaise -= actualDeduction
		loan.TotalRepaidPaise += actualDeduction

		// Close loan if fully repaid
		if loan.OutstandingBalancePaise == 0 {
			loan.Status = "PAID"
			loan.SettledAt = settledAt
		}

		instruction.Status = "SUCCEEDED"
		instruction.ExecutedAt = settledAt
		instruction.UPIRef = upiRef

		// Persist immutable repayment record
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
		// Payment failed: strictly retain outstanding balance unchanged
		instruction.Status = "FAILED"
		instruction.ExecutedAt = settledAt
		instruction.FailureReason = "Payment execution rejected or timed out by banking provider"
	}

	// Save updated debit instruction
	if err := putJSON(ctx, insKey, instruction); err != nil {
		return nil, fmt.Errorf("failed updating instruction: %w", err)
	}

	// Save updated loan
	if err := putJSON(ctx, loanKey, loan); err != nil {
		return nil, fmt.Errorf("failed updating loan: %w", err)
	}

	return &loan, nil
}
