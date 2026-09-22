import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { EidStackError, validateIssuerInvitation, type EidStackPort } from '@deligate/eidstack';
import type { AuthenticatedActor } from '@deligate/types';
import type { AccessInput, TemporaryAccess } from '@deligate/validation';
import { EIDSTACK_CONFIG, EIDSTACK_PORT } from '../eidstack/eidstack.module';
import type { EidStackConfig } from '@deligate/eidstack';
import { VerificationRepository } from '../verification/verification.repository';
import { AccessInvitationCache } from './access-invitation-cache';
import { createAccessWindow } from './domain/access-policy';
import { AccessRepository, type AccessRow } from './access.repository';

@Injectable()
export class AccessService {
  constructor(
    private readonly verifications: VerificationRepository,
    private readonly repository: AccessRepository,
    private readonly invitations: AccessInvitationCache,
    @Inject(EIDSTACK_PORT) private readonly eidstack: EidStackPort,
    @Inject(EIDSTACK_CONFIG) private readonly config: EidStackConfig,
  ) {}

  async issue(
    actor: AuthenticatedActor,
    verificationId: string,
    _input: AccessInput,
  ): Promise<TemporaryAccess> {
    const org = this.scope(actor);
    const session = await this.verifications.find(org, verificationId);
    if (session.decision !== 'ACCEPTED' || session.reasons.length || !session.disclosedAttributes)
      throw new ConflictException('Temporary access requires an accepted verification.');
    if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now())
      throw new ConflictException('This verification has expired. Create a new verification.');
    const window = createAccessWindow();
    const reserved = await this.repository.reserve({
      sessionId: session.id,
      buildingId: session.buildingId,
      zoneId: session.buildingZoneId,
      accessScope: 'BUILDING_ENTRY',
      ...window,
    });
    if (!reserved.created) return this.present(reserved.row);
    try {
      const result = await this.eidstack.issueTemporaryAccessCredential({
        requestId: reserved.row.id,
        claims: {
          accessId: reserved.row.id,
          buildingId: reserved.row.buildingId,
          accessScope: reserved.row.accessScope,
          ...window,
        },
      });
      if (result.source !== this.config.mode) throw new EidStackError('INVALID_RESPONSE');
      validateIssuerInvitation(result.invitation);
      const saved = await this.repository.complete({
        pass: reserved.row,
        org,
        mode: this.config.mode,
        schemaId: this.config.accessSchemaId || 'mock-deligate-access-schema-v1',
        credDefId: this.config.accessCredentialDefinitionId || 'mock-deligate-access-revocable-v1',
        exchangeId: result.credentialExchangeId,
      });
      await this.verifications.setAccessPass(session, saved.id);
      this.invitations.put(saved.id, result.invitation);
      return this.present(saved, result.invitation);
    } catch (error) {
      await this.repository.fail(reserved.row);
      throw error instanceof EidStackError ? error : new EidStackError('UPSTREAM_UNAVAILABLE');
    }
  }

  async get(actor: AuthenticatedActor, verificationId: string): Promise<TemporaryAccess> {
    await this.verifications.find(this.scope(actor), verificationId);
    const row = await this.repository.findBySession(verificationId);
    return this.present(row, this.invitations.get(row.id));
  }

  private scope(actor: AuthenticatedActor): string {
    if (actor.role !== 'BUILDING_SECURITY' || !actor.organizationId)
      throw new ForbiddenException('Building security organization required');
    if (
      this.config.mode === 'live' &&
      (!this.config.buildingOrganizationId ||
        actor.organizationId !== this.config.buildingOrganizationId)
    )
      throw new ForbiddenException('This organization has no configured access issuer tenant');
    return actor.organizationId;
  }

  private present(row: AccessRow, invitation?: string): TemporaryAccess {
    return {
      id: row.id,
      source: this.config.mode,
      status: row.status,
      buildingId: row.buildingId,
      buildingZoneId: row.buildingZoneId,
      accessScope: row.accessScope,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      ...(invitation ? { invitation } : {}),
    };
  }
}
