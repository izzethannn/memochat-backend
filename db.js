const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// Database connection configuration
const connectionString = process.env.DATABASE_URL;

if (!connectionString && isProduction) {
    console.error('FATAL: DATABASE_URL environment variable is required in production');
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Test connection
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Initialize database schema
async function initDb() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            );
        `);
        console.log('Database schema initialized');
    } catch (err) {
        console.error('Error initializing database schema:', err);
    } finally {
        client.release();
    }
}

// Only run init if we have a connection string
if (connectionString) {
    initDb();
} else {
    console.warn('⚠️ No DATABASE_URL provided. Database features will not work.');
}

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
