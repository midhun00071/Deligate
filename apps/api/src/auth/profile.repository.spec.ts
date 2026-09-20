import { ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ProfileRepository } from './profile.repository';

describe('ProfileRepository', () => {
  it('maps the application profile returned for an auth user', async () => {
    const repository = new ProfileRepository(
      createSupabaseClient({
        id: 'user-1',
        organization_id: 'organization-1',
        role: 'BUILDING_SECURITY',
        display_name: 'Security Officer',
      }),
    );

    await expect(repository.findByUserId('user-1')).resolves.toEqual({
      id: 'user-1',
      organizationId: 'organization-1',
      role: 'BUILDING_SECURITY',
      displayName: 'Security Officer',
    });
  });

  it('returns null when no application profile exists', async () => {
    const repository = new ProfileRepository(createSupabaseClient(null));

    await expect(repository.findByUserId('user-1')).resolves.toBeNull();
  });

  it('propagates a safe failure when Supabase cannot read profiles', async () => {
    const repository = new ProfileRepository(
      createSupabaseClient(null, { message: 'database unavailable' }),
    );

    await expect(repository.findByUserId('user-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

function createSupabaseClient(
  data: unknown,
  error: { message: string } | null = null,
): SupabaseClient {
  const maybeSingle = jest.fn().mockResolvedValue({ data, error });
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });

  return {
    from: jest.fn().mockReturnValue({ select }),
  } as unknown as SupabaseClient;
}
