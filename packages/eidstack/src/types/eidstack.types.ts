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

export type ProofState = 'PENDING' | 'VERIFIED' | 'DECLINED' | 'EXPIRED';
export type RevocationState = 'NOT_REVOKED' | 'REVOKED' | 'UNKNOWN';
export type TrustState = 'TRUSTED' | 'UNTRUSTED' | 'UNKNOWN';

export interface RiderProofRequest {
  requestId: string;
  credentialDefinitionId: string;
  attributes: Array<{ name: 'riderId' | 'deliveryCompany' | 'riderStatus' }>;
  comment: string;
}

export interface ProofRequestResult {
  proofRecordId: string;
  invitation: string;
  source: EidStackMode;
}

/** Deligate's normalized evidence; never contains a raw presentation or credential. */
export interface ProofStatusResult {
  state: ProofState;
  cryptographicVerification: 'PASS' | 'FAIL' | 'PENDING';
  revocation: RevocationState;
  issuerDid: string | null;
  disclosedAttributes?: {
    riderId: string;
    deliveryCompany: string;
    riderStatus: string;
  };
}

export interface TrustCheckResult {
  state: TrustState;
}

export interface TemporaryAccessClaims {
  accessId: string;
  buildingId: string;
  accessScope: string;
  validFrom: string;
  validUntil: string;
}

export interface IssueTemporaryAccessInput {
  requestId: string;
  claims: TemporaryAccessClaims;
}
