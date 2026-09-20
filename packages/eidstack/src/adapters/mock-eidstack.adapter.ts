import type { EidStackPort } from '../ports/eidstack.port';
import type {
  CreateProofRequestInput,
  CreateProofRequestResult,
  IssueCredentialInput,
  IssueCredentialResult,
  OperationStatusResult,
  RevokeCredentialInput,
  VerificationResult,
} from '../types/eidstack.types';

export class MockEidStackAdapter implements EidStackPort {
  issueCredential(_input: IssueCredentialInput): Promise<IssueCredentialResult> {
    throw new Error('Mock eidStack issuance is not implemented yet.');
  }

  getCredentialIssuanceStatus(_credentialExchangeId: string): Promise<OperationStatusResult> {
    throw new Error('Mock eidStack issuance status is not implemented yet.');
  }

  createProofRequest(_input: CreateProofRequestInput): Promise<CreateProofRequestResult> {
    throw new Error('Mock eidStack proof requests are not implemented yet.');
  }

  getVerificationResult(_verificationId: string): Promise<VerificationResult> {
    throw new Error('Mock eidStack verification is not implemented yet.');
  }

  revokeCredential(_input: RevokeCredentialInput): Promise<void> {
    throw new Error('Mock eidStack revocation is not implemented yet.');
  }
}
