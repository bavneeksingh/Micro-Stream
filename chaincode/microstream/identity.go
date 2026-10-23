package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// RegisterWorkerDID registers a worker's decentralized identity
func (s *SmartContract) RegisterWorkerDID(
	ctx contractapi.TransactionContextInterface,
	did string,
	name string,
	platformId string,
	publicKey string,
) (*WorkerDID, error) {
	if did == "" || name == "" || publicKey == "" {
		return nil, fmt.Errorf("did, name, and publicKey must not be empty")
	}

	didKey := fmt.Sprintf("DID_%s", did)
	existing, err := ctx.GetStub().GetState(didKey)
	if err != nil {
		return nil, fmt.Errorf("error reading state: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("worker DID %s already registered", did)
	}

	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	createdAt := time.Now().UTC().Format(time.RFC3339)
	if err == nil && txTimestamp != nil {
		createdAt = time.Unix(txTimestamp.Seconds, int64(txTimestamp.Nanos)).UTC().Format(time.RFC3339)
	}

	worker := WorkerDID{
		DID:        did,
		Name:       name,
		PlatformID: platformId,
		PublicKey:  publicKey,
		Status:     "ACTIVE",
		CreatedAt:  createdAt,
	}

	if err := putJSON(ctx, didKey, worker); err != nil {
		return nil, err
	}

	return &worker, nil
}

// GrantConsent records consent granting data access to a grantee
func (s *SmartContract) GrantConsent(
	ctx contractapi.TransactionContextInterface,
	consentId string,
	did string,
	grantee string,
	scopeCommaSeparated string,
	expiresAt string,
) (*Consent, error) {
	if consentId == "" || did == "" || grantee == "" {
		return nil, fmt.Errorf("consentId, did, and grantee cannot be empty")
	}

	txTimestamp, err := ctx.GetStub().GetTxTimestamp()
	grantedAt := time.Now().UTC().Format(time.RFC3339)
	if err == nil && txTimestamp != nil {
		grantedAt = time.Unix(txTimestamp.Seconds, int64(txTimestamp.Nanos)).UTC().Format(time.RFC3339)
	}

	scopes := strings.Split(scopeCommaSeparated, ",")
	for i, sc := range scopes {
		scopes[i] = strings.TrimSpace(sc)
	}

	consent := Consent{
		ID:        consentId,
		DID:       did,
		Grantee:   grantee,
		Scope:     scopes,
		Status:    "ACTIVE",
		GrantedAt: grantedAt,
		ExpiresAt: expiresAt,
	}

	consentKey := fmt.Sprintf("CONSENT_%s", consentId)
	if err := putJSON(ctx, consentKey, consent); err != nil {
		return nil, err
	}

	return &consent, nil
}

// GetWorkerDID retrieves worker DID record
func (s *SmartContract) GetWorkerDID(ctx contractapi.TransactionContextInterface, did string) (*WorkerDID, error) {
	var worker WorkerDID
	didKey := fmt.Sprintf("DID_%s", did)
	if err := getJSON(ctx, didKey, &worker); err != nil {
		return nil, err
	}
	return &worker, nil
}
