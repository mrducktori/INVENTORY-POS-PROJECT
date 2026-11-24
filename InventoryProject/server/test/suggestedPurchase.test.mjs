import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestedPurchase } from '../../src/features/analytics/utils/forecastUtils.js';

const item = { unit: 'G', suggested_order_qty: 7208 };

test('rounds up to whole packs', () => {
  const r = suggestedPurchase(item, { default_conversion_factor: 1000, default_purchase_unit: '1 kg' });
  assert.equal(r.qty, 8);
  assert.equal(r.needsSetup, false);
});

test('flags factor 1 with a different unit', () => {
  assert.equal(suggestedPurchase(item, { default_conversion_factor: 1, default_purchase_unit: '1 kg' }).needsSetup, true);
});

test('factor 1 with the stock unit is fine', () => {
  assert.equal(suggestedPurchase(item, { default_conversion_factor: 1, default_purchase_unit: 'g' }).needsSetup, false);
});
