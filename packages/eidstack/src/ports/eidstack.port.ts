import type {
  ExchangeReference,
  IssueRiderInput,
  IssuanceResult,
  IssuerReferences,
  IssuerState,
  IssuerTechnicalStatus,
} from '../types/eidstack.types';

/** Issuer capabilities only. No raw transport data or holder operations. */
export interface EidStackPort {
  technicalStatus(): IssuerTechnicalStatus;
  references(): IssuerReferences;
  assertIssuanceReady(): void;
  issueRiderCredential(input: IssueRiderInput): Promise<IssuanceResult>;
  getIssuanceStatus(input: ExchangeReference): Promise<IssuerState>;
  revokeCredential(credentialExchangeId: string): Promise<void>;
}
