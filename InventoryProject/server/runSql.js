import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' }); // Make sure it points to your .env

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await client.connect();
  try {
    await client.query('ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS reference_code character varying;');
    console.log('Migration successful');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
