import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedActor } from '@deligate/types';
import type { ActivityQuery } from '@deligate/validation';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { ActivityQueryPipe } from './activity.dto';
import { ActivityRepository } from './activity.repository';

@Controller('activity')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('DELIVERY_ADMIN', 'BUILDING_SECURITY')
export class ActivityController {
  constructor(private readonly activity: ActivityRepository) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Query(ActivityQueryPipe) query: ActivityQuery,
  ) {
    if (!actor.organizationId)
      return { events: [], page: query.page, limit: query.limit, total: 0 };
    return this.activity.list(actor.organizationId, query);
  }
}
