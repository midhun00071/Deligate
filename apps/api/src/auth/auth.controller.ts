import { Controller, Get, UseGuards } from '@nestjs/common';

import type { AuthenticatedActor } from '@deligate/types';

import { CurrentActor } from './decorators/current-actor.decorator';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  getCurrentActor(@CurrentActor() actor: AuthenticatedActor): { actor: AuthenticatedActor } {
    return { actor };
  }
}
