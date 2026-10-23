import pg from 'pg';
import { newDb, IMemoryDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface TransactionClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
}

class DatabaseService {
  private pool: pg.Pool | null = null;
  private memDb: IMemoryDb | null = null;
  private memAdapter: any = null;
  public isInMemory = false;
  private isInitialized = false;

  async init(databaseUrl?: string): Promise<void> {
    if (this.isInitialized) return;

    const url = databaseUrl || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/microstream';

    // 1. Try real PostgreSQL first
    try {
      const testPool = new Pool({
        connectionString: url,
        connectionTimeoutMillis: 1500,
      });

      const client = await testPool.connect();
      client.release();
      this.pool = testPool;
      this.isInMemory = false;
      console.log(`[Database] Connected successfully to PostgreSQL at ${url.split('@')[1] || url}`);
    } catch (err: any) {
      // 2. Fallback to in-memory PostgreSQL (pg-mem)
      console.log(`[Database] External PostgreSQL unreachable (${err.message || 'connection failed'}). Using in-memory PostgreSQL engine.`);
      this.isInMemory = true;
      this.memDb = newDb();

      // Register standard Postgres math / aggregate functions in pg-mem
      this.memDb.public.registerFunction({
        name: 'round',
        args: [(this.memDb.public as any).getType('numeric' as any)],
        returns: (this.memDb.public as any).getType('numeric' as any),
        implementation: (x: any) => Math.round(Number(x)),
      });

      this.memAdapter = this.memDb.adapters.createPg();
    }

    // 3. Execute schema DDL
    await this.runMigrations();
    this.isInitialized = true;

    // 4. Seed initial database data if needed
    try {
      const { seedDatabase } = await import('./seed.js');
      await seedDatabase();
    } catch (err: any) {
      console.error('[Database] Seed error:', err.message);
    }
  }

  private async runMigrations(): Promise<void> {
    let schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
    }
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.resolve('src/db/schema.sql');
    }

    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      if (this.isInMemory && this.memDb) {
        this.memDb.public.none(schemaSql);
      } else if (this.pool) {
        await this.pool.query(schemaSql);
      }
      console.log('[Database] Schema migrations applied successfully.');
    } else {
      console.warn('[Database] Warning: schema.sql not found at', schemaPath);
    }
  }

  // Type-safe parameterized query execution
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.isInMemory && this.memAdapter) {
      const client = new this.memAdapter.Client();
      await client.connect();
      try {
        const res = await client.query(text, params);
        return {
          rows: this.normalizeRows<T>(res.rows),
          rowCount: res.rowCount || res.rows.length,
        };
      } finally {
        await client.end();
      }
    }

    if (this.pool) {
      const res = await this.pool.query(text, params);
      return {
        rows: this.normalizeRows<T>(res.rows),
        rowCount: res.rowCount ?? res.rows.length,
      };
    }

    throw new Error('Database not initialized');
  }

  // Database transaction execution for financial operations
  async transaction<T>(callback: (client: TransactionClient) => Promise<T>): Promise<T> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.isInMemory && this.memAdapter) {
      const client = new this.memAdapter.Client();
      await client.connect();
      try {
        await client.query('BEGIN');
        const txClient: TransactionClient = {
          query: async <R = any>(text: string, params?: any[]) => {
            const res = await client.query(text, params);
            return {
              rows: this.normalizeRows<R>(res.rows),
              rowCount: res.rowCount || res.rows.length,
            };
          },
        };
        const result = await callback(txClient);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        await client.end();
      }
    }

    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const txClient: TransactionClient = {
          query: async <R = any>(text: string, params?: any[]) => {
            const res = await client.query(text, params);
            return {
              rows: this.normalizeRows<R>(res.rows),
              rowCount: res.rowCount ?? res.rows.length,
            };
          },
        };
        const result = await callback(txClient);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    throw new Error('Database not initialized');
  }

  // Ensures BIGINT paise fields are normalized to numbers for clean JSON serialization
  private normalizeRows<T>(rows: any[]): T[] {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
      const normalized: any = { ...row };
      for (const key of Object.keys(normalized)) {
        if (key.endsWith('_paise') || key === 'amount_paise' || key === 'principal_paise' || key === 'outstanding_balance_paise' || key === 'gross_earnings_paise' || key === 'net_earnings_paise' || key === 'total_repaid_paise' || key === 'max_amount_paise') {
          if (typeof normalized[key] === 'string') {
            normalized[key] = parseInt(normalized[key], 10);
          }
        }
      }
      return normalized as T;
    });
  }
}

export const db = new DatabaseService();
