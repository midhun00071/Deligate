import { EidStackError } from './errors';

/** Preserve bytes; never normalize, trim, reconstruct or open invitations. */
export function validateIssuerInvitation(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[^\x21-\x7e]/.test(value)) {
    throw new EidStackError('INVITATION_UNAVAILABLE');
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
  } catch {
    throw new EidStackError('INVITATION_UNAVAILABLE');
  }
  return value;
}
