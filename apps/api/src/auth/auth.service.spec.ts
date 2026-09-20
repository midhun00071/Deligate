import { UnauthorizedException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { AuthService } from './auth.service';
import type { ApplicationProfile } from './domain/profile';
import { ProfileRepository } from './profile.repository';

describe('AuthService', () => {
  const profile: ApplicationProfile = {
    id: 'user-1',
    organizationId: 'organization-1',
    role: 'DELIVERY_ADMIN',
    displayName: 'Delivery Admin',
  };

  it('resolves a typed application actor from a valid Supabase user', async () => {
    const supabase = createSupabaseClient({ id: 'user-1' });
    const profiles = createProfileRepository(profile);
    const service = new AuthService(supabase, profiles);

    await expect(service.authenticate('valid-token')).resolves.toEqual({
      userId: 'user-1',
      profileId: 'user-1',
      role: 'DELIVERY_ADMIN',
      organizationId: 'organization-1',
      displayName: 'Delivery Admin',
    });
  });

  it('rejects an invalid Supabase token', async () => {
    const supabase = createSupabaseClient(null, 'Token is invalid');
    const service = new AuthService(supabase, createProfileRepository(profile));

    await expect(service.authenticate('invalid-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('fails closed when the Supabase user has no application profile', async () => {
    const supabase = createSupabaseClient({ id: 'user-1' });
    const service = new AuthService(supabase, createProfileRepository(null));

    await expect(service.authenticate('valid-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function createSupabaseClient(user: { id: string } | null, errorMessage?: string): SupabaseClient {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: errorMessage ? { message: errorMessage } : null,
      }),
    },
  } as unknown as SupabaseClient;
}

function createProfileRepository(profile: ApplicationProfile | null): ProfileRepository {
  return {
    findByUserId: jest.fn().mockResolvedValue(profile),
  } as unknown as ProfileRepository;
}
