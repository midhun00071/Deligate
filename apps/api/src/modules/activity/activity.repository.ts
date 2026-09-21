import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  activityPageSchema,
  type ActivityPage,
  type ActivityQuery,
} from '@deligate/validation';
import { SUPABASE_ADMIN_CLIENT } from '../../infrastructure/supabase/supabase.tokens';

type AuditRow = {
  id: string;
  event_type: string;
  entity_type: string;
  metadata: { errorCode?: string } | null;
  created_at: string;
};

export function classifyActivityResult(
  event: string,
  metadata: AuditRow['metadata'],
): 'completed' | 'pending' | 'denied' | 'failed' {
  if (metadata?.errorCode || event.endsWith('_FAILED')) return 'failed';
  if (event.includes('DENIED')) return 'denied';
  if (event.includes('REQUEST') || event.includes('AWAITING')) return 'pending';
  return 'completed';
}

@Injectable()
export class ActivityRepository {
  constructor(@Inject(SUPABASE_ADMIN_CLIENT) private readonly db: SupabaseClient) {}

  async list(organizationId: string, query: ActivityQuery): Promise<ActivityPage> {
    const start = (query.page - 1) * query.limit;
    const { data, error, count } = await this.db
      .from('audit_events')
      .select('id,event_type,entity_type,metadata,created_at', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(start, start + query.limit - 1);
    if (error) throw new ServiceUnavailableException('Activity is unavailable.');
    const events = ((data ?? []) as AuditRow[]).map((row) => ({
      id: row.id,
      action: row.event_type.replaceAll('_', ' ').toLowerCase(),
      target: row.entity_type.replaceAll('_', ' '),
      result: classifyActivityResult(row.event_type, row.metadata),
      createdAt: row.created_at,
    }));
    return activityPageSchema.parse({
      events,
      page: query.page,
      limit: query.limit,
      total: count ?? 0,
    });
  }
}
