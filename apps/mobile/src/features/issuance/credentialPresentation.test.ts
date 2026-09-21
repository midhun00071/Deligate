import assert from 'node:assert/strict';
import test from 'node:test';
import { credentialSchema, riderInputSchema, riderQuerySchema } from '@deligate/validation';
import { canRevoke, credentialLabel, shouldPollCredential } from './credentialPresentation';
import { validateInvitationValue } from '../qr/invitation';

const record = credentialSchema.parse({
  id: '40000000-0000-4000-8000-000000000001',
  riderId: '30000000-0000-4000-8000-000000000001',
  state: 'ISSUED',
  source: 'mock',
  credentialExchangeId: 'mock-exchange',
  schemaId: 's',
  credentialDefinitionId: 'd',
  revocationSupported: true,
  revocationPending: false,
  requestedAt: '2026-09-21',
  issuedAt: '2026-09-21',
  revokedAt: null,
  validUntil: '2026-12-20',
  errorCode: null,
});

test('renders unknown, unissued, failed and revoked states truthfully', () => {
  assert.equal(credentialLabel(null), 'Not issued');
  assert.equal(credentialLabel({ ...record, state: 'UNKNOWN' }), 'Issuance outcome unknown');
  assert.equal(credentialLabel({ ...record, state: 'FAILED' }), 'Issuance failed');
  assert.equal(credentialLabel({ ...record, state: 'REVOKED' }), 'Revoked');
  assert.equal(
    credentialLabel({ ...record, revocationPending: true }),
    'Revocation outcome pending',
  );
});

test('offers revocation only for issued revocable credentials without an in-flight action', () => {
  assert.equal(canRevoke(record), true);
  for (const state of ['REQUESTING', 'AWAITING_WALLET', 'FAILED', 'UNKNOWN', 'REVOKED'] as const) {
    assert.equal(canRevoke({ ...record, state }), false);
  }
  assert.equal(canRevoke({ ...record, revocationSupported: null }), false);
  assert.equal(canRevoke({ ...record, revocationPending: true }), false);
});

test('shared input validation rejects private data, invalid status and large pages', () => {
  assert.equal(
    riderInputSchema.safeParse({ employeeReference: 'R-1', privateKey: 'x' }).success,
    false,
  );
  assert.equal(
    riderInputSchema.safeParse({ employeeReference: 'R-1', employmentStatus: 'ISSUED' }).success,
    false,
  );
  assert.equal(riderQuerySchema.safeParse({ limit: 51 }).success, false);
});

test('polls only awaiting-wallet records and stops on every other state', () => {
  assert.equal(shouldPollCredential({ ...record, state: 'AWAITING_WALLET' }), true);
  for (const state of ['REQUESTING', 'ISSUED', 'FAILED', 'UNKNOWN', 'REVOKED']) {
    assert.equal(shouldPollCredential({ ...record, state }), false);
  }
  assert.equal(shouldPollCredential(null), false);
});

test('issuance invitation crosses the existing C02 render boundary unchanged', () => {
  const exact = 'https://wallet.example/?_oob=Ab%2fC%3d&v=2';
  assert.deepEqual(validateInvitationValue(exact, 'live'), { value: exact, source: 'live' });
});
