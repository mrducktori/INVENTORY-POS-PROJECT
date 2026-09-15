import pg from 'pg';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') }); // Make sure it points to your .env

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await client.connect();
  try {
    // Drop tables if they exist to restart migration cleanly
    await client.query(`
      DROP TABLE IF EXISTS public.purchase_order_items CASCADE;
      DROP TABLE IF EXISTS public.purchase_orders CASCADE;
      DROP TABLE IF EXISTS public.suppliers CASCADE;
    `);

    // 1. Create suppliers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.suppliers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        contact_info TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // 2. Create purchase_orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.purchase_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        total_amount DECIMAL(10, 2) DEFAULT 0.00,
        expected_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        received_at TIMESTAMP
      );
    `);

    // 3. Create purchase_order_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.purchase_order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
        ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
        quantity DECIMAL(10, 2) NOT NULL,
        unit_price DECIMAL(10, 2) DEFAULT 0.00,
        subtotal DECIMAL(10, 2) DEFAULT 0.00
      );
    `);

    console.log('Migration successful: Purchase Order tables created.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}
run();
