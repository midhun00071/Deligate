import type { EidStackConfig } from '../config';
import { EidStackError } from '../errors';

/** Server-only transport. Never retries a mutation or returns upstream text. */
export class LiveEidStackClient {
  constructor(
    private readonly config: EidStackConfig,
    private readonly transport: typeof fetch = fetch,
  ) {}

  async request(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
    tenantScoped = true,
  ): Promise<unknown> {
    if (!this.config.apiKey || (tenantScoped && !this.config.tenantId))
      throw new EidStackError('CONFIGURATION_UNAVAILABLE');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.transport(`${this.config.baseUrl}${path}`, {
        method,
        redirect: 'error',
        signal: controller.signal,
        headers: {
          'x-api-key': this.config.apiKey,
          ...(tenantScoped ? { 'x-tenant-id': this.config.tenantId } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok)
        throw new EidStackError(
          response.status >= 500 ? 'UPSTREAM_UNAVAILABLE' : 'UPSTREAM_REJECTED',
        );
      let value: unknown;
      try {
        value = await response.json();
      } catch {
        throw new EidStackError('INVALID_RESPONSE');
      }
      if (!value || typeof value !== 'object' || !('success' in value) || value.success !== true)
        throw new EidStackError('INVALID_RESPONSE');
      return value;
    } catch (error) {
      if (error instanceof EidStackError) throw error;
      throw new EidStackError(
        controller.signal.aborted ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
