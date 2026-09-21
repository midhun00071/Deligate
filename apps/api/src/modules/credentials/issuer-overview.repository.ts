import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { issuerOverviewSchema } from '@deligate/validation';
import type { EidStackMode } from '@deligate/eidstack';
import { z } from 'zod';
import { SUPABASE_ADMIN_CLIENT } from '../../infrastructure/supabase/supabase.tokens';

@Injectable()
export class IssuerOverviewRepository {
  constructor(@Inject(SUPABASE_ADMIN_CLIENT) private readonly db: SupabaseClient) {}

  async read(org: string, mode: EidStackMode) {
    const [riders, issued, revoked, events] = await Promise.all([
      this.db
        .from('riders')
        .select('id', { head: true, count: 'exact' })
        .eq('employer_organization_id', org)
        .eq('employment_status', 'ACTIVE'),
      this.db
        .from('credential_records')
        .select('id', { head: true, count: 'exact' })
        .eq('issuer_organization_id', org)
        .eq('source_mode', mode)
        .eq('issuer_state', 'ISSUED'),
      this.db
        .from('credential_records')
        .select('id', { head: true, count: 'exact' })
        .eq('issuer_organization_id', org)
        .eq('source_mode', mode)
        .eq('issuer_state', 'REVOKED'),
      this.db
        .from('audit_events')
        .select('id,event_type,created_at')
        .eq('organization_id', org)
        .eq('entity_type', 'rider_credential')
        .eq('metadata->>source', mode)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);
    if ([riders, issued, revoked, events].some((result) => result.error))
      throw new ServiceUnavailableException('Issuer overview unavailable');
    const rows = z
      .array(z.object({ id: z.string(), event_type: z.string(), created_at: z.string() }))
      .parse(events.data ?? []);
    return issuerOverviewSchema.parse({
      activeRiders: riders.count ?? 0,
      issued: issued.count ?? 0,
      revoked: revoked.count ?? 0,
      mode,
      recent: rows.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        createdAt: row.created_at,
      })),
    });
  }
}
