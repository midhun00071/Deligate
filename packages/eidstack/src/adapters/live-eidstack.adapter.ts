import type { EidStackConfig } from '../config';
import { EidStackError } from '../errors';
import { IssuerClient } from '../live/issuer-client';
import { LiveEidStackClient } from '../live/live-client';
import type { EidStackPort } from '../ports/eidstack.port';
import type {
  ExchangeReference,
  IssueRiderInput,
  IssuanceResult,
  IssuerState,
  IssuerTechnicalStatus,
} from '../types/eidstack.types';

export class LiveEidStackAdapter implements EidStackPort {
  private readonly client: IssuerClient;

  constructor(
    private readonly config: EidStackConfig,
    transport: typeof fetch = fetch,
  ) {
    this.client = new IssuerClient(new LiveEidStackClient(config, transport));
  }

  technicalStatus(): IssuerTechnicalStatus {
    return {
      mode: 'live',
      hostname: new URL(this.config.baseUrl).hostname,
      tenantConfigured: Boolean(this.config.tenantId),
      schemaConfigured: Boolean(this.config.schemaId),
      credentialDefinitionConfigured: Boolean(this.config.credentialDefinitionId),
      revocationSupportKnown: this.config.revocationSupported !== null,
      revocationSupported: this.config.revocationSupported,
      responseContractVerified: false,
    };
  }

  references() {
    return {
      schemaId: this.config.schemaId,
      credentialDefinitionId: this.config.credentialDefinitionId,
      revocationSupported: this.config.revocationSupported,
    };
  }

  assertIssuanceReady(): never {
    if (!this.config.apiKey || !this.config.tenantId || !this.config.organizationId)
      throw new EidStackError('CONFIGURATION_UNAVAILABLE');
    if (!this.config.schemaId || !this.config.credentialDefinitionId)
      throw new EidStackError('RESOURCES_UNAVAILABLE');
    // Do not create an orphan offer before its invitation/reference parser can be verified.
    throw new EidStackError('CONTRACT_UNVERIFIED');
  }

  issueRiderCredential(_input: IssueRiderInput): Promise<IssuanceResult> {
    return this.assertIssuanceReady();
  }

  getIssuanceStatus(_input: ExchangeReference): Promise<IssuerState> {
    throw new EidStackError('CONTRACT_UNVERIFIED');
  }

  async revokeCredential(id: string): Promise<void> {
    if (this.config.revocationSupported !== true) throw new EidStackError('REVOCATION_UNAVAILABLE');
    // Successful envelope confirms the command, not a fresh ledger-status read.
    await this.client.revoke(id);
  }
}
