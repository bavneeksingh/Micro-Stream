package main

// WorkerDID represents decentralized identity on Drunix / Fabric ledger
type WorkerDID struct {
	DID            string `json:"did"`
	Name           string `json:"name"`
	PlatformID     string `json:"platformId"`
	PublicKey      string `json:"publicKey"`
	Status         string `json:"status"` // ACTIVE, SUSPENDED
	CreatedAt      string `json:"createdAt"`
}

// Consent represents worker data sharing and debit authorization
type Consent struct {
	ID        string   `json:"id"`
	DID       string   `json:"did"`
	Grantee   string   `json:"grantee"`
	Scope     []string `json:"scope"`
	Status    string   `json:"status"` // ACTIVE, REVOKED, EXPIRED
	GrantedAt string   `json:"grantedAt"`
	ExpiresAt string   `json:"expiresAt"`
}

// EarningsRecord represents immutable daily earnings logged by gig platform
type EarningsRecord struct {
	ID                 string `json:"id"`
	DID                string `json:"did"`
	PlatformID         string `json:"platformId"`
	Date               string `json:"date"`
	GrossEarningsPaise int64  `json:"grossEarningsPaise"` // Integer paise
	NetEarningsPaise   int64  `json:"netEarningsPaise"`   // Integer paise
	Reference          string `json:"reference"`
	RecordedAt         string `json:"recordedAt"`
}

// Loan represents a micro-credit contract
type Loan struct {
	LoanId                  string `json:"loanId"`
	DID                     string `json:"did"`
	LenderId                string `json:"lenderId"`
	PrincipalPaise          int64  `json:"principalPaise"`          // Integer paise
	OutstandingBalancePaise int64  `json:"outstandingBalancePaise"` // Integer paise
	InterestRateBps         int32  `json:"interestRateBps"`         // Basis points (1200 = 12%)
	DeductionRateBps        int32  `json:"deductionRateBps"`        // Basis points (500 = 5%)
	DailyCapPaise           int64  `json:"dailyCapPaise"`           // 0 = no cap
	TotalRepaidPaise        int64  `json:"totalRepaidPaise"`
	MandateID               string `json:"mandateId"`
	Status                  string `json:"status"` // ACTIVE, SETTLED, DEFAULTED
	IssuedAt                string `json:"issuedAt"`
	SettledAt               string `json:"settledAt,omitempty"`
}

// DebitInstruction represents deduction computed by chaincode for UPI AutoPay execution
type DebitInstruction struct {
	InstructionId  string `json:"instructionId"`
	LoanId         string `json:"loanId"`
	DID            string `json:"did"`
	AmountPaise    int64  `json:"amountPaise"`
	IdempotencyKey string `json:"idempotencyKey"`
	Status         string `json:"status"` // PENDING, SUCCESS, FAILED
	CreatedAt      string `json:"createdAt"`
}

// RepaymentRecord logs successful balance reduction
type RepaymentRecord struct {
	ID                     string `json:"id"`
	LoanId                 string `json:"loanId"`
	DebitInstructionId     string `json:"debitInstructionId"`
	AmountPaise            int64  `json:"amountPaise"`
	SettledAt              string `json:"settledAt"`
	UPIRef                 string `json:"upiRef"`
	RemainingBalancePaise  int64  `json:"remainingBalancePaise"`
}

// DeductionOutput is the return value of CalculateDeduction
type DeductionOutput struct {
	DeductionAmountPaise int64  `json:"deductionAmountPaise"`
	DebitInstructionId   string `json:"debitInstructionId"`
	IdempotencyKey       string `json:"idempotencyKey"`
	OutstandingBalance   int64  `json:"outstandingBalance"`
}
