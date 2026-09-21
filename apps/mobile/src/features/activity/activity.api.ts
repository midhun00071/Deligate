import { activityPageSchema } from '@deligate/validation';
import { authenticatedJson } from '@/lib/api';

export async function getActivity() {
  return activityPageSchema.parse(await authenticatedJson('/api/activity?page=1&limit=5'));
}
