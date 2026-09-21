import {
  securityBuildingListSchema,
  verificationSessionSchema,
  type VerificationInput,
  type VerificationSession,
} from '@deligate/validation';
import { authenticatedJson } from '@/lib/api';

export async function createVerification(input: VerificationInput): Promise<VerificationSession> {
  return verificationSessionSchema.parse(
    await authenticatedJson('/api/security/verifications', 'POST', input),
  );
}

export async function listSecurityBuildings() {
  return securityBuildingListSchema.parse(
    await authenticatedJson('/api/security/verifications/buildings'),
  );
}

export async function refreshVerification(id: string): Promise<VerificationSession> {
  return verificationSessionSchema.parse(
    await authenticatedJson(
      `/api/security/verifications/${encodeURIComponent(id)}/refresh`,
      'POST',
    ),
  );
}

export async function getVerification(id: string): Promise<VerificationSession> {
  return verificationSessionSchema.parse(
    await authenticatedJson(`/api/security/verifications/${encodeURIComponent(id)}`),
  );
}
