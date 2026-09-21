import { ConflictException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EidStackMode, IssuerReferences, IssuerState } from '@deligate/eidstack';
import type { CredentialRecord } from '@deligate/validation';
import { SUPABASE_ADMIN_CLIENT } from '../../infrastructure/supabase/supabase.tokens';
import { credentialColumns, mapCredential } from './credential.mapper';

export interface CredentialPatch {
  state?: IssuerState;
  exchangeId?: string;
  issuedAt?: string;
  revokedAt?: string;
  revocationPending?: boolean;
  errorCode?: string | null;
}

@Injectable()
export class CredentialRepository {
  constructor(@Inject(SUPABASE_ADMIN_CLIENT) private readonly db: SupabaseClient) {}

  async find(org: string, riderId: string): Promise<CredentialRecord | null> {
    const { data, error } = await this.db
      .from('credential_records')
      .select(credentialColumns)
      .eq('issuer_organization_id', org)
      .eq('rider_id', riderId)
      .eq('kind', 'VERIFIED_RIDER')
      .not('issuer_state', 'is', null)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException('Credential lookup unavailable');
    return data ? mapCredential(data) : null;
  }

  async reserve(
    org: string,
    riderId: string,
    actorId: string,
    source: EidStackMode,
    refs: IssuerReferences,
    validUntil: string,
  ) {
    const { data, error } = await this.db
      .from('credential_records')
      .insert({
        kind: 'VERIFIED_RIDER',
        issuer_organization_id: org,
        rider_id: riderId,
        issuer_state: 'REQUESTING',
        source_mode: source,
        schema_id: refs.schemaId,
        credential_definition_id: refs.credentialDefinitionId,
        revocation_supported: refs.revocationSupported,
        expires_at: validUntil,
        action_actor_id: actorId,
      })
      .select(credentialColumns)
      .single();
    if (error?.code === '23505')
      throw new ConflictException(
        'An issuance already exists. Refresh its state before taking another action.',
      );
    if (error) throw new ServiceUnavailableException('Could not reserve issuance');
    return mapCredential(data);
  }

  async update(
    org: string,
    record: CredentialRecord,
    actorId: string,
    patch: CredentialPatch,
  ): Promise<CredentialRecord> {
    const { data, error } = await this.db
      .from('credential_records')
      .update({
        ...(patch.state === undefined ? {} : { issuer_state: patch.state }),
        ...(patch.exchangeId === undefined ? {} : { credential_exchange_id: patch.exchangeId }),
        ...(patch.issuedAt === undefined ? {} : { issued_at: patch.issuedAt }),
        ...(patch.revokedAt === undefined ? {} : { revoked_at: patch.revokedAt }),
        ...(patch.revocationPending === undefined
          ? {}
          : { revocation_pending: patch.revocationPending }),
        ...(patch.errorCode === undefined ? {} : { error_code: patch.errorCode }),
        action_actor_id: actorId,
      })
      .eq('id', record.id)
      .eq('issuer_organization_id', org)
      .eq('issuer_state', record.state)
      .eq('revocation_pending', record.revocationPending)
      .select(credentialColumns)
      .maybeSingle();
    if (error)
      throw new ServiceUnavailableException(
        'Credential state could not be saved; reconcile before retrying',
      );
    if (!data)
      throw new ConflictException('Another action changed this credential. Refresh its state.');
    return mapCredential(data);
  }
}
