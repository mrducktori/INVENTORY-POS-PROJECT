import test from "node:test";
import assert from "node:assert/strict";
import { calendarEvents } from "../services/forecastService.js";

test("fixed holidays are listed; ordinary days and paydays are not", () => {
  assert.deepEqual(calendarEvents("2026-12-25"), ["Christmas Day"]);
  assert.deepEqual(calendarEvents("2026-12-30"), ["Rizal Day"]);
  assert.deepEqual(calendarEvents("2026-06-15"), []);
  assert.deepEqual(calendarEvents("2026-07-07"), []);
});
