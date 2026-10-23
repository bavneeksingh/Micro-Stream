package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// LogDailyEarnings records a worker's daily earnings submitted by an authorized gig platform
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
	if grossEarningsPaise < 0 {
		return "", fmt.Errorf("grossEarningsPaise must be non-negative, got %d", grossEarningsPaise)
	}

	// Composite key to enforce idempotency / uniqueness per did + date + reference
	idempotencyKey := fmt.Sprintf("EARNINGS_REF_%s_%s_%s", did, date, reference)
	existing, err := ctx.GetStub().GetState(idempotencyKey)
	if err != nil {
		return "", fmt.Errorf("failed checking duplicate earnings: %w", err)
	}
	if existing != nil {
		return string(existing), nil // Already processed, return recorded ID
	}

	// Generate deterministic earnings ID
	hash := sha256.Sum256([]byte(idempotencyKey))
	earningsId := fmt.Sprintf("ERN_%s", hex.EncodeToString(hash[:8]))

	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	recordedAt := time.Now().UTC().Format(time.RFC3339)
	if err == nil && txTimestamp != nil {
		recordedAt = time.Unix(txTimestamp.Seconds, int64(txTimestamp.Nanos)).UTC().Format(time.RFC3339)
	}

	record := EarningsRecord{
		ID:                 earningsId,
		DID:                did,
		PlatformID:         platformId,
		Date:               date,
		GrossEarningsPaise: grossEarningsPaise,
		NetEarningsPaise:   grossEarningsPaise, // Can be adjusted if platform fees known
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

	return earningsId, nil
}
