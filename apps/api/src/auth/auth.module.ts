import { Module } from '@nestjs/common';

import { SupabaseModule } from '../infrastructure/supabase/supabase.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { ProfileRepository } from './profile.repository';

@Module({
  imports: [SupabaseModule],
  controllers: [AuthController],
  providers: [AuthService, ProfileRepository, SupabaseAuthGuard, RolesGuard],
  exports: [AuthService, SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
