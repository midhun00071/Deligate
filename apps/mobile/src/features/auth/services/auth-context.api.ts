import { APP_ROLES, type AuthenticatedActor } from '@deligate/types';

import { getJsonWithAccessToken } from '@/lib/api/client';

interface AuthContextResponse {
  actor: AuthenticatedActor;
}

export async function getCurrentActor(accessToken: string): Promise<AuthenticatedActor> {
  const response = await getJsonWithAccessToken('/api/auth/me', accessToken);

  if (!isAuthContextResponse(response)) {
    throw new Error('The API returned an invalid authentication context');
  }

  return response.actor;
}

function isAuthContextResponse(value: unknown): value is AuthContextResponse {
  if (!isRecord(value) || !isActor(value.actor)) {
    return false;
  }

  return true;
}

function isActor(value: unknown): value is AuthenticatedActor {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.userId === 'string' &&
    typeof value.profileId === 'string' &&
    isAppRole(value.role) &&
    (typeof value.organizationId === 'string' || value.organizationId === null) &&
    typeof value.displayName === 'string'
  );
}

function isAppRole(value: unknown): value is AuthenticatedActor['role'] {
  return typeof value === 'string' && APP_ROLES.some((role) => role === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
