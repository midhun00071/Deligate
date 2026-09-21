import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@deligate/types';
import type { RiderInput, RiderQuery } from '@deligate/validation';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { CredentialService } from '../credentials/credential.service';
import { IssuerErrorFilter } from '../credentials/issuer-error.filter';
import { IssuerOverviewRepository } from '../credentials/issuer-overview.repository';
import { RevokeInputPipe, RiderInputPipe, RiderQueryPipe } from './issuer.dto';
import { RiderService } from './rider.service';

@Controller('riders')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('DELIVERY_ADMIN')
@UseFilters(IssuerErrorFilter)
export class RiderController {
  constructor(
    private readonly riders: RiderService,
    private readonly credentials: CredentialService,
    private readonly overview: IssuerOverviewRepository,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentActor() actor: AuthenticatedActor, @Query(RiderQueryPipe) query: RiderQuery) {
    return this.riders.list(actor, query);
  }

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  async dashboard(@CurrentActor() actor: AuthenticatedActor) {
    const org = await this.riders.scope(actor);
    const status = await this.credentials.technicalStatus(actor);
    return this.overview.read(org, status.mode);
  }

  @Get('technical-status')
  @Header('Cache-Control', 'no-store')
  technicalStatus(@CurrentActor() actor: AuthenticatedActor) {
    return this.credentials.technicalStatus(actor);
  }

  @Post()
  create(@CurrentActor() actor: AuthenticatedActor, @Body(RiderInputPipe) input: RiderInput) {
    return this.riders.create(actor, input);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.credentials.detail(actor, id);
  }

  @Patch(':id')
  update(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(RiderInputPipe) input: RiderInput,
  ) {
    return this.riders.update(actor, id, input);
  }

  @Post(':id/issuance')
  @Header('Cache-Control', 'no-store')
  issue(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.credentials.issue(actor, id);
  }

  @Post(':id/refresh')
  @Header('Cache-Control', 'no-store')
  refresh(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.credentials.refresh(actor, id);
  }

  @Post(':id/revoke')
  revoke(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(RevokeInputPipe) _input: { confirmed: true },
  ) {
    return this.credentials.revoke(actor, id);
  }
}
