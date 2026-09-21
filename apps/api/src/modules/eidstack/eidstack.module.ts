import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LiveEidStackAdapter, MockEidStackAdapter, readEidStackConfig } from '@deligate/eidstack';

export const EIDSTACK_PORT = Symbol('EIDSTACK_PORT');
export const EIDSTACK_CONFIG = Symbol('EIDSTACK_CONFIG');

@Module({
  providers: [
    {
      provide: EIDSTACK_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        readEidStackConfig(
          Object.fromEntries(
            [
              'NODE_ENV',
              'APP_ENV',
              'EIDSTACK_MODE',
              'EIDSTACK_BASE_URL',
              'EIDSTACK_API_KEY',
              'EIDSTACK_DELIVERY_TENANT_ID',
              'EIDSTACK_DELIVERY_ORGANIZATION_ID',
              'EIDSTACK_TIMEOUT_MS',
              'EIDSTACK_RIDER_SCHEMA_ID',
              'EIDSTACK_RIDER_CREDENTIAL_DEFINITION_ID',
              'EIDSTACK_RIDER_REVOCATION_SUPPORTED',
              'EIDSTACK_ACCESS_SCHEMA_ID',
              'EIDSTACK_ACCESS_CREDENTIAL_DEFINITION_ID',
              'EIDSTACK_BUILDING_TENANT_ID',
            ].map((key) => [key, config.get<string>(key)]),
          ),
        ),
    },
    {
      provide: EIDSTACK_PORT,
      inject: [EIDSTACK_CONFIG],
      useFactory: (config: ReturnType<typeof readEidStackConfig>) =>
        config.mode === 'mock' ? new MockEidStackAdapter() : new LiveEidStackAdapter(config),
    },
  ],
  exports: [EIDSTACK_PORT, EIDSTACK_CONFIG],
})
export class EidStackModule {}
