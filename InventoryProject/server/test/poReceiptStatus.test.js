import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePoReceiptStatus } from '../services/purchasingService.js';

test('no stock received cannot close the PO', () => {
  assert.equal(derivePoReceiptStatus([{ quantity: 5, quantity_received: 0 }]), null);
  assert.equal(derivePoReceiptStatus([]), null);
});

test('partial vs full receipt', () => {
  assert.equal(derivePoReceiptStatus([{ quantity: 5, quantity_received: 2 }, { quantity: 3, quantity_received: 0 }]), 'Partial');
  assert.equal(derivePoReceiptStatus([{ quantity: 5, quantity_received: 5 }, { quantity: 3, quantity_received: 3 }]), 'Received');
});
