import test from "node:test";
import assert from "node:assert/strict";
import { hashCheckoutPayload } from "../services/posOperationsService.js";

const base = {
  cart: [{ id: 1, qty: 2, cup_size: "L", add_ons: [{ id: 5, customer_qty: 1 }, { id: 2, customer_qty: 2 }] }],
  discount_type: "NONE",
  payment_method: "CASH",
  amount_received: 500
};

test("hash is stable across add-on order and ignores manager_pin", () => {
  const reordered = { ...base, manager_pin: "1234", cart: [{ ...base.cart[0], add_ons: [...base.cart[0].add_ons].reverse() }] };
  assert.equal(hashCheckoutPayload(base), hashCheckoutPayload(reordered));
});

test("hash changes when cart, discount or payment change", () => {
  const h = hashCheckoutPayload(base);
  assert.notEqual(h, hashCheckoutPayload({ ...base, cart: [{ ...base.cart[0], qty: 3 }] }));
  assert.notEqual(h, hashCheckoutPayload({ ...base, discount_type: "CUSTOM", custom_discount_mode: "PERCENT", custom_discount_value: 50 }));
  assert.notEqual(h, hashCheckoutPayload({ ...base, payment_method: "GCASH" }));
  assert.notEqual(h, hashCheckoutPayload({ ...base, amount_received: 600 }));
});
