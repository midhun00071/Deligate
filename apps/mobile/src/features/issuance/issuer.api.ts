import {
  issuerOverviewSchema,
  riderDetailSchema,
  riderInputSchema,
  riderListSchema,
  riderSchema,
  type RiderInput,
  type RiderQuery,
} from '@deligate/validation';
import { authenticatedJson } from '@/lib/api/client';

export const issuerApi = {
  async list(query: RiderQuery) {
    const search = new URLSearchParams({
      search: query.search,
      page: String(query.page),
      limit: String(query.limit),
    });
    if (query.status) search.set('status', query.status);
    return riderListSchema.parse(await authenticatedJson(`/api/riders?${search}`));
  },
  async overview() {
    return issuerOverviewSchema.parse(await authenticatedJson('/api/riders/overview'));
  },
  async detail(id: string) {
    return riderDetailSchema.parse(await authenticatedJson(`/api/riders/${id}`));
  },
  async save(input: RiderInput, id?: string) {
    const body = riderInputSchema.parse(input);
    return riderSchema.parse(
      await authenticatedJson(`/api/riders${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', body),
    );
  },
  async action(id: string, action: 'issuance' | 'refresh' | 'revoke') {
    return riderDetailSchema.parse(
      await authenticatedJson(
        `/api/riders/${id}/${action}`,
        'POST',
        action === 'revoke' ? { confirmed: true } : undefined,
      ),
    );
  },
};
