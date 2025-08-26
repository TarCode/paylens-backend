import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Utility function to convert snake_case to camelCase
function snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Transform database row from snake_case to camelCase
function transformRow<T extends QueryResultRow>(row: any): T {
    if (!row || typeof row !== 'object') return row;

    const transformed: any = {};
    for (const [key, value] of Object.entries(row)) {
        transformed[snakeToCamel(key)] = value;
    }
    return transformed as T;
}

export class DatabaseService {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('connect', (client: PoolClient) => {
            console.log('New client connected to database');
        });

        this.pool.on('error', (err: Error, client: PoolClient) => {
            console.error('Unexpected error on idle client', err);
        });
    }

    async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            // Transform each row from snake_case to camelCase
            const transformedRows = result.rows.map(row => transformRow<T>(row));
            return {
                ...result,
                rows: transformedRows
            };
        } finally {
            client.release();
        }
    }

    async getClient(): Promise<PoolClient> {
        return await this.pool.connect();
    }

    async transaction<T>(
        callback: (client: PoolClient) => Promise<T>
    ): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
        console.log('Database pool has ended');
    }

    // Health check
    async healthCheck(): Promise<boolean> {
        try {
            const result = await this.query('SELECT NOW()');
            return result.rows.length > 0;
        } catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }
}

// Singleton instance
export const dbService = new DatabaseService();
