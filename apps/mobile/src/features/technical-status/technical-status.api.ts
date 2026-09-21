import { technicalStatusSchema } from '@deligate/validation';
import { authenticatedJson } from '@/lib/api';

export async function getTechnicalStatus() {
  return technicalStatusSchema.parse(await authenticatedJson('/api/technical-status'));
}
