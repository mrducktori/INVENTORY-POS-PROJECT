import { supabase } from '../../server/config/supabaseClient.js';

/**
 * Seed Recent Dashboard & Forecasting Data
 * Adds realistic sales and transactions from October 10 to October 23, 2026 (today),
 * seeds purchase orders across statuses (including Declined with reason),
 * and creates recent wastage logs WITHOUT deleting any existing data.
 */

async function seed() {
  console.log("Starting realistic dashboard & forecasting data seeding...");

  // 1. Fetch available products, staff, suppliers, and ingredients
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, category')
    .eq('is_archived', false);

  const { data: staffUsers } = await supabase
    .from('users')
    .select('id, name')
    .in('role', ['Admin', 'Staff']);

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name');

  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name, unit, stock_quantity, low_stock_alert')
    .eq('is_archived', false);

  if (!products || products.length === 0) {
    console.error("No active products found to seed sales!");
    return;
  }

  const staffIds = staffUsers?.length > 0 
    ? staffUsers.map(u => u.id) 
    : ['00000000-0000-0000-0000-000000000002'];

  console.log(`Using ${products.length} products and ${staffIds.length} staff members.`);

  // 2. Generate Sales from October 10, 2026 to October 23, 2026 (Today)
  console.log("Generating sales from Oct 10 to Oct 23 (Today)...");
  
  const paymentMethods = ['CASH', 'CASH', 'CASH', 'GCASH', 'GCASH', 'CARD'];
  let totalSalesInserted = 0;
  let totalItemsInserted = 0;

  for (let day = 10; day <= 23; day++) {
    const isToday = (day === 23);
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `2026-10-${dayStr}`;
    const dateObj = new Date(2026, 9, day);
    const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isPayday = (day === 15);

    // Dynamic order volume: higher on weekends & payday
    let numOrders = isWeekend ? 35 : (isPayday ? 40 : 22);
    if (isToday) numOrders = 18; // orders up to mid-day today

    const salesBatch = [];
    const itemsBatchBySaleIndex = [];

    for (let o = 0; o < numOrders; o++) {
      // Determine hour of sale
      let hour;
      if (isToday) {
        // Between 8:00 AM and 1:45 PM
        hour = Math.floor(Math.random() * 6) + 8; // 8 to 13
      } else {
        // Between 8:00 AM and 8:00 PM with lunch / afternoon clusters
        const r = Math.random();
        if (r < 0.35) hour = Math.floor(Math.random() * 3) + 11; // 11, 12, 13 (lunch peak)
        else if (r < 0.70) hour = Math.floor(Math.random() * 4) + 15; // 15, 16, 17, 18 (merienda peak)
        else hour = Math.floor(Math.random() * 4) + 8; // morning
      }

      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
      const createdAt = `${dateStr}T${timeStr}+08:00`;

      // Select 1 to 3 items
      const numItems = Math.floor(Math.random() * 3) + 1;
      const saleItemsList = [];
      let totalAmount = 0;

      for (let i = 0; i < numItems; i++) {
        const prod = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        const unitPrice = parseFloat(prod.price) || 45;
        const subtotal = qty * unitPrice;
        totalAmount += subtotal;

        saleItemsList.push({
          product_id: prod.id,
          quantity: qty,
          unit_price: unitPrice,
          cup_size: 'Regular',
          add_ons: [],
          discount_percent: 0,
          notes: ''
        });
      }

      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      const staffId = staffIds[Math.floor(Math.random() * staffIds.length)];
      const receiptNumber = `RCP-202610${dayStr}-${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}${String(o).padStart(2, '0')}`;

      salesBatch.push({
        total_amount: totalAmount,
        payment_method: paymentMethod,
        staff_id: staffId,
        receipt_number: receiptNumber,
        discount_amount: 0,
        tax_amount: 0,
        status: 'COMPLETED',
        payment_status: 'PAID',
        amount_received: paymentMethod === 'CASH' ? Math.ceil(totalAmount / 50) * 50 : totalAmount,
        change_amount: paymentMethod === 'CASH' ? (Math.ceil(totalAmount / 50) * 50 - totalAmount) : 0,
        created_at: createdAt
      });

      itemsBatchBySaleIndex.push(saleItemsList);
    }

    // Insert sales batch for this day
    const { data: insertedSales, error: salesInsertError } = await supabase
      .from('sales')
      .insert(salesBatch)
      .select('id');

    if (salesInsertError) {
      console.error(`Error inserting sales for ${dateStr}:`, salesInsertError);
      continue;
    }

    // Link and insert sale items
    const allSaleItemsToInsert = [];
    insertedSales.forEach((saleRecord, idx) => {
      const items = itemsBatchBySaleIndex[idx];
      items.forEach(it => {
        allSaleItemsToInsert.push({
          ...it,
          sale_id: saleRecord.id
        });
      });
    });

    const { error: itemsInsertError } = await supabase
      .from('sale_items')
      .insert(allSaleItemsToInsert);

    if (itemsInsertError) {
      console.error(`Error inserting sale items for ${dateStr}:`, itemsInsertError);
    } else {
      totalSalesInserted += insertedSales.length;
      totalItemsInserted += allSaleItemsToInsert.length;
      console.log(`✓ ${dateStr}: Seeded ${insertedSales.length} sales (${allSaleItemsToInsert.length} items)`);
    }
  }

  console.log(`\nTotal Sales Seeded: ${totalSalesInserted}`);
  console.log(`Total Sale Items Seeded: ${totalItemsInserted}`);

  // 3. Seed Purchase Orders across various statuses
  console.log("\nSeeding recent Purchase Orders...");
  if (suppliers && suppliers.length > 0 && ingredients && ingredients.length > 0) {
    const mainSupplier = suppliers[0];
    const secondSupplier = suppliers.length > 1 ? suppliers[1] : suppliers[0];

    const poSeedList = [
      {
        supplier_id: mainSupplier.id,
        status: 'Declined',
        decline_reason: 'Temporary packaging carton shortage from manufacturer. Expected restock next Monday.',
        expected_date: '2026-10-25',
        total_amount: 2450,
        created_at: '2026-10-21T09:30:00+08:00',
        items: [
          { ingredient_id: ingredients[0].id, quantity: 5, unit_price: 250 },
          { ingredient_id: ingredients[1].id, quantity: 10, unit_price: 120 }
        ]
      },
      {
        supplier_id: secondSupplier.id,
        status: 'To Be Delivered',
        expected_date: '2026-10-24',
        total_amount: 3800,
        created_at: '2026-10-20T11:00:00+08:00',
        items: [
          { ingredient_id: ingredients[2]?.id || ingredients[0].id, quantity: 8, unit_price: 350 },
          { ingredient_id: ingredients[3]?.id || ingredients[0].id, quantity: 2, unit_price: 500 }
        ]
      },
      {
        supplier_id: mainSupplier.id,
        status: 'Pending',
        expected_date: '2026-10-26',
        total_amount: 1950,
        created_at: '2026-10-22T14:15:00+08:00',
        items: [
          { ingredient_id: ingredients[1]?.id || ingredients[0].id, quantity: 15, unit_price: 130 }
        ]
      },
      {
        supplier_id: secondSupplier.id,
        status: 'Received',
        expected_date: '2026-10-19',
        received_at: '2026-10-19T16:00:00+08:00',
        total_amount: 4200,
        created_at: '2026-10-17T08:45:00+08:00',
        items: [
          { ingredient_id: ingredients[0].id, quantity: 10, unit_price: 250 },
          { ingredient_id: ingredients[2]?.id || ingredients[0].id, quantity: 5, unit_price: 340 }
        ]
      }
    ];

    for (const po of poSeedList) {
      const { items, ...poData } = po;
      const { data: newPo, error: poErr } = await supabase
        .from('purchase_orders')
        .insert([poData])
        .select('id')
        .single();

      if (poErr) {
        // Fallback without decline_reason if table column not yet created
        const { decline_reason, ...poWithoutDecline } = poData;
        const { data: fallbackPo, error: fallbackErr } = await supabase
          .from('purchase_orders')
          .insert([poWithoutDecline])
          .select('id')
          .single();

        if (!fallbackErr && fallbackPo) {
          const poItems = items.map(it => ({
            purchase_order_id: fallbackPo.id,
            ingredient_id: it.ingredient_id,
            quantity: it.quantity,
            unit_price: it.unit_price,
            subtotal: it.quantity * it.unit_price,
            purchase_unit: 'Unit',
            conversion_factor: 1
          }));
          await supabase.from('purchase_order_items').insert(poItems);

          if (decline_reason) {
            await supabase.from('audit_logs').insert([{
              action: 'SUPPLIER_PO_DECLINED',
              user_id: staffIds[0],
              details: JSON.stringify({ po_id: fallbackPo.id, decline_reason, declineReason: decline_reason })
            }]);
          }
          console.log(`✓ Seeded PO #${fallbackPo.id.substring(0, 8)} (${po.status})`);
        }
      } else if (newPo) {
        const poItems = items.map(it => ({
          purchase_order_id: newPo.id,
          ingredient_id: it.ingredient_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.quantity * it.unit_price,
          purchase_unit: 'Unit',
          conversion_factor: 1
        }));
        await supabase.from('purchase_order_items').insert(poItems);

        if (po.decline_reason) {
          await supabase.from('audit_logs').insert([{
            action: 'SUPPLIER_PO_DECLINED',
            user_id: staffIds[0],
            details: JSON.stringify({ po_id: newPo.id, decline_reason: po.decline_reason, declineReason: po.decline_reason })
          }]);
        }
        console.log(`✓ Seeded PO #${newPo.id.substring(0, 8)} (${po.status})`);
      }
    }
  }

  // 4. Update a few ingredients to low stock for alerts
  console.log("\nConfiguring stock levels for Low Stock Alerts...");
  if (ingredients && ingredients.length >= 3) {
    // 1st item: Low stock (below max_stock * 0.5)
    await supabase
      .from('ingredients')
      .update({ stock_quantity: 120 })
      .eq('id', ingredients[0].id);

    // 2nd item: Critical low stock
    await supabase
      .from('ingredients')
      .update({ stock_quantity: 15 })
      .eq('id', ingredients[1].id);

    console.log(`✓ Updated "${ingredients[0].name}" and "${ingredients[1].name}" to low stock for alert monitoring.`);
  }

  // 5. Seed recent wastage records
  console.log("\nSeeding recent wastage logs...");
  if (ingredients && ingredients.length > 2) {
    const wastageLogs = [
      {
        ingredient_id: ingredients[0].id,
        quantity: 200,
        reason: 'Expired / shelf-life limit exceeded during storage',
        reported_by: staffIds[0],
        created_at: '2026-10-21T17:30:00+08:00'
      },
      {
        ingredient_id: ingredients[1].id,
        quantity: 10,
        reason: 'Damaged packaging during shelf stocking',
        reported_by: staffIds[0],
        created_at: '2026-10-22T10:15:00+08:00'
      }
    ];

    const { error: wErr } = await supabase.from('wastage').insert(wastageLogs);
    if (!wErr) {
      console.log(`✓ Seeded ${wastageLogs.length} recent wastage reports.`);
    }
  }

  console.log("\n=== SEEDING COMPLETED SUCCESSFULLY ===");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
