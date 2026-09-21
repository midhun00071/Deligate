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
import type { AccessInput } from '@deligate/validation';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { IssuerErrorFilter } from '../credentials/issuer-error.filter';
import { AccessInputPipe } from './access.dto';
import { AccessService } from './access.service';

@Controller('security/verifications/:verificationId/access')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('BUILDING_SECURITY')
@UseFilters(IssuerErrorFilter)
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  issue(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('verificationId', ParseUUIDPipe) verificationId: string,
    @Body(AccessInputPipe) body: AccessInput,
  ) {
    return this.access.issue(actor, verificationId, body);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('verificationId', ParseUUIDPipe) verificationId: string,
  ) {
    return this.access.get(actor, verificationId);
  }
}
