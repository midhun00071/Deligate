import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { SUPABASE_ADMIN_CLIENT } from '../../infrastructure/supabase/supabase.tokens';

const eventSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  created_at: z.string(),
});

@Injectable()
export class SecurityOverviewRepository {
  constructor(@Inject(SUPABASE_ADMIN_CLIENT) private readonly db: SupabaseClient) {}

  async read(organizationId: string) {
    const [pending, accepted, denied, accesses, events] = await Promise.all([
      this.db
        .from('verification_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('verifier_organization_id', organizationId)
        .eq('decision_status', 'PENDING'),
      this.db
        .from('verification_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('verifier_organization_id', organizationId)
        .eq('decision_status', 'ACCEPTED'),
      this.db
        .from('verification_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('verifier_organization_id', organizationId)
        .eq('decision_status', 'DENIED'),
      this.db
        .from('access_passes')
        .select('id,verification_sessions!inner(verifier_organization_id)', {
          count: 'exact',
          head: true,
        })
        .eq('verification_sessions.verifier_organization_id', organizationId)
        .eq('status', 'ISSUED'),
      this.db
        .from('audit_events')
        .select('id,event_type,created_at')
        .eq('organization_id', organizationId)
        .in('entity_type', ['verification_session', 'access_pass'])
        .order('created_at', { ascending: false })
        .limit(5),
    ]);
    if ([pending, accepted, denied, accesses, events].some((item) => item.error))
      throw new ServiceUnavailableException('Security overview unavailable.');
    const recent = eventSchema
      .array()
      .parse(events.data ?? [])
      .map((row) => ({
        id: row.id,
        eventType: row.event_type,
        createdAt: row.created_at,
      }));
    return {
      pending: pending.count ?? 0,
      accepted: accepted.count ?? 0,
      denied: denied.count ?? 0,
      issuedAccesses: accesses.count ?? 0,
      recent,
    };
  }
}
