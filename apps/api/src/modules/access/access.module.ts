import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { EidStackModule } from '../eidstack/eidstack.module';
import { VerificationModule } from '../verification/verification.module';
import { AccessController } from './access.controller';
import { AccessInvitationCache } from './access-invitation-cache';
import { AccessRepository } from './access.repository';
import { AccessService } from './access.service';

@Module({
  imports: [AuthModule, SupabaseModule, EidStackModule, VerificationModule],
  controllers: [AccessController],
  providers: [AccessRepository, AccessInvitationCache, AccessService],
})
export class AccessModule {}
