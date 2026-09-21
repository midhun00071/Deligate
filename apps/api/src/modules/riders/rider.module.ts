import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { EidStackModule } from '../eidstack/eidstack.module';
import { CredentialRepository } from '../credentials/credential.repository';
import { CredentialService } from '../credentials/credential.service';
import { InvitationCache } from '../credentials/invitation-cache';
import { IssuerOverviewRepository } from '../credentials/issuer-overview.repository';
import { RiderController } from './rider.controller';
import { RiderRepository } from './rider.repository';
import { RiderService } from './rider.service';

@Module({
  imports: [AuthModule, SupabaseModule, EidStackModule],
  controllers: [RiderController],
  providers: [
    RiderRepository,
    RiderService,
    CredentialRepository,
    CredentialService,
    InvitationCache,
    IssuerOverviewRepository,
  ],
})
export class RiderModule {}
