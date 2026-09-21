import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DecisionEvidence } from './domain/verification-decision';
import { SUPABASE_ADMIN_CLIENT } from '../../infrastructure/supabase/supabase.tokens';

export interface VerificationRow {
  id: string;
  verifierOrganizationId: string;
  buildingId: string;
  buildingZoneId: string | null;
  proofRecordId: string | null;
  state:
    | 'REQUEST_CREATED'
    | 'AWAITING_SCAN'
    | 'PRESENTATION_RECEIVED'
    | 'VERIFYING'
    | 'VERIFIED'
    | 'DENIED'
    | 'FAILED'
    | 'TIMED_OUT';
  decision: 'PENDING' | 'ACCEPTED' | 'DENIED';
  reasons: string[];
  cryptographicVerification: 'PASS' | 'FAIL' | 'PENDING';
  revocation: 'NOT_REVOKED' | 'REVOKED' | 'UNKNOWN';
  issuerTrust: 'TRUSTED' | 'UNTRUSTED' | 'UNKNOWN';
  disclosedAttributes: {
    riderId: string;
    deliveryCompany: string;
    riderStatus: string;
  } | null;
  expiresAt: string | null;
  accessPassId: string | null;
}

const columns =
  'id,verifier_organization_id,building_id,building_zone_id,verification_id,workflow_state,decision_status,decision_reasons,cryptographic_status,revocation_status,issuer_trust_status,disclosed_attributes,expires_at,access_pass_id';

@Injectable()
export class VerificationRepository {
  constructor(@Inject(SUPABASE_ADMIN_CLIENT) private readonly db: SupabaseClient) {}

  async assertBuildingScope(org: string, buildingId: string, zoneId?: string): Promise<void> {
    const { data, error } = await this.db
      .from('buildings')
      .select('id')
      .eq('id', buildingId)
      .eq('organization_id', org)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException('Building lookup unavailable');
    if (!data) throw new NotFoundException('Building unavailable');
    if (!zoneId) return;
    const zone = await this.db
      .from('building_zones')
      .select('id')
      .eq('id', zoneId)
      .eq('building_id', buildingId)
      .eq('is_active', true)
      .maybeSingle();
    if (zone.error) throw new ServiceUnavailableException('Building zone lookup unavailable');
    if (!zone.data) throw new NotFoundException('Building zone unavailable');
  }

  async listBuildings(
    org: string,
  ): Promise<Array<{ id: string; name: string; zones: Array<{ id: string; name: string }> }>> {
    const { data: buildings, error } = await this.db
      .from('buildings')
      .select('id,name')
      .eq('organization_id', org)
      .eq('is_active', true)
      .order('name');
    if (error) throw new ServiceUnavailableException('Building list unavailable');
    const ids = (buildings ?? []).map((building) => building.id);
    if (!ids.length) return [];
    const { data: zones, error: zoneError } = await this.db
      .from('building_zones')
      .select('id,building_id,name')
      .in('building_id', ids)
      .eq('is_active', true)
      .order('name');
    if (zoneError) throw new ServiceUnavailableException('Building zone list unavailable');
    return (buildings ?? []).map((building) => ({
      id: building.id,
      name: building.name,
      zones: (zones ?? [])
        .filter((zone) => zone.building_id === building.id)
        .map((zone) => ({ id: zone.id, name: zone.name })),
    }));
  }

  async create(input: {
    actorId: string;
    org: string;
    buildingId: string;
    zoneId?: string;
    credDefId: string;
  }): Promise<VerificationRow> {
    const { data, error } = await this.db
      .from('verification_sessions')
      .insert({
        verifier_profile_id: input.actorId,
        verifier_organization_id: input.org,
        building_id: input.buildingId,
        building_zone_id: input.zoneId ?? null,
        required_credential_definition_id: input.credDefId,
        workflow_state: 'REQUEST_CREATED',
        decision_status: 'PENDING',
        decision_reasons: [],
        cryptographic_status: 'PENDING',
        revocation_status: 'UNKNOWN',
        issuer_trust_status: 'UNKNOWN',
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      })
      .select(columns)
      .single();
    if (error) throw new ServiceUnavailableException('Could not create verification');
    return mapRow(data);
  }

  async setProof(row: VerificationRow, proofRecordId: string): Promise<VerificationRow> {
    return this.update(row, { verification_id: proofRecordId, workflow_state: 'AWAITING_SCAN' });
  }

  async updateDecision(
    row: VerificationRow,
    evidence: DecisionEvidence,
    disclosedAttributes: VerificationRow['disclosedAttributes'],
  ): Promise<VerificationRow> {
    return this.update(row, {
      workflow_state: evidence.decision === 'ACCEPTED' ? 'VERIFIED' : 'DENIED',
      decision_status: evidence.decision,
      decision_reasons: evidence.reasons,
      cryptographic_status: evidence.cryptographicVerification,
      revocation_status: evidence.revocation,
      issuer_trust_status: evidence.issuerTrust,
      disclosed_attributes: disclosedAttributes,
    });
  }

  async find(org: string, id: string): Promise<VerificationRow> {
    const { data, error } = await this.db
      .from('verification_sessions')
      .select(columns)
      .eq('id', id)
      .eq('verifier_organization_id', org)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException('Verification lookup unavailable');
    if (!data) throw new NotFoundException('Verification unavailable');
    return mapRow(data);
  }

  async setAccessPass(row: VerificationRow, accessPassId: string): Promise<void> {
    const { error } = await this.db
      .from('verification_sessions')
      .update({ access_pass_id: accessPassId })
      .eq('id', row.id)
      .eq('verifier_organization_id', row.verifierOrganizationId);
    if (error) throw new ServiceUnavailableException('Access provenance could not be saved');
  }

  private async update(
    row: VerificationRow,
    patch: Record<string, unknown>,
  ): Promise<VerificationRow> {
    const { data, error } = await this.db
      .from('verification_sessions')
      .update(patch)
      .eq('id', row.id)
      .eq('verifier_organization_id', row.verifierOrganizationId)
      .eq('workflow_state', row.state)
      .select(columns)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException('Verification state could not be saved');
    if (!data)
      throw new ServiceUnavailableException('Verification changed; refresh before retrying');
    return mapRow(data);
  }
}

function mapRow(value: unknown): VerificationRow {
  const row = value as {
    id: string;
    verifier_organization_id: string;
    building_id: string;
    building_zone_id: string | null;
    verification_id: string | null;
    workflow_state: VerificationRow['state'];
    decision_status: VerificationRow['decision'];
    decision_reasons: string[] | null;
    cryptographic_status: VerificationRow['cryptographicVerification'];
    revocation_status: VerificationRow['revocation'];
    issuer_trust_status: VerificationRow['issuerTrust'];
    disclosed_attributes: VerificationRow['disclosedAttributes'];
    expires_at: string | null;
    access_pass_id: string | null;
  };
  return {
    id: row.id,
    verifierOrganizationId: row.verifier_organization_id,
    buildingId: row.building_id,
    buildingZoneId: row.building_zone_id,
    proofRecordId: row.verification_id,
    state: row.workflow_state,
    decision: row.decision_status,
    reasons: row.decision_reasons ?? [],
    cryptographicVerification: row.cryptographic_status,
    revocation: row.revocation_status,
    issuerTrust: row.issuer_trust_status,
    disclosedAttributes: row.disclosed_attributes,
    expiresAt: row.expires_at,
    accessPassId: row.access_pass_id,
  };
}
