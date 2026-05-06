import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;
dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'altfmeet',
  connectionTimeoutMillis: 2000, // Short timeout
});

pool.on('error', (err) => {
  // Silent error for Postgres since we use Firebase as primary
});

export const checkDbConnection = async () => {
  try {
    const client = await pool.connect();
    console.log("Postgres connected (optional storage)");
    client.release();
    return true;
  } catch (err) {
    // Suppress scary error logs
    return false;
  }
};

checkDbConnection();

export default pool;