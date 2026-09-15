import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });  

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL
});
async function run() {
  await client.connect();
  try {
    await client.query("INSERT INTO public.suppliers (name, contact_info) VALUES ('Best Beans Inc.', 'contact@bestbeans.com')");
    console.log('Supplier added.');
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
