import { temporaryAccessSchema, type TemporaryAccess } from '@deligate/validation';
import { authenticatedJson } from '@/lib/api';

export async function issueTemporaryAccess(id: string): Promise<TemporaryAccess> {
  return temporaryAccessSchema.parse(
    await authenticatedJson(`/security/verifications/${encodeURIComponent(id)}/access`, 'POST', {}),
  );
}
