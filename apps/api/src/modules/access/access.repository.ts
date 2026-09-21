import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { EidStackMode } from '@deligate/eidstack';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../infrastructure/supabase/supabase.tokens';

export interface AccessRow {
  id: string;
  sessionId: string;
  buildingId: string;
  buildingZoneId: string | null;
  accessScope: string;
  status: 'PENDING' | 'ISSUED' | 'ACTIVE' | 'EXPIRED' | 'DENIED' | 'FAILED';
  validFrom: string;
  validUntil: string;
  credentialId: string | null;
}

const columns =
  'id,verification_session_id,building_id,building_zone_id,access_scope,status,valid_from,expires_at,access_credential_id';

@Injectable()
export class AccessRepository {
  constructor(@Inject(SUPABASE_ADMIN_CLIENT) private readonly db: SupabaseClient) {}

  async reserve(input: {
    sessionId: string;
    buildingId: string;
    zoneId: string | null;
    accessScope: string;
    validFrom: string;
    validUntil: string;
  }): Promise<{ row: AccessRow; created: boolean }> {
    const { data, error } = await this.db
      .from('access_passes')
      .insert({
        verification_session_id: input.sessionId,
        building_id: input.buildingId,
        building_zone_id: input.zoneId,
        access_scope: input.accessScope,
        valid_from: input.validFrom,
        expires_at: input.validUntil,
        status: 'PENDING',
      })
      .select(columns)
      .maybeSingle();
    if (!error && data) return { row: mapRow(data), created: true };
    if (error?.code !== '23505')
      throw new ServiceUnavailableException('Could not reserve temporary access');
    return { row: await this.findBySession(input.sessionId), created: false };
  }

  async complete(input: {
    pass: AccessRow;
    org: string;
    mode: EidStackMode;
    schemaId: string;
    credDefId: string;
    exchangeId: string;
  }): Promise<AccessRow> {
    const credential = await this.db
      .from('credential_records')
      .insert({
        kind: 'TEMPORARY_BUILDING_ACCESS',
        status: 'AWAITING_SCAN',
        issuer_organization_id: input.org,
        source_mode: input.mode,
        credential_exchange_id: input.exchangeId,
        schema_id: input.schemaId,
        credential_definition_id: input.credDefId,
        expires_at: input.pass.validUntil,
      })
      .select('id')
      .single();
    if (credential.error)
      throw new ServiceUnavailableException('Could not save temporary access issuance');
    const { data, error } = await this.db
      .from('access_passes')
      .update({ status: 'ISSUED', access_credential_id: credential.data.id })
      .eq('id', input.pass.id)
      .eq('status', 'PENDING')
      .select(columns)
      .maybeSingle();
    if (error || !data)
      throw new ServiceUnavailableException('Temporary access state could not be saved');
    return mapRow(data);
  }

  async fail(pass: AccessRow): Promise<void> {
    const { error } = await this.db
      .from('access_passes')
      .update({ status: 'FAILED' })
      .eq('id', pass.id)
      .eq('status', 'PENDING');
    if (error) throw new ServiceUnavailableException('Temporary access failure could not be saved');
  }

  async findBySession(sessionId: string): Promise<AccessRow> {
    const { data, error } = await this.db
      .from('access_passes')
      .select(columns)
      .eq('verification_session_id', sessionId)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException('Temporary access lookup unavailable');
    if (!data) throw new NotFoundException('Temporary access unavailable');
    return mapRow(data);
  }
}

function mapRow(value: unknown): AccessRow {
  const row = value as {
    id: string;
    verification_session_id: string;
    building_id: string;
    building_zone_id: string | null;
    access_scope: string;
    status: AccessRow['status'];
    valid_from: string;
    expires_at: string;
    access_credential_id: string | null;
  };
  return {
    id: row.id,
    sessionId: row.verification_session_id,
    buildingId: row.building_id,
    buildingZoneId: row.building_zone_id,
    accessScope: row.access_scope,
    status: row.status,
    validFrom: row.valid_from,
    validUntil: row.expires_at,
    credentialId: row.access_credential_id,
  };
}
