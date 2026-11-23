import test from "node:test";
import assert from "node:assert/strict";
import { isStrawName, validateExtraQuantity } from "../services/extraSuppliesService.js";

test("isStrawName matches straws but not strawberry", () => {
  for (const n of ["REGULAR STRAW", "Boba Straw", "straw", "Paper Straws"]) assert.equal(isStrawName(n), true, n);
  for (const n of ["STRAWBERRY SYRUP", "", null]) assert.equal(isStrawName(n), false, String(n));
});

test("validateExtraQuantity defaults to 1 and enforces whole 1..5", () => {
  assert.equal(validateExtraQuantity(undefined), 1);
  assert.equal(validateExtraQuantity("3"), 3);
  for (const bad of [0, 6, 1.5, -1, "abc"]) assert.throws(() => validateExtraQuantity(bad), (e) => e.status === 400);
});
