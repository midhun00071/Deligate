import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import { APP_ROLES, type AppRole } from '@deligate/types';

import { SUPABASE_ADMIN_CLIENT } from '../infrastructure/supabase/supabase.tokens';
import type { ApplicationProfile } from './domain/profile';

interface ProfileRow {
  id: string;
  organization_id: string | null;
  role: string;
  display_name: string;
}

@Injectable()
export class ProfileRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly supabase: SupabaseClient,
  ) {}

  async findByUserId(userId: string): Promise<ApplicationProfile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, organization_id, role, display_name')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException('Application profile lookup failed');
    }

    return parseProfile(data);
  }
}

function parseProfile(value: unknown): ApplicationProfile | null {
  if (value === null) {
    return null;
  }

  if (!isProfileRow(value) || !isAppRole(value.role)) {
    throw new ServiceUnavailableException('Application profile has an invalid role');
  }

  return {
    id: value.id,
    organizationId: value.organization_id,
    role: value.role,
    displayName: value.display_name,
  };
}

function isProfileRow(value: unknown): value is ProfileRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    (typeof value.organization_id === 'string' || value.organization_id === null) &&
    typeof value.role === 'string' &&
    typeof value.display_name === 'string'
  );
}

function isAppRole(value: string): value is AppRole {
  return APP_ROLES.some((role) => role === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
