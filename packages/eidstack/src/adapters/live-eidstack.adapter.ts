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

export class LiveEidStackAdapter implements EidStackPort {
  private notImplemented(): never {
    throw new Error(
      'Live eidStack integration is not implemented. Verify the official sandbox API before adding endpoint-specific behavior.',
    );
  }

  issueCredential(_input: IssueCredentialInput): Promise<IssueCredentialResult> {
    return this.notImplemented();
  }

  getCredentialIssuanceStatus(_credentialExchangeId: string): Promise<OperationStatusResult> {
    return this.notImplemented();
  }

  createProofRequest(_input: CreateProofRequestInput): Promise<CreateProofRequestResult> {
    return this.notImplemented();
  }

  getVerificationResult(_verificationId: string): Promise<VerificationResult> {
    return this.notImplemented();
  }

  revokeCredential(_input: RevokeCredentialInput): Promise<void> {
    return this.notImplemented();
  }
}
