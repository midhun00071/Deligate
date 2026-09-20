import type { AppRole, AuthenticatedActor } from '@deligate/types';

export interface ApplicationProfile {
  id: string;
  organizationId: string | null;
  role: AppRole;
  displayName: string;
}

export function toAuthenticatedActor(
  userId: string,
  profile: ApplicationProfile,
): AuthenticatedActor {
  return {
    userId,
    profileId: profile.id,
    role: profile.role,
    organizationId: profile.organizationId,
    displayName: profile.displayName,
  };
}
