import assert from 'node:assert/strict';
import test from 'node:test';

import { roleHomePath } from './paths';
import { canAccessRole } from './roleAccess';

test('role route access only admits the authenticated matching role', () => {
  assert.equal(canAccessRole('DELIVERY_ADMIN', 'DELIVERY_ADMIN'), true);
  assert.equal(canAccessRole('BUILDING_SECURITY', 'DELIVERY_ADMIN'), false);
  assert.equal(canAccessRole('RIDER', 'BUILDING_SECURITY'), false);
  assert.equal(canAccessRole(null, 'RIDER'), false);
});

test('each authenticated role has its established home route', () => {
  assert.equal(roleHomePath.DELIVERY_ADMIN, '/delivery');
  assert.equal(roleHomePath.BUILDING_SECURITY, '/security');
  assert.equal(roleHomePath.RIDER, '/rider');
});
