import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { EidStackModule } from '../eidstack/eidstack.module';
import { VerificationController } from './verification.controller';
import { VerificationInvitationCache } from './verification-invitation-cache';
import { VerificationRepository } from './verification.repository';
import { VerificationService } from './verification.service';
import { SecurityOverviewRepository } from './security-overview.repository';

@Module({
  imports: [AuthModule, SupabaseModule, EidStackModule],
  controllers: [VerificationController],
  providers: [VerificationRepository, VerificationInvitationCache, VerificationService, SecurityOverviewRepository],
  exports: [VerificationService, VerificationRepository],
})
export class VerificationModule {}
