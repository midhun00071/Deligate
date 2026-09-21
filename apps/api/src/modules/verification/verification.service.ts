import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { EidStackError, validateIssuerInvitation, type EidStackPort } from '@deligate/eidstack';
import type { AuthenticatedActor } from '@deligate/types';
import type { VerificationInput, VerificationSession } from '@deligate/validation';
import { EIDSTACK_PORT } from '../eidstack/eidstack.module';
import { decideVerification, unavailableDecision } from './domain/verification-decision';
import { riderProofPolicy } from './domain/rider-proof-policy';
import { VerificationInvitationCache } from './verification-invitation-cache';
import { VerificationRepository, type VerificationRow } from './verification.repository';

@Injectable()
export class VerificationService {
  constructor(
    private readonly repository: VerificationRepository,
    private readonly invitations: VerificationInvitationCache,
    @Inject(EIDSTACK_PORT) private readonly eidstack: EidStackPort,
  ) {}

  async create(actor: AuthenticatedActor, input: VerificationInput): Promise<VerificationSession> {
    const org = this.scope(actor);
    await this.repository.assertBuildingScope(org, input.buildingId, input.buildingZoneId);
    const row = await this.repository.create({
      actorId: actor.profileId,
      org,
      buildingId: input.buildingId,
      zoneId: input.buildingZoneId,
      credDefId: this.eidstack.references().credentialDefinitionId,
    });
    try {
      const result = await this.eidstack.createRiderProofRequest(
        riderProofPolicy(row.id, this.eidstack.references().credentialDefinitionId),
      );
      validateIssuerInvitation(result.invitation);
      const saved = await this.repository.setProof(row, result.proofRecordId);
      this.invitations.put(saved.id, result.invitation);
      return this.present(saved, result.invitation);
    } catch (error) {
      await this.repository.updateDecision(row, unavailableDecision(), null);
      throw error instanceof EidStackError ? error : new EidStackError('UPSTREAM_UNAVAILABLE');
    }
  }

  async buildings(actor: AuthenticatedActor) {
    return this.repository.listBuildings(this.scope(actor));
  }

  async get(actor: AuthenticatedActor, id: string): Promise<VerificationSession> {
    const row = await this.repository.find(this.scope(actor), id);
    return this.present(row, this.invitations.get(row.id));
  }

  async refresh(actor: AuthenticatedActor, id: string): Promise<VerificationSession> {
    const row = await this.repository.find(this.scope(actor), id);
    if (row.decision !== 'PENDING' || !row.proofRecordId) return this.present(row);
    if (row.expiresAt && Date.parse(row.expiresAt) <= Date.now()) {
      const saved = await this.repository.updateDecision(
        row,
        {
          decision: 'DENIED',
          reasons: ['PROOF_EXPIRED'],
          cryptographicVerification: 'FAIL',
          revocation: 'UNKNOWN',
          issuerTrust: 'UNKNOWN',
        },
        null,
      );
      this.invitations.remove(saved.id);
      return this.present(saved);
    }
    try {
      const proof = await this.eidstack.getProofStatus(row.proofRecordId);
      if (proof.state === 'PENDING') return this.present(row, this.invitations.get(row.id));
      const trust = proof.issuerDid
        ? await this.eidstack.checkIssuerTrust({
            did: proof.issuerDid,
            schemaId: this.eidstack.references().schemaId,
          })
        : null;
      const saved = await this.repository.updateDecision(
        row,
        decideVerification(proof, trust),
        proof.disclosedAttributes ?? null,
      );
      this.invitations.remove(saved.id);
      return this.present(saved);
    } catch {
      const saved = await this.repository.updateDecision(row, unavailableDecision(), null);
      this.invitations.remove(saved.id);
      return this.present(saved);
    }
  }

  private scope(actor: AuthenticatedActor): string {
    if (actor.role !== 'BUILDING_SECURITY' || !actor.organizationId)
      throw new ForbiddenException('Building security organization required');
    return actor.organizationId;
  }

  private present(row: VerificationRow, invitation?: string): VerificationSession {
    return {
      id: row.id,
      source: this.eidstack.technicalStatus().mode,
      buildingId: row.buildingId,
      buildingZoneId: row.buildingZoneId,
      ...(row.decision === 'PENDING' && invitation ? { invitation } : {}),
      state: row.state,
      decision: row.decision,
      reasons: row.reasons as VerificationSession['reasons'],
      disclosedAttributes: row.disclosedAttributes,
      cryptographicVerification: row.cryptographicVerification,
      revocation: row.revocation,
      issuerTrust: row.issuerTrust,
      expiresAt: row.expiresAt,
      accessPassId: row.accessPassId,
    };
  }
}
