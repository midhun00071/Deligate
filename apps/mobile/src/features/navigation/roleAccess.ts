import type { AppRole } from '@deligate/types';

export function canAccessRole(actorRole: AppRole | null | undefined, requiredRole: AppRole): boolean {
  return actorRole === requiredRole;
}
