import { securityOverviewSchema } from '@deligate/validation';
import { authenticatedJson } from '@/lib/api';

export async function getSecurityOverview() {
  return securityOverviewSchema.parse(await authenticatedJson('/api/security/verifications/overview'));
}
