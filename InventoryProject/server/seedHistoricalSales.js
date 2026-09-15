import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Config ---
const START_YEAR = 2021;
const START_MONTH = 8; // September (0-indexed)
const END_DATE = new Date("2026-03-01T00:00:00+08:00");

// Seasonal multipliers (1.0 = normal, higher = busier)
// E.g., summer months (March, April, May in PH) are busier for cold drinks, maybe December is busy for hot drinks.
const getSeasonalMultiplier = (date) => {
  const month = date.getMonth();
  if (month === 2 || month === 3 || month === 4) return 1.3; // Summer peak
  if (month === 11 || month === 0) return 1.4; // Holiday peak
  return 1.0;
};

// Weekend multiplier
const getDayMultiplier = (date) => {
  const day = date.getDay();
  if (day === 0 || day === 6) return 1.5; // Weekends 50% busier
  return 1.0;
};

// Random helper
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function run() {
  console.log("Fetching products and staff...");
  const { data: products, error: pErr } = await supabase.from('products').select('*');
  const { data: staff, error: sErr } = await supabase.from('users').select('*').in('role', ['Admin', 'Staff', 'Owner']);

  if (pErr || sErr) {
    console.error("Error fetching dependencies:", pErr || sErr);
    return;
  }

  if (!products.length || !staff.length) {
    console.error("Missing products or staff members. Aborting.");
    return;
  }

  console.log(`Found ${products.length} products and ${staff.length} staff members.`);
  
  // Track existing dates to avoid duplicating the same day if re-run
  const { data: existingSales } = await supabase.from('sales').select('created_at').order('created_at', { ascending: true }).limit(1);
  let stopDate = END_DATE;
  if (existingSales && existingSales.length > 0) {
     const earliestExisting = new Date(existingSales[0].created_at);
     // Don't overwrite or overlap existing real data
     if (earliestExisting < END_DATE) {
         stopDate = earliestExisting;
     }
  }

  let currentDate = new Date(START_YEAR, START_MONTH, 1);
  let totalSalesGenerated = 0;
  let totalItemsGenerated = 0;

  const BATCH_SIZE = 500;
  let salesBatch = [];
  let saleItemsBatch = [];

  console.log(`Generating data from ${currentDate.toISOString().split('T')[0]} to ${stopDate.toISOString().split('T')[0]}`);

  while (currentDate < stopDate) {
    const baseSalesPerDay = randomInt(10, 25);
    const multiplier = getSeasonalMultiplier(currentDate) * getDayMultiplier(currentDate);
    const actualSalesToday = Math.floor(baseSalesPerDay * multiplier);

    for (let i = 0; i < actualSalesToday; i++) {
      // Pick a random time during the day (8 AM to 8 PM)
      const hour = randomInt(8, 20);
      const minute = randomInt(0, 59);
      const saleDate = new Date(currentDate);
      saleDate.setHours(hour, minute, 0, 0);

      const staffMember = randomElement(staff);
      const saleId = Math.random().toString(36).substring(2, 15); // Temporary ID mapping for items
      const receiptNumber = 'REC-' + Math.floor(Math.random() * 10000000).toString().padStart(7, '0');

      let saleTotal = 0;
      let numItems = randomInt(1, 4); // 1 to 4 unique items per transaction
      let currentItems = [];

      for (let j = 0; j < numItems; j++) {
        const product = randomElement(products);
        const qty = randomInt(1, 3);
        const price = parseFloat(product.price);
        const subtotal = price * qty;
        saleTotal += subtotal;

        currentItems.push({
          temp_sale_id: saleId, // Used to link before insertion
          product_id: product.id,
          quantity: qty,
          unit_price: price,
          discount_percent: 0,
          cup_size: null,
          add_ons: []
        });
      }

      salesBatch.push({
        temp_id: saleId,
        staff_id: staffMember.id,
        total_amount: saleTotal,
        payment_method: Math.random() > 0.3 ? 'CASH' : 'GCASH', // 70% cash, 30% GCash
        created_at: saleDate.toISOString(),
        status: 'completed',
        payment_status: 'paid',
        discount_amount: 0,
        tax_amount: saleTotal * 0.12, // 12% VAT
        receipt_number: receiptNumber,
        amount_received: saleTotal,
        change_amount: 0
      });

      saleItemsBatch.push(...currentItems);
      totalSalesGenerated++;
      totalItemsGenerated += numItems;

      if (salesBatch.length >= BATCH_SIZE) {
        await insertBatch(salesBatch, saleItemsBatch);
        salesBatch = [];
        saleItemsBatch = [];
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Insert remaining
  if (salesBatch.length > 0) {
    await insertBatch(salesBatch, saleItemsBatch);
  }

  console.log(`\nSuccessfully generated ${totalSalesGenerated} sales with ${totalItemsGenerated} items!`);
}

async function insertBatch(sales, items) {
  process.stdout.write('.'); // progress indicator
  
  // Prepare sales for insert (remove temp_id)
  const salesToInsert = sales.map(s => {
    const { temp_id, ...rest } = s;
    return rest;
  });

  const { data: insertedSales, error: sErr } = await supabase
    .from('sales')
    .insert(salesToInsert)
    .select('id, receipt_number');

  if (sErr) {
    console.error("\nError inserting sales:", sErr);
    return;
  }

  // Map inserted sale UUIDs back to items using receipt_number as the bridge since it's unique
  const receiptToIdMap = {};
  insertedSales.forEach(s => {
    receiptToIdMap[s.receipt_number] = s.id;
  });

  const itemsToInsert = items.map(item => {
    // Find the corresponding sale by matching temp_sale_id in original sales array
    const originalSale = sales.find(s => s.temp_id === item.temp_sale_id);
    const actualSaleId = receiptToIdMap[originalSale.receipt_number];
    
    const { temp_sale_id, ...rest } = item;
    return { ...rest, sale_id: actualSaleId };
  });

  const { error: iErr } = await supabase
    .from('sale_items')
    .insert(itemsToInsert);

  if (iErr) {
    console.error("\nError inserting sale items:", iErr);
  }
}

run();
