import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  riderSchema,
  issuerStateSchema,
  type Rider,
  type RiderInput,
  type RiderQuery,
} from '@deligate/validation';
import { z } from 'zod';
import { SUPABASE_ADMIN_CLIENT } from '../../infrastructure/supabase/supabase.tokens';

const columns = 'id, employee_reference, employment_status, employer_organization_id, created_at';
const rowSchema = z.object({
  id: z.string(),
  employee_reference: z.string().nullable(),
  employment_status: z.string(),
  employer_organization_id: z.string(),
  created_at: z.string(),
});

function mapRider(value: unknown): Rider {
  const row = rowSchema.parse(value);
  return riderSchema.parse({
    id: row.id,
    employeeReference: row.employee_reference ?? '',
    employmentStatus: row.employment_status,
    organizationId: row.employer_organization_id,
    createdAt: row.created_at,
  });
}

@Injectable()
export class RiderRepository {
  constructor(@Inject(SUPABASE_ADMIN_CLIENT) private readonly db: SupabaseClient) {}

  async assertDeliveryCompany(organizationId: string): Promise<void> {
    const { data, error } = await this.db
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .eq('type', 'DELIVERY_COMPANY')
      .maybeSingle();
    if (error) throw new ServiceUnavailableException('Organization lookup unavailable');
    if (!data) throw new NotFoundException('Delivery organization unavailable');
  }

  async list(organizationId: string, query: RiderQuery) {
    let request = this.db
      .from('riders')
      .select(columns, { count: 'exact' })
      .eq('employer_organization_id', organizationId);
    if (query.search)
      request = request.ilike('employee_reference', `%${query.search.replaceAll('_', '\\_')}%`);
    if (query.status) request = request.eq('employment_status', query.status);
    const start = (query.page - 1) * query.limit;
    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .order('id')
      .range(start, start + query.limit - 1);
    if (error) throw new ServiceUnavailableException('Rider list unavailable');
    const riders = (data ?? []).map(mapRider);
    const credentialRows = riders.length
      ? await this.db
          .from('credential_records')
          .select('rider_id,issuer_state,source_mode')
          .eq('issuer_organization_id', organizationId)
          .eq('kind', 'VERIFIED_RIDER')
          .not('issuer_state', 'is', null)
          .in(
            'rider_id',
            riders.map((rider) => rider.id),
          )
      : { data: [], error: null };
    if (credentialRows.error)
      throw new ServiceUnavailableException('Credential summaries unavailable');
    const states = z
      .array(
        z.object({
          rider_id: z.string(),
          issuer_state: issuerStateSchema,
          source_mode: z.enum(['mock', 'live']),
        }),
      )
      .parse(credentialRows.data);
    return {
      riders: riders.map((rider) => {
        const credential = states.find((state) => state.rider_id === rider.id);
        return {
          ...rider,
          credentialState: credential?.issuer_state ?? null,
          credentialSource: credential?.source_mode ?? null,
        };
      }),
      total: count ?? 0,
      page: query.page,
      limit: query.limit,
    };
  }

  async find(organizationId: string, id: string): Promise<Rider> {
    const { data, error } = await this.db
      .from('riders')
      .select(columns)
      .eq('employer_organization_id', organizationId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException('Rider lookup unavailable');
    if (!data) throw new NotFoundException('Rider not found');
    return mapRider(data);
  }

  async create(organizationId: string, input: RiderInput): Promise<Rider> {
    const { data, error } = await this.db
      .from('riders')
      .insert({
        employer_organization_id: organizationId,
        employee_reference: input.employeeReference,
        employment_status: input.employmentStatus,
      })
      .select(columns)
      .single();
    if (error) throw new ServiceUnavailableException('Rider creation failed');
    return mapRider(data);
  }

  async update(organizationId: string, id: string, input: RiderInput): Promise<Rider> {
    const { data, error } = await this.db
      .from('riders')
      .update({
        employee_reference: input.employeeReference,
        employment_status: input.employmentStatus,
      })
      .eq('employer_organization_id', organizationId)
      .eq('id', id)
      .select(columns)
      .maybeSingle();
    if (error) throw new ServiceUnavailableException('Rider update failed');
    if (!data) throw new NotFoundException('Rider not found');
    return mapRider(data);
  }
}
