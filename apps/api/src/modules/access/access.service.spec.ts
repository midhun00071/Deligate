import { ForbiddenException } from '@nestjs/common';
import { MockEidStackAdapter, readEidStackConfig } from '@deligate/eidstack';
import { AccessService } from './access.service';

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
  return new AccessService(
    {} as never,
    {} as never,
    {} as never,
    new MockEidStackAdapter(),
    config,
  );
}

describe('live building access binding', () => {
  it('rejects a different organization before temporary access issuance', async () => {
    const instance = service('live');
    await expect(
      instance.issue({ ...actor, organizationId: 'other-org' }, 'verification', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps mock organization scope unchanged', () => {
    const instance = service('mock');
    expect(instance['scope']({ ...actor, organizationId: 'other-org' })).toBe('other-org');
  });
});
