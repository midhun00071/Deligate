import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@deligate/types';
import type { VerificationInput } from '@deligate/validation';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { IssuerErrorFilter } from '../credentials/issuer-error.filter';
import { VerificationInputPipe } from './verification.dto';
import { VerificationService } from './verification.service';
import { SecurityOverviewRepository } from './security-overview.repository';

@Controller('security/verifications')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('BUILDING_SECURITY')
@UseFilters(IssuerErrorFilter)
export class VerificationController {
  constructor(
    private readonly verifications: VerificationService,
    private readonly overviewRepository: SecurityOverviewRepository,
  ) {}

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  getOverview(@CurrentActor() actor: AuthenticatedActor) {
    return this.overviewRepository.read(actor.organizationId!);
  }

  @Get('buildings')
  @Header('Cache-Control', 'no-store')
  buildings(@CurrentActor() actor: AuthenticatedActor) {
    return this.verifications.buildings(actor);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @CurrentActor() actor: AuthenticatedActor,
    @Body(VerificationInputPipe) body: VerificationInput,
  ) {
    return this.verifications.create(actor, body);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.verifications.get(actor, id);
  }

  @Post(':id/refresh')
  @Header('Cache-Control', 'no-store')
  refresh(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.verifications.refresh(actor, id);
  }
}
