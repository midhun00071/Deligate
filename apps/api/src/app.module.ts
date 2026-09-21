import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SupabaseModule } from './infrastructure/supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { RiderModule } from './modules/riders/rider.module';

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
  ],
})
export class AppModule {}
