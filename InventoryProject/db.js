import 'dotenv/config'
import postgres from 'postgres'
import pg from 'pg'
import process from 'process'

// Use pg for connection pooling
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
})

const sql = postgres(pool)

export default sql