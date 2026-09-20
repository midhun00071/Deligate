import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { createSupabaseAdminClient } from './supabase.client';
import { getSupabaseServerConfig } from './supabase.config';
import { SUPABASE_ADMIN_CLIENT } from './supabase.tokens';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SUPABASE_ADMIN_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = getSupabaseServerConfig(configService);

        return createSupabaseAdminClient(config.url, config.secretKey);
      },
    },
  ],
  exports: [SUPABASE_ADMIN_CLIENT],
})
export class SupabaseModule {}
