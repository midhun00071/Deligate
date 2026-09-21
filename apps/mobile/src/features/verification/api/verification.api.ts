import {
  securityBuildingListSchema,
  verificationSessionSchema,
  type VerificationInput,
  type VerificationSession,
} from '@deligate/validation';
import { authenticatedJson } from '@/lib/api';

export async function createVerification(input: VerificationInput): Promise<VerificationSession> {
  return verificationSessionSchema.parse(
    await authenticatedJson('/security/verifications', 'POST', input),
  );
}

export async function listSecurityBuildings() {
  return securityBuildingListSchema.parse(
    await authenticatedJson('/security/verifications/buildings'),
  );
}

export async function refreshVerification(id: string): Promise<VerificationSession> {
  return verificationSessionSchema.parse(
    await authenticatedJson(`/security/verifications/${encodeURIComponent(id)}/refresh`, 'POST'),
  );
}
