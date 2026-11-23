import { test } from "node:test";
import assert from "node:assert/strict";
import * as pos from "../services/posService.js";
import * as ops from "../services/posOperationsService.js";

test("relative stock math", () => {
  assert.equal(pos.computeNextProductStock(5, -3), 2);
  assert.equal(pos.computeNextProductStock(2, -3), null);
  assert.equal(pos.computeNextProductStock(null, 4), 4);
  assert.equal(pos.computeNextProductStock(9, 5, 10), 10);
});

test("catalog-derived add-ons and size", () => {
  const product = {
    id: "p1", name: "Latte", category: "COFFEE", price: 100,
    sizes: [{ name: "16 oz", price_add: 15, ingredient_id: "cup16", recipe_multiplier: 1.5 }],
    add_ons: [{ name: "Pearl", price: 10, ingredient_id: "ing-pearl", quantity: 30, unit: "g" }]
  };
  const map = new Map([["p1", product]]);
  const ok = ops.calculateCartPricingFromCatalog([{
    id: "p1", qty: 2, cup_size: "16 oz", cup_size_obj: { name: "16 oz", recipe_multiplier: 99, ingredient_id: "evil" },
    add_ons: [{ name: "pearl", price: 0, ingredient_id: "evil", quantity: 9999, customer_qty: 2 }, { name: "Extra Love", price: 0, customer_qty: 1 }]
  }], map);
  assert.equal(ok.itemPrices[0].unit_price, 135);
  assert.equal(ok.itemPrices[0].cup_size_obj.ingredient_id, "cup16");
  assert.deepEqual(ok.itemPrices[0].add_ons[0], { ...product.add_ons[0], customer_qty: 2 });
  assert.deepEqual(ok.itemPrices[0].add_ons[1], { name: "Extra Love", price: 0, customer_qty: 1 });
  assert.throws(() => ops.calculateCartPricingFromCatalog([{ id: "p1", qty: 1, add_ons: [{ name: "Gold", price: 50 }] }], map), { status: 400 });
  assert.throws(() => ops.calculateCartPricingFromCatalog([{ id: "p1", qty: 1, add_ons: [{ name: "Gold", ingredient_id: "x" }] }], map), { status: 400 });
});

test("shift ownership", () => {
  assert.doesNotThrow(() => ops.assertCanAccessShift({ cashier_id: "u1" }, { id: "u1", role: "Staff" }));
  assert.doesNotThrow(() => ops.assertCanAccessShift({ cashier_id: "u1" }, { id: "u2", role: "Admin" }));
  assert.throws(() => ops.assertCanAccessShift({ cashier_id: "u1" }, { id: "u2", role: "Staff" }), { status: 403 });
});
