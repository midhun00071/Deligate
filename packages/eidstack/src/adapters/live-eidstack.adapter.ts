import type { EidStackConfig } from '../config';
import { EidStackError } from '../errors';
import { IssuerClient } from '../live/issuer-client';
import { LiveEidStackClient } from '../live/live-client';
import { VerificationClient } from '../live/verification-client';
import type { EidStackPort } from '../ports/eidstack.port';
import type {
  ExchangeReference,
  IssueRiderInput,
  IssuanceResult,
  IssuerState,
  IssuerTechnicalStatus,
  IssueTemporaryAccessInput,
  ProofRequestResult,
  ProofStatusResult,
  RiderProofRequest,
  TrustCheckResult,
} from '../types/eidstack.types';

export class LiveEidStackAdapter implements EidStackPort {
  private readonly client: IssuerClient;
  private readonly verifier: VerificationClient;

  constructor(
    private readonly config: EidStackConfig,
    transport: typeof fetch = fetch,
  ) {
    const client = new LiveEidStackClient(config, transport);
    this.client = new IssuerClient(client);
    this.verifier = new VerificationClient(client, config.verificationTenantId);
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

  createRiderProofRequest(_input: RiderProofRequest): Promise<ProofRequestResult> {
    this.assertVerificationReady();
  }

  getProofStatus(_proofRecordId: string): Promise<ProofStatusResult> {
    this.assertVerificationReady();
  }

  checkIssuerTrust(_input: { did: string; schemaId?: string }): Promise<TrustCheckResult> {
    this.assertVerificationReady();
  }

  issueTemporaryAccessCredential(_input: IssueTemporaryAccessInput): Promise<IssuanceResult> {
    if (!this.config.accessSchemaId || !this.config.accessCredentialDefinitionId)
      throw new EidStackError('RESOURCES_UNAVAILABLE');
    throw new EidStackError('CONTRACT_UNVERIFIED');
  }

  private assertVerificationReady(): never {
    if (
      !this.config.apiKey ||
      !this.config.tenantId ||
      !this.config.verificationTenantId ||
      !this.config.credentialDefinitionId
    )
      throw new EidStackError('CONFIGURATION_UNAVAILABLE');
    // Endpoint construction is tested on VerificationClient, but invitations and evidence
    // fields have no authoritative response schema. Do not create orphan proof records.
    throw new EidStackError('CONTRACT_UNVERIFIED');
  }
}
