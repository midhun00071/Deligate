import type {
  CreateProofRequestInput,
  CreateProofRequestResult,
  IssueCredentialInput,
  IssueCredentialResult,
  OperationStatusResult,
  RevokeCredentialInput,
  VerificationResult,
} from '../types/eidstack.types';

export interface EidStackPort {
  issueCredential(input: IssueCredentialInput): Promise<IssueCredentialResult>;

  getCredentialIssuanceStatus(credentialExchangeId: string): Promise<OperationStatusResult>;

  createProofRequest(input: CreateProofRequestInput): Promise<CreateProofRequestResult>;

  getVerificationResult(verificationId: string): Promise<VerificationResult>;

  revokeCredential(input: RevokeCredentialInput): Promise<void>;
}
