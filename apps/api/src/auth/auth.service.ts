import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { AuthenticatedActor } from '@deligate/types';

import { SUPABASE_ADMIN_CLIENT } from '../infrastructure/supabase/supabase.tokens';
import { toAuthenticatedActor } from './domain/profile';
import { ProfileRepository } from './profile.repository';

@Injectable()
export class AuthService {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly supabase: SupabaseClient,
    private readonly profiles: ProfileRepository,
  ) {}

  async authenticate(accessToken: string): Promise<AuthenticatedActor> {
    const { data, error } = await this.supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired authentication session');
    }

    const profile = await this.profiles.findByUserId(data.user.id);

    if (!profile) {
      throw new UnauthorizedException('No application profile is assigned to this user');
    }

    return toAuthenticatedActor(data.user.id, profile);
  }
}
