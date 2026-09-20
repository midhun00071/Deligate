export type EidStackMode = 'mock' | 'live';

export type EidStackOperationStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface EidStackInvitation {
  invitationUrl?: string;
  qrPayload?: string;
}

export interface LinkedCredentialContext {
  linkGroupId?: string;
  linkedToCredentialExchangeId?: string;
  linkType?: string;
  sourceVerificationId?: string;
}

export interface IssueCredentialInput {
  tenantId: string;
  schemaId: string;
  credentialDefinitionId: string;
  attributes: Record<string, string>;
  linkedContext?: LinkedCredentialContext;
}

export interface IssueCredentialResult {
  credentialExchangeId: string;
  status: EidStackOperationStatus;
  invitation?: EidStackInvitation;
}

export interface ProofPredicate {
  attribute: string;
  operator: string;
  value: string | number;
}

export interface CreateProofRequestInput {
  tenantId: string;
  schemaId: string;
  credentialDefinitionId?: string;
  issuerDid?: string;
  requestedAttributes: string[];
  requestedPredicates?: ProofPredicate[];
  requestNote?: string;
}

export interface CreateProofRequestResult {
  verificationId: string;
  status: EidStackOperationStatus;
  invitation?: EidStackInvitation;
}

export interface VerificationResult {
  verificationId: string;
  verified: boolean;
  signatureValid?: boolean;
  issuerTrusted?: boolean;
  issuerAttestationValid?: boolean;
}

export interface RevokeCredentialInput {
  tenantId: string;
  credentialExchangeId: string;
}

export interface OperationStatusResult {
  id: string;
  status: EidStackOperationStatus;
}
