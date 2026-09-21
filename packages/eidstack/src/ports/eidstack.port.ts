import type {
  ExchangeReference,
  IssueRiderInput,
  IssuanceResult,
  IssuerReferences,
  IssuerState,
  IssuerTechnicalStatus,
  IssueTemporaryAccessInput,
  ProofRequestResult,
  ProofStatusResult,
  RiderProofRequest,
  TrustCheckResult,
} from '../types/eidstack.types';

/** Issuer capabilities only. No raw transport data or holder operations. */
export interface EidStackPort {
  technicalStatus(): IssuerTechnicalStatus;
  references(): IssuerReferences;
  assertIssuanceReady(): void;
  issueRiderCredential(input: IssueRiderInput): Promise<IssuanceResult>;
  getIssuanceStatus(input: ExchangeReference): Promise<IssuerState>;
  revokeCredential(credentialExchangeId: string): Promise<void>;
  createRiderProofRequest(input: RiderProofRequest): Promise<ProofRequestResult>;
  getProofStatus(proofRecordId: string): Promise<ProofStatusResult>;
  checkIssuerTrust(input: { did: string; schemaId?: string }): Promise<TrustCheckResult>;
  issueTemporaryAccessCredential(input: IssueTemporaryAccessInput): Promise<IssuanceResult>;
}
