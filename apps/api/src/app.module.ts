import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SupabaseModule } from './infrastructure/supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { RiderModule } from './modules/riders/rider.module';
import { VerificationModule } from './modules/verification/verification.module';
import { AccessModule } from './modules/access/access.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    SupabaseModule,
    AuthModule,
    HealthModule,
    RiderModule,
    VerificationModule,
    AccessModule,
  ],
})
export class AppModule {}
