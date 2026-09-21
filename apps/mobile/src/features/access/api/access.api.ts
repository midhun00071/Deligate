import { temporaryAccessSchema, type TemporaryAccess } from '@deligate/validation';
import { authenticatedJson } from '@/lib/api';
import { temporaryAccessPath } from './access.route';

export { temporaryAccessPath } from './access.route';

export async function issueTemporaryAccess(id: string): Promise<TemporaryAccess> {
  return temporaryAccessSchema.parse(await authenticatedJson(temporaryAccessPath(id), 'POST', {}));
}

export async function getTemporaryAccess(id: string): Promise<TemporaryAccess> {
  return temporaryAccessSchema.parse(await authenticatedJson(temporaryAccessPath(id)));
}
