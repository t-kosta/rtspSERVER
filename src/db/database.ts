import { Pool, PoolClient, QueryResult } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

class Database {
    private pool: Pool;
    private static instance: Database;

    private constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'rtsp_relay',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('error', (err) => {
            console.error('Unexpected database error:', err);
        });
    }

    public static getInstance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    public async query(text: string, params?: any[]): Promise<QueryResult> {
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            console.log('Executed query', { text, duration, rows: result.rowCount });
            return result;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    public async getClient(): Promise<PoolClient> {
        return await this.pool.query();
    }

    public async initialize(): Promise<void> {
        try {
            // Read and execute schema
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf-8');

            await this.query(schema);
            console.log('Database schema initialized successfully');

            // Create default admin user if not exists
            await this.createDefaultAdmin();
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    private async createDefaultAdmin(): Promise<void> {
        const bcrypt = require('bcrypt');
        const email = process.env.ADMIN_EMAIL || 'admin@example.com';
        const password = process.env.ADMIN_PASSWORD || 'admin123';

        try {
            const existingUser = await this.query(
                'SELECT id FROM users WHERE email = $1',
                [email]
            );

            if (existingUser.rows.length === 0) {
                const passwordHash = await bcrypt.hash(password, 10);
                await this.query(
                    `INSERT INTO users (email, password_hash, full_name, role)
                     VALUES ($1, $2, $3, $4)`,
                    [email, passwordHash, 'Administrator', 'admin']
                );
                console.log(`Default admin user created: ${email}`);
            }
        } catch (error) {
            console.error('Failed to create default admin:', error);
        }
    }

    public async close(): Promise<void> {
        await this.pool.end();
    }
}

export default Database;
