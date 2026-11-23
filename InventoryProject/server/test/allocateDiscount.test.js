import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateDiscount } from "../utils/allocateDiscount.js";

const cents = (arr) => arr.reduce((a, b) => a + Math.round(b * 100), 0);

test("shares sum to the discount", () => {
  const shares = allocateDiscount([10, 20, 30], 10);
  assert.equal(cents(shares), 1000);
  assert.deepEqual(allocateDiscount([33.33, 33.33, 33.34], 1), allocateDiscount([33.33, 33.33, 33.34], 1));
  assert.equal(cents(allocateDiscount([33.33, 33.33, 33.34], 1)), 100);
});

test("share never exceeds its line gross; discount capped at total", () => {
  const shares = allocateDiscount([1, 2], 999);
  assert.deepEqual(shares, [1, 2]);
});

test("zero and empty inputs", () => {
  assert.deepEqual(allocateDiscount([], 5), []);
  assert.deepEqual(allocateDiscount([10, 20], 0), [0, 0]);
  assert.deepEqual(allocateDiscount([0, 0], 5), [0, 0]);
  assert.deepEqual(allocateDiscount([10], undefined), [0]);
});

test("20k random fuzz keeps invariants", () => {
  for (let n = 0; n < 20000; n++) {
    const grosses = Array.from({ length: 1 + Math.floor(Math.random() * 8) }, () =>
      Math.round(Math.random() * 100000) / 100);
    const total = cents(grosses);
    const discount = Math.round(Math.random() * (total + 500)) / 100;
    const shares = allocateDiscount(grosses, discount);
    assert.equal(shares.length, grosses.length);
    shares.forEach((s, i) => assert.ok(Math.round(s * 100) <= Math.round(grosses[i] * 100) && s >= 0));
    assert.equal(cents(shares), Math.min(Math.round(discount * 100), total), JSON.stringify({ grosses, discount }));
  }
});
