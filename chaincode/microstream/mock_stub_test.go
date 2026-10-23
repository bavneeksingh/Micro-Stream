package main

import (
	"crypto/x509"

	"github.com/golang/protobuf/ptypes/timestamp"
	"github.com/hyperledger/fabric-chaincode-go/pkg/cid"
	"github.com/hyperledger/fabric-chaincode-go/shim"
)

// MockStub implements a minimal in-memory shim.ChaincodeStubInterface for testing
type MockStub struct {
	shim.ChaincodeStubInterface
	state       map[string][]byte
	txTimestamp *timestamp.Timestamp
}

func NewMockStub() *MockStub {
	return &MockStub{
		state: make(map[string][]byte),
		txTimestamp: &timestamp.Timestamp{
			Seconds: 1792788000, // Fixed deterministic timestamp for unit testing
			Nanos:   0,
		},
	}
}

func (m *MockStub) GetState(key string) ([]byte, error) {
	val, exists := m.state[key]
	if !exists {
		return nil, nil
	}
	return val, nil
}

func (m *MockStub) PutState(key string, value []byte) error {
	m.state[key] = value
	return nil
}

func (m *MockStub) DelState(key string) error {
	delete(m.state, key)
	return nil
}

func (m *MockStub) GetTxTimestamp() (*timestamp.Timestamp, error) {
	return m.txTimestamp, nil
}

// MockClientIdentity implements cid.ClientIdentity for testing role/MSP authorization
type MockClientIdentity struct {
	mspID string
	id    string
}

func (m *MockClientIdentity) GetID() (string, error)                               { return m.id, nil }
func (m *MockClientIdentity) GetMSPID() (string, error)                            { return m.mspID, nil }
func (m *MockClientIdentity) GetAttributeValue(attrName string) (string, bool, error) { return "", false, nil }
func (m *MockClientIdentity) AssertAttributeValue(attrName, attrValue string) error   { return nil }
func (m *MockClientIdentity) GetX509Certificate() (*x509.Certificate, error)      { return nil, nil }

// MockTransactionContext implements contractapi.TransactionContextInterface for unit tests
type MockTransactionContext struct {
	stub     *MockStub
	identity cid.ClientIdentity
}

func NewMockContext() *MockTransactionContext {
	return &MockTransactionContext{
		stub:     NewMockStub(),
		identity: nil,
	}
}

func NewMockContextWithMSP(mspID string) *MockTransactionContext {
	return &MockTransactionContext{
		stub: NewMockStub(),
		identity: &MockClientIdentity{
			mspID: mspID,
			id:    "x509::CN=tester,OU=client::CN=ca",
		},
	}
}

func (c *MockTransactionContext) GetStub() shim.ChaincodeStubInterface {
	return c.stub
}

func (c *MockTransactionContext) GetClientIdentity() cid.ClientIdentity {
	return c.identity
}
