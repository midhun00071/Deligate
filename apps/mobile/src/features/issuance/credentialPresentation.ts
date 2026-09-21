import { credentialSchema, type CredentialRecord } from '@deligate/validation';

export function shouldPollCredential(value: unknown): boolean {
  const parsed = credentialSchema.safeParse(value);
  return parsed.success && parsed.data.state === 'AWAITING_WALLET';
}

export function credentialLabel(record: CredentialRecord | null): string {
  if (!record) return 'Not issued';
  if (record.revocationPending) return 'Revocation outcome pending';
  const labels: Record<CredentialRecord['state'], string> = {
    REQUESTING: 'Issuance requested — outcome pending',
    AWAITING_WALLET: 'Awaiting wallet',
    ISSUED: 'Issued',
    REVOKED: 'Revoked',
    FAILED: 'Issuance failed',
    UNKNOWN: 'Issuance outcome unknown',
  };
  return labels[record.state];
}

export function canRevoke(record: CredentialRecord | null): boolean {
  return (
    record?.state === 'ISSUED' && record.revocationSupported === true && !record.revocationPending
  );
}

export function canIssueCredential(record: CredentialRecord | null): boolean {
  return record === null || record.state === 'REVOKED' || record.state === 'FAILED';
}
