package main

// WorkerDID represents decentralized identity on Drunix / Fabric ledger.
// Adheres to Privacy by Design: no raw personal data (names, phone numbers, addresses) stored on-chain.
type WorkerDID struct {
	DID        string `json:"did"`
	Handle     string `json:"handle"`     // Pseudonymous worker alias (e.g. "wrk_ravi_01")
	PlatformID string `json:"platformId"` // Primary platform identifier (e.g. "zomato-in")
	PublicKey  string `json:"publicKey"`  // Ed25519/ECDSA verification public key
	Status     string `json:"status"`     // ACTIVE, SUSPENDED
	CreatedAt  string `json:"createdAt"`
}

// Consent represents worker data sharing and debit authorization
type Consent struct {
	ID        string   `json:"id"`
	DID       string   `json:"did"`
	Grantee   string   `json:"grantee"`
	Scope     []string `json:"scope"`
	Purpose   string   `json:"purpose"`
	Status    string   `json:"status"` // ACTIVE, REVOKED, EXPIRED
	GrantedAt string   `json:"grantedAt"`
	ExpiresAt string   `json:"expiresAt"`
	RevokedAt string   `json:"revokedAt,omitempty"`
}

// EarningsRecord represents immutable daily earnings logged by gig platform
type EarningsRecord struct {
	ID                 string `json:"id"`
	DID                string `json:"did"`
	PlatformID         string `json:"platformId"`
	Date               string `json:"date"`
	GrossEarningsPaise int64  `json:"grossEarningsPaise"` // Integer paise (1 INR = 100 paise)
	NetEarningsPaise   int64  `json:"netEarningsPaise"`   // Integer paise
	Reference          string `json:"reference"`
	RecordedAt         string `json:"recordedAt"`
}

// WorkerEarningsSummary aggregates historical earnings for credit risk evaluation
type WorkerEarningsSummary struct {
	DID                      string `json:"did"`
	TotalEarningsPaise       int64  `json:"totalEarningsPaise"`
	AverageDailyEarningsPaise int64  `json:"averageDailyEarningsPaise"`
	ActiveDaysCount          int    `json:"activeDaysCount"`
	DaysEvaluated            int    `json:"daysEvaluated"`
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
	Status                  string `json:"status"` // ACTIVE, PAID, SETTLED, DEFAULTED
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
	Status         string `json:"status"` // PENDING, SUCCEEDED, SUCCESS, FAILED
	CreatedAt      string `json:"createdAt"`
	ExecutedAt     string `json:"executedAt,omitempty"`
	UPIRef         string `json:"upiRef,omitempty"`
	FailureReason  string `json:"failureReason,omitempty"`
}

// RepaymentRecord logs successful balance reduction
type RepaymentRecord struct {
	ID                    string `json:"id"`
	LoanId                string `json:"loanId"`
	DebitInstructionId    string `json:"debitInstructionId"`
	AmountPaise           int64  `json:"amountPaise"`
	SettledAt             string `json:"settledAt"`
	UPIRef                string `json:"upiRef"`
	RemainingBalancePaise int64  `json:"remainingBalancePaise"`
}

// DeductionOutput is the return value of CalculateDeduction
type DeductionOutput struct {
	DeductionAmountPaise int64  `json:"deductionAmountPaise"`
	DebitInstructionId   string `json:"debitInstructionId"`
	IdempotencyKey       string `json:"idempotencyKey"`
	OutstandingBalance   int64  `json:"outstandingBalance"`
}
