import { Test } from '@nestjs/testing';
import {
  EidStackError,
  MockEidStackAdapter,
  readEidStackConfig,
  type EidStackPort,
} from '@deligate/eidstack';
import { CredentialService } from './credential.service';
import { CredentialRepository } from './credential.repository';
import { InvitationCache } from './invitation-cache';
import { RiderRepository } from '../riders/rider.repository';
import { RiderService } from '../riders/rider.service';
import { EIDSTACK_CONFIG, EIDSTACK_PORT } from '../eidstack/eidstack.module';
import { actor, issuerRepositories, rider } from '../../../test/issuer.fixture';

async function setup(
  adapter: EidStackPort = new MockEidStackAdapter({ now: () => Date.now() + 11000 }),
) {
  const repos = issuerRepositories();
  const config = readEidStackConfig({ EIDSTACK_MODE: 'mock' });
  const module = await Test.createTestingModule({
    providers: [
      CredentialService,
      RiderService,
      InvitationCache,
      { provide: RiderRepository, useValue: repos.riderRepo },
      { provide: CredentialRepository, useValue: repos.credentialRepo },
      { provide: EIDSTACK_PORT, useValue: adapter },
      { provide: EIDSTACK_CONFIG, useValue: config },
    ],
  }).compile();
  return { service: module.get(CredentialService), ...repos, adapter, config };
}

describe('issuer workflow', () => {
  it('issues, preserves exact invitation, persists references only, refreshes and revokes', async () => {
    const { service, getCredential, credentialRepo } = await setup();
    const offered = await service.issue(actor, rider.id);
    expect(offered.credential?.state).toBe('AWAITING_WALLET');
    expect(offered.invitation).toBe(
      `https://wallet-simulation.invalid/offer/mock-${offered.credential?.id}`,
    );
    expect(await service.detail(actor, rider.id)).toEqual(offered);
    expect((await service.refresh(actor, rider.id)).credential?.state).toBe('ISSUED');
    expect((await service.revoke(actor, rider.id)).credential?.state).toBe('REVOKED');
    expect((await service.revoke(actor, rider.id)).credential?.state).toBe('REVOKED');
    expect((await service.detail(actor, rider.id)).invitation).toBeUndefined();
    expect(JSON.stringify(getCredential())).not.toMatch(
      /invitation|privateKey|rawCredential|claims|proof/,
    );
    expect(credentialRepo.reserve).toHaveBeenCalledTimes(1);
  });

  it('does not create another offer on repeated or concurrent requests', async () => {
    const { service, adapter } = await setup();
    const issue = jest.spyOn(adapter, 'issueRiderCredential');
    await Promise.allSettled([service.issue(actor, rider.id), service.issue(actor, rider.id)]);
    await service.issue(actor, rider.id);
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it('persists a definite issuance failure and surfaces the error', async () => {
    const { service, getCredential } = await setup(new MockEidStackAdapter({ fail: 'issue' }));
    await expect(service.issue(actor, rider.id)).rejects.toBeInstanceOf(EidStackError);
    expect(getCredential()).toMatchObject({
      state: 'FAILED',
      errorCode: 'UPSTREAM_REJECTED',
      credentialExchangeId: null,
    });
  });

  it('keeps a timeout outcome unknown and prevents an automatic retry', async () => {
    const { service, adapter, getCredential } = await setup();
    const issue = jest
      .spyOn(adapter, 'issueRiderCredential')
      .mockRejectedValue(new EidStackError('UPSTREAM_TIMEOUT'));
    await expect(service.issue(actor, rider.id)).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
    });
    expect(getCredential()?.state).toBe('UNKNOWN');
    await service.issue(actor, rider.id);
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it('leaves a reservation after successful upstream action but failed persistence', async () => {
    const { service, credentialRepo, adapter, getCredential } = await setup();
    const issue = jest.spyOn(adapter, 'issueRiderCredential');
    credentialRepo.update.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.issue(actor, rider.id)).rejects.toThrow('database unavailable');
    expect(getCredential()?.state).toBe('REQUESTING');
    await service.issue(actor, rider.id);
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it('does not mark revoked on adapter failure and blocks duplicate revoke while uncertain', async () => {
    const { service, adapter, getCredential } = await setup();
    await service.issue(actor, rider.id);
    await service.refresh(actor, rider.id);
    const revoke = jest
      .spyOn(adapter, 'revokeCredential')
      .mockRejectedValue(new EidStackError('UPSTREAM_UNAVAILABLE'));
    await expect(service.revoke(actor, rider.id)).rejects.toThrow(EidStackError);
    expect(getCredential()).toMatchObject({
      state: 'ISSUED',
      revocationPending: true,
      revokedAt: null,
    });
    await expect(service.revoke(actor, rider.id)).rejects.toThrow(/pending reconciliation/);
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it('denies cross-organization access and non-admin actors before adapter calls', async () => {
    const { service, adapter } = await setup();
    const issue = jest.spyOn(adapter, 'issueRiderCredential');
    await expect(service.issue({ ...actor, organizationId: 'other' }, rider.id)).rejects.toThrow();
    await expect(service.issue({ ...actor, role: 'RIDER' }, rider.id)).rejects.toThrow();
    expect(issue).not.toHaveBeenCalled();
  });

  it('retains the pending state when status retrieval fails', async () => {
    const { service, adapter, getCredential } = await setup();
    await service.issue(actor, rider.id);
    jest
      .spyOn(adapter, 'getIssuanceStatus')
      .mockRejectedValue(new EidStackError('UPSTREAM_UNAVAILABLE'));
    await expect(service.refresh(actor, rider.id)).rejects.toThrow(EidStackError);
    expect(getCredential()?.state).toBe('AWAITING_WALLET');
  });

  it('submits only one revoke command for concurrent confirmations', async () => {
    const { service, adapter } = await setup();
    await service.issue(actor, rider.id);
    await service.refresh(actor, rider.id);
    const revoke = jest.spyOn(adapter, 'revokeCredential');
    await Promise.allSettled([service.revoke(actor, rider.id), service.revoke(actor, rider.id)]);
    expect(revoke).toHaveBeenCalledTimes(1);
    expect((await service.detail(actor, rider.id)).credential?.state).toBe('REVOKED');
  });

  it('rejects a mismatched adapter source and refuses inactive riders', async () => {
    const { service, adapter, riderRepo } = await setup();
    riderRepo.find.mockResolvedValueOnce({ ...rider, employmentStatus: 'SUSPENDED' });
    await expect(service.issue(actor, rider.id)).rejects.toThrow(/Only active riders/);
    jest
      .spyOn(adapter, 'issueRiderCredential')
      .mockResolvedValue({
        source: 'live',
        state: 'AWAITING_WALLET',
        credentialExchangeId: 'foreign',
        invitation: 'https://wallet.example/exact',
      });
    await expect(service.issue(actor, rider.id)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    expect((await service.detail(actor, rider.id)).invitation).toBeUndefined();
  });

  it('cannot reuse persisted mock issuance as a live result after switching mode', async () => {
    const { service, config } = await setup();
    await service.issue(actor, rider.id);
    config.mode = 'live';
    config.organizationId = rider.organizationId;
    await expect(service.issue(actor, rider.id)).rejects.toThrow(/different issuer configuration/);
    await expect(service.refresh(actor, rider.id)).rejects.toThrow(
      /different issuer configuration/,
    );
    expect((await service.detail(actor, rider.id)).invitation).toBeUndefined();
  });
});
