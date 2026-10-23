import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'microstream_super_secret_jwt_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  bcryptSaltRounds: 10,
  ledgerAdapterMode: (process.env.LEDGER_ADAPTER_MODE || 'mock') as 'mock' | 'live',
  payoutAdapterMode: (process.env.PAYOUT_ADAPTER_MODE || 'mock') as 'mock' | 'live',
  paymentAdapterMode: (process.env.PAYMENT_ADAPTER_MODE || 'mock') as 'mock' | 'live',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/microstream',
  upi: {
    maxRetries: parseInt(process.env.UPI_AUTOPAY_MAX_RETRIES || '3', 10),
    merchantVpa: process.env.UPI_AUTOPAY_MERCHANT_VPA || 'microstream@icici',
  },
};

