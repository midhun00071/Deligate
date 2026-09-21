import { credentialSchema, type CredentialRecord } from '@deligate/validation';
import { z } from 'zod';

export const credentialColumns =
  'id,rider_id,issuer_state,source_mode,credential_exchange_id,schema_id,credential_definition_id,revocation_supported,revocation_pending,created_at,issued_at,revoked_at,expires_at,error_code';
const rowSchema = z.object({
  id: z.string(),
  rider_id: z.string(),
  issuer_state: z.string(),
  source_mode: z.string(),
  credential_exchange_id: z.string().nullable(),
  schema_id: z.string(),
  credential_definition_id: z.string(),
  revocation_supported: z.boolean().nullable(),
  revocation_pending: z.boolean(),
  created_at: z.string(),
  issued_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  expires_at: z.string(),
  error_code: z.string().nullable(),
});

export function mapCredential(value: unknown): CredentialRecord {
  const row = rowSchema.parse(value);
  return credentialSchema.parse({
    id: row.id,
    riderId: row.rider_id,
    state: row.issuer_state,
    source: row.source_mode,
    credentialExchangeId: row.credential_exchange_id,
    schemaId: row.schema_id,
    credentialDefinitionId: row.credential_definition_id,
    revocationSupported: row.revocation_supported,
    revocationPending: row.revocation_pending,
    requestedAt: row.created_at,
    issuedAt: row.issued_at,
    revokedAt: row.revoked_at,
    validUntil: row.expires_at,
    errorCode: row.error_code,
  });
}
