import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { ActivityController } from './activity.controller';
import { ActivityRepository } from './activity.repository';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [ActivityController],
  providers: [ActivityRepository],
})
export class ActivityModule {}
