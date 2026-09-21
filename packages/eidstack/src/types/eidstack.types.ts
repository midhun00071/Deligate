export type EidStackMode = 'mock' | 'live';
export type IssuerState =
  'REQUESTING' | 'AWAITING_WALLET' | 'ISSUED' | 'FAILED' | 'UNKNOWN' | 'REVOKED';

export interface RiderClaims {
  riderId: string;
  deliveryCompany: string;
  riderStatus: 'ACTIVE';
  validFrom: string;
  validUntil: string;
}

export interface IssuerReferences {
  schemaId: string;
  credentialDefinitionId: string;
  revocationSupported: boolean | null;
}

export interface IssueRiderInput {
  requestId: string;
  claims: RiderClaims;
}

export interface IssuanceResult {
  credentialExchangeId: string;
  state: 'AWAITING_WALLET';
  invitation: string;
  source: EidStackMode;
}

export interface ExchangeReference {
  credentialExchangeId: string;
  requestedAt: string;
}

export interface IssuerTechnicalStatus {
  mode: EidStackMode;
  hostname: string | null;
  tenantConfigured: boolean;
  schemaConfigured: boolean;
  credentialDefinitionConfigured: boolean;
  revocationSupportKnown: boolean;
  revocationSupported: boolean | null;
  responseContractVerified: boolean;
}
