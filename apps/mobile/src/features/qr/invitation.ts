export const INVITATION_VALUE_MAX_LENGTH = 2048;

export type InvitationSourceMode = 'mock' | 'live';

export interface ValidatedInvitation {
  readonly value: string;
  readonly source: InvitationSourceMode;
}

export class InvitationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvitationValidationError';
  }
}

/** Validates Deligate's opaque server-returned invitation URL without rewriting it. */
export function validateInvitationValue(
  value: unknown,
  source: InvitationSourceMode,
): ValidatedInvitation {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvitationValidationError('An invitation value is required');
  }

  if (value.length > INVITATION_VALUE_MAX_LENGTH) {
    throw new InvitationValidationError('This invitation is too long to display safely');
  }

  if (/[^\x20-\x7E]/.test(value)) {
    throw new InvitationValidationError('This invitation contains unsupported characters');
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new InvitationValidationError('This invitation is not a valid URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new InvitationValidationError('This invitation uses an unsupported URL scheme');
  }

  return Object.freeze({ value, source });
}
