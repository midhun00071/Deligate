import assert from 'node:assert/strict';
import test from 'node:test';

import { errorForStatus, normalizeApiError } from './errors';

test('normalizes authorization and server statuses without exposing response content', () => {
  assert.equal(errorForStatus(401).code, 'unauthenticated');
  assert.equal(errorForStatus(403).code, 'unauthorized');
  assert.equal(errorForStatus(500).code, 'server');
});

test('normalizes network and timeout failures', () => {
  assert.equal(normalizeApiError(new TypeError('fetch failed')).code, 'network');
  assert.equal(normalizeApiError(new DOMException('aborted', 'AbortError')).code, 'timeout');
});
