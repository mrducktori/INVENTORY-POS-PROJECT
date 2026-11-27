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

test("effectiveSizes: inherits category, hides toggled-off, never empties", () => {
  const cat = [{ name: "12 oz" }, { name: "16 oz" }, { name: "22 oz" }];
  assert.deepEqual(pos.effectiveSizes({ sizes: [] }, cat).map((s) => s.name), ["12 oz", "16 oz", "22 oz"]);
  assert.deepEqual(pos.effectiveSizes({ sizes: [], hidden_sizes: ["22 OZ"] }, cat).map((s) => s.name), ["12 oz", "16 oz"]);
  assert.deepEqual(pos.effectiveSizes({ sizes: [{ name: "16 oz" }] }, cat).map((s) => s.name), ["16 oz"]);
  assert.equal(pos.effectiveSizes({ sizes: [], hidden_sizes: ["12 oz", "16 oz", "22 oz"] }, cat).length, 3);
});

test("Senior/PWD discounts are locked by law whatever settings say", () => {
  const s = ops.normalizePosSettings({
    discount_types: [
      { id: "SENIOR", label: "Senior", rate_percent: 5, requires_id: false, vat_exempt: false, active: false },
      { id: "STUDENT", label: "Student", rate_percent: 10 }
    ]
  });
  const senior = s.discount_types.find((d) => d.id === "SENIOR");
  const pwd = s.discount_types.find((d) => d.id === "PWD");
  assert.deepEqual([senior.rate_percent, senior.vat_exempt, senior.requires_id, senior.active], [20, true, true, true]);
  assert.deepEqual([pwd.rate_percent, pwd.vat_exempt, pwd.active], [20, true, true]);
});

test("lids are deducted for dine-in too; straws only for take-out and delivery", () => {
  const size = { ingredient_id: "cup", lid_ingredient_id: "lid", straw_ingredient_id: "straw" };
  const labels = (type, sz = size) => pos.resolvePackagingIngredientIds(sz, type).map((p) => p.label);
  assert.deepEqual(labels("DINE_IN"), ["cup", "lid"]);
  assert.deepEqual(labels("TAKE_OUT"), ["cup", "lid", "straw"]);
  assert.deepEqual(labels("DINE_IN", { ...size, dine_in_no_cup: true }), ["lid"]);
  assert.deepEqual(pos.resolvePackagingIngredientIds(size, "TAKE_OUT", { noStraw: true }).map((p) => p.label), ["cup", "lid"]);
  // The cashier can serve a drink without a lid.
  assert.deepEqual(pos.resolvePackagingIngredientIds(size, "DINE_IN", { noLid: true }).map((p) => p.label), ["cup"]);
});

test("an Owner-unlocked Senior rate is kept instead of being reset to 20%", () => {
  const s = ops.normalizePosSettings({
    statutory_unlocked: true,
    discount_types: [{ id: "SENIOR", label: "Senior", rate_percent: 25, requires_id: true, vat_exempt: true, active: true }]
  });
  assert.equal(s.statutory_unlocked, true);
  assert.equal(s.discount_types.find((d) => d.id === "SENIOR").rate_percent, 25);
  // Without the flag the same input is forced back to the legal rate.
  assert.equal(ops.normalizePosSettings({ discount_types: [{ id: "SENIOR", rate_percent: 25 }] }).discount_types.find((d) => d.id === "SENIOR").rate_percent, 20);
});

test("manager PIN rate limit counts an attempt before its async work, closing a parallel-guess race", async () => {
  const rateKey = `pin-race-test-${Date.now()}`;
  // No PINs configured, so every guess fails after the synchronous reservation runs.
  // Fire more guesses than PIN_MAX_ATTEMPTS (10) at once: with the bug, they'd all read
  // the same stale "0 attempts" count and all run before any got counted.
  const attempts = Array.from({ length: 15 }, () => ops.verifyManagerPin("0000", rateKey).catch((e) => e));
  const results = await Promise.all(attempts);
  const rateLimited = results.filter((e) => e?.status === 429).length;
  // Once the 10-attempt budget is reserved, the rest must be rejected for being over the limit,
  // not for simply having the wrong PIN.
  assert.ok(rateLimited >= 5, `expected several 429s once the budget is used up, got ${rateLimited}`);
});
