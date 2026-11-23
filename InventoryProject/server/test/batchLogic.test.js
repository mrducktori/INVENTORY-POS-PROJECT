import test from 'node:test';
import assert from 'node:assert/strict';
import { getIngredientPerishability, validateOptionalExpiryDate, annotateAndSortBatchesFEFO } from '../services/batchService.js';

const cats = { 'DAIRY & CREAMERS': { is_perishable: true, default_shelf_life_days: 7 }, 'PACKAGING & SUPPLIES': { is_perishable: false, default_shelf_life_days: null } };

test('shelf life: item override beats category, null falls back to category', () => {
  assert.deepEqual(getIngredientPerishability({ category: 'Dairy & Creamers', is_perishable: null }, cats),
    { is_perishable: true, default_shelf_life_days: 7, source: 'CATEGORY' });
  assert.equal(getIngredientPerishability({ category: 'DAIRY & CREAMERS', is_perishable: true, default_shelf_life_days: 3 }, cats).default_shelf_life_days, 3);
  assert.equal(getIngredientPerishability({ category: 'PACKAGING & SUPPLIES', is_perishable: null }, cats).is_perishable, false);
  assert.equal(getIngredientPerishability({ category: 'DAIRY & CREAMERS', is_perishable: false }, cats).is_perishable, false);
  assert.deepEqual(getIngredientPerishability({ category: 'UNKNOWN' }, cats), { is_perishable: true, default_shelf_life_days: null, source: 'NONE' });
});

test('expiry validation rejects junk and (optionally) past dates', () => {
  assert.equal(validateOptionalExpiryDate('2030-01-31'), '2030-01-31');
  assert.equal(validateOptionalExpiryDate(''), null);
  assert.throws(() => validateOptionalExpiryDate('2030-01-31junk'), /YYYY-MM-DD/);
  assert.throws(() => validateOptionalExpiryDate('2030-02-30'), /valid calendar/);
  assert.equal(validateOptionalExpiryDate('2000-01-01'), '2000-01-01');
  assert.throws(() => validateOptionalExpiryDate('2000-01-01', { rejectPast: true }), /already past/);
});

test('FEFO order: soonest usable expiry, then no-expiry by receipt time, expired last', () => {
  const today = '2026-11-24';
  const sorted = annotateAndSortBatchesFEFO([
    { id: 'expired', quantity_remaining: 1, expiry_date: '2026-11-20', received_at: '2026-11-01T00:00:00Z' },
    { id: 'noexp-new', quantity_remaining: 1, expiry_date: null, received_at: '2026-11-10T01:00:00+08:00' }, // = 09T17:00Z, a string sort would misorder it
    { id: 'noexp-old', quantity_remaining: 1, expiry_date: null, received_at: '2026-11-09T16:00:00Z' },
    { id: 'late', quantity_remaining: 1, expiry_date: '2026-12-30', received_at: '2026-11-01T00:00:00Z' },
    { id: 'soon', quantity_remaining: 1, expiry_date: '2026-11-26', received_at: '2026-11-01T00:00:00Z' },
    { id: 'empty', quantity_remaining: 0, expiry_date: '2026-11-25', received_at: '2026-11-01T00:00:00Z' },
  ], today);
  assert.deepEqual(sorted.map((b) => b.id), ['soon', 'late', 'noexp-old', 'noexp-new', 'expired']);
  assert.equal(sorted[0].expiry_status, 'EXPIRING_SOON');
  assert.equal(sorted.at(-1).expiry_status, 'EXPIRED');
});
