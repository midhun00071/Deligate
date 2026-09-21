import { Controller, Get, Header, Inject, UseGuards } from '@nestjs/common';
import type { EidStackConfig, EidStackPort } from '@deligate/eidstack';
import { technicalStatusSchema } from '@deligate/validation';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { EIDSTACK_CONFIG, EIDSTACK_PORT } from '../eidstack/eidstack.module';

@Controller('technical-status')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('DELIVERY_ADMIN', 'BUILDING_SECURITY')
export class TechnicalStatusController {
  constructor(
    @Inject(EIDSTACK_PORT) private readonly eidstack: EidStackPort,
    @Inject(EIDSTACK_CONFIG) private readonly config: EidStackConfig,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  get() {
    const status = this.eidstack.technicalStatus();
    return technicalStatusSchema.parse({
      mode: status.mode,
      hostname: status.hostname,
      deliveryTenantConfigured: status.tenantConfigured,
      buildingTenantConfigured: Boolean(this.config.verificationTenantId),
      riderSchemaConfigured: status.schemaConfigured,
      riderCredentialDefinitionConfigured: status.credentialDefinitionConfigured,
      accessSchemaConfigured: Boolean(this.config.accessSchemaId),
      accessCredentialDefinitionConfigured: Boolean(this.config.accessCredentialDefinitionId),
      responseContractVerified: status.responseContractVerified,
    });
  }
}
