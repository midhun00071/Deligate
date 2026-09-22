import { ForbiddenException } from '@nestjs/common';
import { MockEidStackAdapter, readEidStackConfig } from '@deligate/eidstack';
import { VerificationService } from './verification.service';

const actor = {
  userId: 'user',
  profileId: 'profile',
  role: 'BUILDING_SECURITY' as const,
  organizationId: 'building-org',
  displayName: 'Building security',
};

function service(mode: 'mock' | 'live', organizationId = 'building-org') {
  const config = readEidStackConfig({
    EIDSTACK_MODE: mode,
    EIDSTACK_BUILDING_ORGANIZATION_ID: organizationId,
  });
  const repository = { listBuildings: jest.fn().mockResolvedValue([]) };
  const instance = new VerificationService(
    repository as never,
    {} as never,
    new MockEidStackAdapter(),
    config,
  );
  return { instance, repository };
}

describe('live building verifier binding', () => {
  it('rejects a different organization in live mode before repository access', async () => {
    const { instance, repository } = service('live');
    await expect(
      instance.buildings({ ...actor, organizationId: 'other-org' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.listBuildings).not.toHaveBeenCalled();
  });

  it('keeps mock building security scope unchanged', async () => {
    const { instance, repository } = service('mock');
    await expect(instance.buildings({ ...actor, organizationId: 'other-org' })).resolves.toEqual(
      [],
    );
    expect(repository.listBuildings).toHaveBeenCalledWith('other-org');
  });
});
