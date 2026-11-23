import test from 'node:test';
import assert from 'node:assert/strict';
import { blocksPrivilegedChange } from '../routes/users.js';

const owner = { id: 'o', role: 'Owner' };
const admin = { id: 'a1', role: 'Admin' };

test('Owner can change anyone', () => {
  assert.equal(blocksPrivilegedChange(owner, 'a2', 'Admin', 'Staff'), false);
  assert.equal(blocksPrivilegedChange(owner, null, null, 'Admin'), false);
});

test('Admin cannot touch other Admins or the Owner', () => {
  assert.equal(blocksPrivilegedChange(admin, 'a2', 'Admin', 'Admin'), true);
  assert.equal(blocksPrivilegedChange(admin, 'o', 'Owner', 'Owner'), true);
  assert.equal(blocksPrivilegedChange(admin, 'a2', 'Admin', null), true);
});

test('Admin cannot create or promote to Admin/Owner', () => {
  assert.equal(blocksPrivilegedChange(admin, null, null, 'Admin'), true);
  assert.equal(blocksPrivilegedChange(admin, 's1', 'Staff', 'Admin'), true);
  assert.equal(blocksPrivilegedChange(admin, 'a1', 'Admin', 'Owner'), true);
});

test('Admin can manage staff and edit self', () => {
  assert.equal(blocksPrivilegedChange(admin, 's1', 'Staff', 'Custom'), false);
  assert.equal(blocksPrivilegedChange(admin, null, null, 'Staff'), false);
  assert.equal(blocksPrivilegedChange(admin, 'a1', 'Admin', 'Admin'), false);
});
