package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing MicroStream credit streaming
type SmartContract struct {
	contractapi.Contract
}

func main() {
	cc, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("Error creating MicroStream chaincode: %v\n", err)
		return
	}

	if err := cc.Start(); err != nil {
		fmt.Printf("Error starting MicroStream chaincode: %v\n", err)
	}
}

// Helper to put state as JSON
func putJSON(ctx contractapi.TransactionContextInterface, key string, value interface{}) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON for key %s: %w", key, err)
	}
	return ctx.GetStub().PutState(key, payload)
}

// Helper to get state as JSON
func getJSON(ctx contractapi.TransactionContextInterface, key string, target interface{}) error {
	bytes, err := ctx.GetStub().GetState(key)
	if err != nil {
		return fmt.Errorf("failed to read from world state for key %s: %w", key, err)
	}
	if bytes == nil {
		return fmt.Errorf("entity with key %s does not exist", key)
	}
	return json.Unmarshal(bytes, target)
}
