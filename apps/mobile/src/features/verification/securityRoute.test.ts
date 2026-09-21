import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Security route composes the Macro B verifier instead of the role-home placeholder', () => {
  const route = readFileSync('src/app/(security)/security/index.tsx', 'utf8');
  assert.match(route, /SecurityVerifierScreen/);
  assert.doesNotMatch(route, /RoleHomeScreen/);
});
