package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// LogDailyEarnings records a worker's daily earnings submitted by an authorized gig platform or oracle.
// Treats inputs as untrusted until verified against caller authorization, consent, and non-negative bounds.
func (s *SmartContract) LogDailyEarnings(
	ctx contractapi.TransactionContextInterface,
	did string,
	platformId string,
	date string,
	grossEarningsPaise int64,
	reference string,
) (string, error) {
	if did == "" {
		return "", fmt.Errorf("did cannot be empty")
	}
	if reference == "" {
		return "", fmt.Errorf("earnings reference cannot be empty")
	}
	if grossEarningsPaise < 0 {
		return "", fmt.Errorf("grossEarningsPaise must be non-negative, got %d", grossEarningsPaise)
	}

	// 1. Verify caller authorization: Gig Platform, Oracle, or Admin
	if err := verifyCallerIdentity(ctx, "PlatformMSP", "OracleMSP", "ZomatoMSP", "SwiggyMSP", "UberMSP", "AdminMSP"); err != nil {
		return "", err
	}

	// 2. Verify worker DID exists on ledger
	didKey := fmt.Sprintf("DID_%s", did)
	workerBytes, err := ctx.GetStub().GetState(didKey)
	if err != nil {
		return "", fmt.Errorf("failed checking worker DID: %w", err)
	}
	if workerBytes == nil {
		return "", fmt.Errorf("worker DID %s is not registered on the ledger", did)
	}

	// 3. Composite key to enforce idempotency / uniqueness per did + date + reference
	idempotencyKey := fmt.Sprintf("EARNINGS_REF_%s_%s_%s", did, date, reference)
	existing, err := ctx.GetStub().GetState(idempotencyKey)
	if err != nil {
		return "", fmt.Errorf("failed checking duplicate earnings: %w", err)
	}
	if existing != nil {
		return string(existing), nil // Safely acknowledge existing record without duplicate debit/log
	}

	// 4. Generate deterministic earnings ID
	hash := sha256.Sum256([]byte(idempotencyKey))
	earningsId := fmt.Sprintf("ERN_%s", hex.EncodeToString(hash[:8]))
	recordedAt := getTxTimestamp(ctx)

	record := EarningsRecord{
		ID:                 earningsId,
		DID:                did,
		PlatformID:         platformId,
		Date:               date,
		GrossEarningsPaise: grossEarningsPaise,
		NetEarningsPaise:   grossEarningsPaise,
		Reference:          reference,
		RecordedAt:         recordedAt,
	}

	// Persist earnings record
	recordKey := fmt.Sprintf("EARNINGS_%s", earningsId)
	if err := putJSON(ctx, recordKey, record); err != nil {
		return "", err
	}

	// Mark idempotency key with earningsId
	if err := ctx.GetStub().PutState(idempotencyKey, []byte(earningsId)); err != nil {
		return "", err
	}

	// Maintain worker earnings index for historical underwriting queries
	workerHistoryKey := fmt.Sprintf("WORKER_EARNINGS_%s", did)
	var history []string
	historyBytes, err := ctx.GetStub().GetState(workerHistoryKey)
	if err == nil && historyBytes != nil {
		_ = json.Unmarshal(historyBytes, &history)
	}
	history = append(history, earningsId)
	if updatedBytes, err := json.Marshal(history); err == nil {
		_ = ctx.GetStub().PutState(workerHistoryKey, updatedBytes)
	}

	return earningsId, nil
}

// GetEarningsSummary computes historical earnings metrics for a worker DID directly on-chain
func (s *SmartContract) GetEarningsSummary(
	ctx contractapi.TransactionContextInterface,
	did string,
	days int,
) (*WorkerEarningsSummary, error) {
	if did == "" {
		return nil, fmt.Errorf("did cannot be empty")
	}
	if days <= 0 {
		days = 30
	}

	// Verify caller authorization: Lender, Worker, or Admin
	if err := verifyCallerIdentity(ctx, "LenderMSP", "WorkerMSP", "AdminMSP", "DrunixAdminMSP"); err != nil {
		return nil, err
	}

	workerHistoryKey := fmt.Sprintf("WORKER_EARNINGS_%s", did)
	historyBytes, err := ctx.GetStub().GetState(workerHistoryKey)
	if err != nil {
		return nil, fmt.Errorf("failed reading worker earnings history: %w", err)
	}

	if historyBytes == nil {
		return &WorkerEarningsSummary{
			DID:                       did,
			TotalEarningsPaise:        0,
			AverageDailyEarningsPaise: 0,
			ActiveDaysCount:           0,
			DaysEvaluated:             days,
		}, nil
	}

	var earningsIDs []string
	if err := json.Unmarshal(historyBytes, &earningsIDs); err != nil {
		return nil, fmt.Errorf("corrupt earnings history index: %w", err)
	}

	var totalPaise int64
	activeDays := 0

	// Consider the most recent N records up to days
	startIdx := 0
	if len(earningsIDs) > days {
		startIdx = len(earningsIDs) - days
	}
	evaluatedIDs := earningsIDs[startIdx:]

	for _, eID := range evaluatedIDs {
		recordKey := fmt.Sprintf("EARNINGS_%s", eID)
		var record EarningsRecord
		if err := getJSON(ctx, recordKey, &record); err == nil {
			totalPaise += record.GrossEarningsPaise
			if record.GrossEarningsPaise > 0 {
				activeDays++
			}
		}
	}

	var avgPaise int64
	if len(evaluatedIDs) > 0 {
		avgPaise = totalPaise / int64(len(evaluatedIDs))
	}

	return &WorkerEarningsSummary{
		DID:                       did,
		TotalEarningsPaise:        totalPaise,
		AverageDailyEarningsPaise: avgPaise,
		ActiveDaysCount:           activeDays,
		DaysEvaluated:             days,
	}, nil
}
