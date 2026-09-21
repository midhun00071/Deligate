import assert from 'node:assert/strict';
import test from 'node:test';
import { temporaryAccessPath } from './access.route';

test('temporary access uses the application API prefix and encoded verification route', () => {
  assert.equal(
    temporaryAccessPath('verification/id'),
    '/api/security/verifications/verification%2Fid/access',
  );
});
