import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  EidStackError,
  validateIssuerInvitation,
  type EidStackConfig,
  type EidStackPort,
} from '@deligate/eidstack';
import type { AuthenticatedActor } from '@deligate/types';
import type { CredentialRecord, RiderDetail } from '@deligate/validation';
import { EIDSTACK_CONFIG, EIDSTACK_PORT } from '../eidstack/eidstack.module';
import { RiderService } from '../riders/rider.service';
import { CredentialRepository } from './credential.repository';
import { InvitationCache } from './invitation-cache';

@Injectable()
export class CredentialService {
  constructor(
    private readonly riders: RiderService,
    private readonly repository: CredentialRepository,
    private readonly invitations: InvitationCache,
    @Inject(EIDSTACK_PORT) private readonly issuer: EidStackPort,
    @Inject(EIDSTACK_CONFIG) private readonly config: EidStackConfig,
  ) {}

  async detail(actor: AuthenticatedActor, id: string): Promise<RiderDetail> {
    const rider = await this.riders.find(actor, id);
    const credential = await this.repository.find(rider.organizationId, id);
    return { rider, credential, ...this.invitationFor(credential) };
  }

  async issue(actor: AuthenticatedActor, id: string): Promise<RiderDetail> {
    const detail = await this.detail(actor, id);
    this.assertIssuerScope(detail.rider.organizationId, detail.credential ?? undefined);
    if (detail.credential) return detail; // Never create a second offer on a retry.
    if (detail.rider.employmentStatus !== 'ACTIVE')
      throw new ConflictException('Only active riders can receive an offer');
    this.issuer.assertIssuanceReady();
    const validUntil = new Date(Date.now() + 90 * 86400000).toISOString();
    const record = await this.repository.reserve(
      detail.rider.organizationId,
      id,
      actor.profileId,
      this.config.mode,
      this.issuer.references(),
      validUntil,
    );
    let result;
    try {
      result = await this.issuer.issueRiderCredential({
        requestId: record.id,
        claims: {
          riderId: id,
          deliveryCompany: detail.rider.organizationId,
          riderStatus: 'ACTIVE',
          validFrom: record.requestedAt,
          validUntil,
        },
      });
      if (result.source !== this.config.mode) throw new EidStackError('INVALID_RESPONSE');
      validateIssuerInvitation(result.invitation);
    } catch (error) {
      const knownFailure = error instanceof EidStackError && error.code === 'UPSTREAM_REJECTED';
      await this.repository.update(detail.rider.organizationId, record, actor.profileId, {
        state: knownFailure ? 'FAILED' : 'UNKNOWN',
        errorCode: error instanceof EidStackError ? error.code : 'ISSUANCE_FAILED',
      });
      throw error instanceof EidStackError ? error : new EidStackError('UPSTREAM_UNAVAILABLE');
    }
    // A persistence failure after an upstream success leaves REQUESTING reserved.
    // Retrying cannot create another offer. The operator must reconcile it.
    const credential = await this.repository.update(
      detail.rider.organizationId,
      record,
      actor.profileId,
      { state: result.state, exchangeId: result.credentialExchangeId, errorCode: null },
    );
    this.invitations.put(credential.id, result.invitation);
    return { rider: detail.rider, credential, invitation: result.invitation };
  }

  async refresh(actor: AuthenticatedActor, id: string): Promise<RiderDetail> {
    const detail = await this.detail(actor, id);
    const record = detail.credential;
    if (record) this.assertIssuerScope(detail.rider.organizationId, record);
    if (!record || record.state !== 'AWAITING_WALLET' || !record.credentialExchangeId)
      return detail;
    const state = await this.issuer.getIssuanceStatus({
      credentialExchangeId: record.credentialExchangeId,
      requestedAt: record.requestedAt,
    });
    if (state === record.state) return detail;
    const credential = await this.repository.update(
      detail.rider.organizationId,
      record,
      actor.profileId,
      {
        state,
        ...(state === 'ISSUED' ? { issuedAt: new Date().toISOString() } : {}),
      },
    );
    this.invitations.remove(record.id);
    return { rider: detail.rider, credential, ...this.invitationFor(credential) };
  }

  async revoke(actor: AuthenticatedActor, id: string): Promise<RiderDetail> {
    const detail = await this.detail(actor, id);
    const record = detail.credential;
    if (!record) throw new ConflictException('No issued credential exists');
    this.assertIssuerScope(detail.rider.organizationId, record);
    if (record.state === 'REVOKED') return detail;
    if (record.state !== 'ISSUED' || !record.credentialExchangeId)
      throw new ConflictException('The credential is not issued');
    if (record.revocationSupported !== true) throw new EidStackError('REVOCATION_UNAVAILABLE');
    if (record.revocationPending)
      throw new ConflictException('Revocation is pending reconciliation. Do not submit it again.');
    const locked = await this.repository.update(
      detail.rider.organizationId,
      record,
      actor.profileId,
      { revocationPending: true, errorCode: null },
    );
    try {
      await this.issuer.revokeCredential(record.credentialExchangeId);
    } catch (error) {
      // Rejections can include already-revoked: preserve prior state and require reconciliation.
      await this.repository.update(detail.rider.organizationId, locked, actor.profileId, {
        errorCode: error instanceof EidStackError ? error.code : 'REVOCATION_FAILED',
      });
      throw error instanceof EidStackError ? error : new EidStackError('UPSTREAM_UNAVAILABLE');
    }
    const credential = await this.repository.update(
      detail.rider.organizationId,
      locked,
      actor.profileId,
      { state: 'REVOKED', revokedAt: new Date().toISOString(), revocationPending: false },
    );
    this.invitations.remove(record.id);
    return { rider: detail.rider, credential };
  }

  async technicalStatus(actor: AuthenticatedActor) {
    await this.riders.scope(actor);
    return this.issuer.technicalStatus();
  }

  private assertIssuerScope(org: string, record?: CredentialRecord): void {
    if (this.config.mode === 'live' && !this.config.organizationId)
      throw new EidStackError('CONFIGURATION_UNAVAILABLE');
    if (this.config.mode === 'live' && org !== this.config.organizationId)
      throw new ForbiddenException('This organization has no configured issuer tenant');
    if (
      record &&
      (record.source !== this.config.mode ||
        record.credentialDefinitionId !== this.issuer.references().credentialDefinitionId)
    ) {
      throw new ConflictException('This record belongs to a different issuer configuration');
    }
  }

  private invitationFor(record: CredentialRecord | null): { invitation?: string } {
    if (!record || record.source !== this.config.mode || record.state !== 'AWAITING_WALLET')
      return {};
    const invitation = this.invitations.get(record.id);
    return invitation ? { invitation } : {};
  }
}
