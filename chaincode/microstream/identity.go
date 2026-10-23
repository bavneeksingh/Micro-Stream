package main

import (
	"fmt"
	"strings"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// RegisterWorkerDID registers a worker's decentralized identity on Drunix / Fabric.
// Strictly avoids storing PII (no phone, no bank account, no physical address).
func (s *SmartContract) RegisterWorkerDID(
	ctx contractapi.TransactionContextInterface,
	did string,
	handle string,
	platformId string,
	publicKey string,
) (*WorkerDID, error) {
	if did == "" || publicKey == "" {
		return nil, fmt.Errorf("did and publicKey must not be empty")
	}

	// Verify caller authorization: Worker or Admin
	if err := verifyCallerIdentity(ctx, "WorkerMSP", "AdminMSP", "DrunixAdminMSP", "PlatformMSP"); err != nil {
		return nil, err
	}

	didKey := fmt.Sprintf("DID_%s", did)
	existing, err := ctx.GetStub().GetState(didKey)
	if err != nil {
		return nil, fmt.Errorf("error reading state for DID %s: %w", did, err)
	}
	if existing != nil {
		return nil, fmt.Errorf("worker DID %s already registered", did)
	}

	createdAt := getTxTimestamp(ctx)

	worker := WorkerDID{
		DID:        did,
		Handle:     handle,
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

// GrantConsent records consent granting data sharing or debit authorization to a grantee
func (s *SmartContract) GrantConsent(
	ctx contractapi.TransactionContextInterface,
	consentId string,
	did string,
	grantee string,
	scopeCommaSeparated string,
	purpose string,
	expiresAt string,
) (*Consent, error) {
	if consentId == "" || did == "" || grantee == "" {
		return nil, fmt.Errorf("consentId, did, and grantee cannot be empty")
	}

	// Verify worker DID exists
	didKey := fmt.Sprintf("DID_%s", did)
	existingWorker, err := ctx.GetStub().GetState(didKey)
	if err != nil {
		return nil, fmt.Errorf("error checking worker DID: %w", err)
	}
	if existingWorker == nil {
		return nil, fmt.Errorf("worker DID %s not registered on ledger", did)
	}

	// Verify caller identity
	if err := verifyCallerIdentity(ctx, "WorkerMSP", "AdminMSP", "DrunixAdminMSP"); err != nil {
		return nil, err
	}

	grantedAt := getTxTimestamp(ctx)

	scopes := strings.Split(scopeCommaSeparated, ",")
	cleanScopes := make([]string, 0, len(scopes))
	for _, sc := range scopes {
		trimmed := strings.TrimSpace(sc)
		if trimmed != "" {
			cleanScopes = append(cleanScopes, trimmed)
		}
	}

	consent := Consent{
		ID:        consentId,
		DID:       did,
		Grantee:   grantee,
		Scope:     cleanScopes,
		Purpose:   purpose,
		Status:    "ACTIVE",
		GrantedAt: grantedAt,
		ExpiresAt: expiresAt,
	}

	consentKey := fmt.Sprintf("CONSENT_%s", consentId)
	if err := putJSON(ctx, consentKey, consent); err != nil {
		return nil, err
	}

	// Maintain secondary index for did + grantee active lookup
	indexKey := fmt.Sprintf("CONSENT_IDX_%s_%s", did, grantee)
	if err := ctx.GetStub().PutState(indexKey, []byte(consentId)); err != nil {
		return nil, fmt.Errorf("failed saving consent index: %w", err)
	}

	return &consent, nil
}

// RevokeConsent revokes a previously granted consent record
func (s *SmartContract) RevokeConsent(
	ctx contractapi.TransactionContextInterface,
	consentId string,
	did string,
) (*Consent, error) {
	if consentId == "" || did == "" {
		return nil, fmt.Errorf("consentId and did must not be empty")
	}

	// Verify caller identity
	if err := verifyCallerIdentity(ctx, "WorkerMSP", "AdminMSP", "DrunixAdminMSP"); err != nil {
		return nil, err
	}

	consentKey := fmt.Sprintf("CONSENT_%s", consentId)
	var consent Consent
	if err := getJSON(ctx, consentKey, &consent); err != nil {
		return nil, fmt.Errorf("consent %s not found: %w", consentId, err)
	}

	if consent.DID != did {
		return nil, fmt.Errorf("consent %s does not belong to worker %s", consentId, did)
	}

	if consent.Status == "REVOKED" {
		return &consent, nil // Already revoked, idempotent acknowledgment
	}

	consent.Status = "REVOKED"
	consent.RevokedAt = getTxTimestamp(ctx)

	if err := putJSON(ctx, consentKey, consent); err != nil {
		return nil, fmt.Errorf("failed updating consent state: %w", err)
	}

	// Clear secondary index
	indexKey := fmt.Sprintf("CONSENT_IDX_%s_%s", did, consent.Grantee)
	_ = ctx.GetStub().DelState(indexKey)

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

// GetConsent retrieves consent record by ID
func (s *SmartContract) GetConsent(ctx contractapi.TransactionContextInterface, consentId string) (*Consent, error) {
	var consent Consent
	consentKey := fmt.Sprintf("CONSENT_%s", consentId)
	if err := getJSON(ctx, consentKey, &consent); err != nil {
		return nil, err
	}
	return &consent, nil
}
