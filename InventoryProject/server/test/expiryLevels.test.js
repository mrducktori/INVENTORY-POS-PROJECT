import test from "node:test";
import assert from "node:assert/strict";
import { expiryLevelFor, annotateAndSortBatchesFEFO } from "../services/batchService.js";

test("expiry levels by days left", () => {
  assert.equal(expiryLevelFor(null), "NONE");
  assert.equal(expiryLevelFor(-1), "EXPIRED");
  assert.equal(expiryLevelFor(0), "CRITICAL");
  assert.equal(expiryLevelFor(2), "CRITICAL");
  assert.equal(expiryLevelFor(3), "WARNING");
  assert.equal(expiryLevelFor(6), "WARNING");
  assert.equal(expiryLevelFor(7), "WATCH");
  assert.equal(expiryLevelFor(14), "WATCH");
  assert.equal(expiryLevelFor(15), "OK");
});

test("batches carry their expiry level", () => {
  const rows = annotateAndSortBatchesFEFO(
    [{ id: "a", quantity_remaining: 5, expiry_date: "2026-11-25", received_at: "2026-11-01T00:00:00Z" }],
    "2026-11-24"
  );
  assert.equal(rows[0].expiry_level, "CRITICAL");
});
