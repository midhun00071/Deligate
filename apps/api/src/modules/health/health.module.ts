import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { TechnicalStatusController } from './technical-status.controller';
import { AuthModule } from '../../auth/auth.module';
import { EidStackModule } from '../eidstack/eidstack.module';

@Module({
  imports: [AuthModule, EidStackModule],
  controllers: [HealthController, TechnicalStatusController],
})
export class HealthModule {}
