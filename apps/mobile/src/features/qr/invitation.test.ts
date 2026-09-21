import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INVITATION_VALUE_MAX_LENGTH,
  InvitationValidationError,
  validateInvitationValue,
} from './invitation';

test('preserves a valid server invitation exactly', () => {
  const value = 'https://sandbox.example.invalid/oob?c_i=exact-value';

  assert.equal(validateInvitationValue(value, 'live').value, value);
});

test('accepts a long valid invitation at the documented bound', () => {
  const value = `https://sandbox.example.invalid/i?c_i=${'a'.repeat(
    INVITATION_VALUE_MAX_LENGTH - 39,
  )}`;

  assert.equal(validateInvitationValue(value, 'mock').value, value);
});

test('refuses malformed and oversized invitation values', () => {
  assert.throws(
    () => validateInvitationValue('not a URL', 'live'),
    InvitationValidationError,
  );
  assert.throws(
    () =>
      validateInvitationValue(
        `https://sandbox.example.invalid/${'x'.repeat(INVITATION_VALUE_MAX_LENGTH)}`,
        'live',
      ),
    InvitationValidationError,
  );
});
