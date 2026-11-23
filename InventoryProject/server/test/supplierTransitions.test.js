import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupplierTransitionAllowed } from '../services/purchasingService.js';

test('supplier cannot regress or touch terminal POs', () => {
  assert.equal(isSupplierTransitionAllowed('Partial', 'Accepted'), false);
  assert.equal(isSupplierTransitionAllowed('Delivering', 'Accepted'), false);
  assert.equal(isSupplierTransitionAllowed('Received', 'Delivering'), false);
  assert.equal(isSupplierTransitionAllowed('Proposal Pending', 'Accepted'), false);
});

test('supplier forward moves are allowed', () => {
  assert.equal(isSupplierTransitionAllowed('Pending', 'Accepted'), true);
  assert.equal(isSupplierTransitionAllowed('Accepted', 'Delivering'), true);
  assert.equal(isSupplierTransitionAllowed('Partial', 'Delivering'), true);
});
