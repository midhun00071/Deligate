import type { EidStackConfig } from '../config';
import { EidStackError } from '../errors';
import { validateIssuerInvitation } from '../invitation';
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
      responseContractVerified: true,
    };
  }

  references() {
    return {
      schemaId: this.config.schemaId,
      credentialDefinitionId: this.config.credentialDefinitionId,
      revocationSupported: this.config.revocationSupported,
    };
  }

  assertIssuanceReady(): void {
    if (!this.config.apiKey || !this.config.tenantId || !this.config.organizationId)
      throw new EidStackError('CONFIGURATION_UNAVAILABLE');
    if (!this.config.schemaId || !this.config.credentialDefinitionId)
      throw new EidStackError('RESOURCES_UNAVAILABLE');
  }

  async issueRiderCredential(input: IssueRiderInput): Promise<IssuanceResult> {
    this.assertIssuanceReady();
    const response = await this.client.createRiderOffer(
      this.config.credentialDefinitionId,
      input.claims,
    );
    return parseRiderOffer(response);
  }

  async getIssuanceStatus(input: ExchangeReference): Promise<IssuerState> {
    this.assertIssuanceReady();
    return parseOfferStatus(
      await this.client.offerStatus(input.credentialExchangeId),
      input.credentialExchangeId,
    );
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
    if (
      !this.config.apiKey ||
      !this.config.verificationTenantId ||
      !this.config.buildingOrganizationId ||
      !this.config.accessSchemaId ||
      !this.config.accessCredentialDefinitionId
    )
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

function parseRiderOffer(value: unknown): IssuanceResult {
  const data = responseData(value);
  const shortUrl = data.shortUrl;
  const exchange = data.credentialExchange;
  if (
    !isNonEmptyString(shortUrl) ||
    !isNonEmptyString(data.invitationUrl) ||
    !isNonEmptyString(data.outOfBandId) ||
    !isRecord(exchange) ||
    !isNonEmptyString(exchange.id) ||
    exchange.state !== 'offer-sent'
  )
    throw new EidStackError('CONTRACT_UNVERIFIED');
  return {
    credentialExchangeId: exchange.id,
    state: 'AWAITING_WALLET',
    invitation: validateIssuerInvitation(shortUrl),
    source: 'live',
  };
}

function parseOfferStatus(value: unknown, credentialExchangeId: string): IssuerState {
  const data = responseData(value);
  if (
    !isNonEmptyString(data.credentialExchangeId) ||
    data.credentialExchangeId !== credentialExchangeId
  )
    throw new EidStackError('CONTRACT_UNVERIFIED');
  if (data.state === 'offer-sent') return 'AWAITING_WALLET';
  if (data.state === 'credential-issued') return 'ISSUED';
  throw new EidStackError('CONTRACT_UNVERIFIED');
}

function responseData(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.data)) throw new EidStackError('CONTRACT_UNVERIFIED');
  return value.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
