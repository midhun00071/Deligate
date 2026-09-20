export type { EidStackPort } from './ports/eidstack.port';

export { LiveEidStackAdapter } from './adapters/live-eidstack.adapter';
export { MockEidStackAdapter } from './adapters/mock-eidstack.adapter';

export type {
  CreateProofRequestInput,
  CreateProofRequestResult,
  EidStackInvitation,
  EidStackMode,
  EidStackOperationStatus,
  IssueCredentialInput,
  IssueCredentialResult,
  LinkedCredentialContext,
  OperationStatusResult,
  ProofPredicate,
  RevokeCredentialInput,
  VerificationResult,
} from './types/eidstack.types';
