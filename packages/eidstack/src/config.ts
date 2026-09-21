import { EidStackError } from './errors';
import type { EidStackMode, IssuerReferences } from './types/eidstack.types';

export interface EidStackConfig extends IssuerReferences {
  mode: EidStackMode;
  baseUrl: string;
  apiKey: string;
  tenantId: string;
  timeoutMs: number;
  organizationId: string;
}

export function readEidStackConfig(env: Record<string, string | undefined>): EidStackConfig {
  const mode = env.EIDSTACK_MODE;
  if (mode !== 'mock' && mode !== 'live') throw new EidStackError('CONFIGURATION_UNAVAILABLE');
  if (
    mode === 'mock' &&
    (env.NODE_ENV === 'production' || ['production', 'live'].includes(env.APP_ENV ?? ''))
  ) {
    throw new EidStackError('CONFIGURATION_UNAVAILABLE');
  }
  const baseUrl = env.EIDSTACK_BASE_URL ?? 'https://test.e-idstack.com/api/v1';
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      throw new Error();
  } catch {
    throw new EidStackError('CONFIGURATION_UNAVAILABLE');
  }
  const timeoutMs = Number(env.EIDSTACK_TIMEOUT_MS ?? 8000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000)
    throw new EidStackError('CONFIGURATION_UNAVAILABLE');
  const revocation = env.EIDSTACK_RIDER_REVOCATION_SUPPORTED;
  if (revocation && !['true', 'false'].includes(revocation))
    throw new EidStackError('CONFIGURATION_UNAVAILABLE');
  for (const key of ['EIDSTACK_API_KEY', 'EIDSTACK_DELIVERY_TENANT_ID']) {
    if (/[\r\n]/.test(env[key] ?? '')) throw new EidStackError('CONFIGURATION_UNAVAILABLE');
  }
  return {
    mode,
    baseUrl: baseUrl.replace(/\/$/, ''),
    timeoutMs,
    apiKey: env.EIDSTACK_API_KEY ?? '',
    tenantId: env.EIDSTACK_DELIVERY_TENANT_ID ?? '',
    organizationId: env.EIDSTACK_DELIVERY_ORGANIZATION_ID ?? '',
    schemaId: env.EIDSTACK_RIDER_SCHEMA_ID ?? '',
    credentialDefinitionId: env.EIDSTACK_RIDER_CREDENTIAL_DEFINITION_ID ?? '',
    revocationSupported: revocation ? revocation === 'true' : null,
  };
}
