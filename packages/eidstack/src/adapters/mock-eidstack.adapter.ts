import { EidStackError } from '../errors';
import { validateIssuerInvitation } from '../invitation';
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

export interface MockIssuerOptions {
  fail?: 'issue' | 'status' | 'revoke';
  outcome?: 'ISSUED' | 'FAILED' | 'AWAITING_WALLET';
  now?: () => number;
  verification?:
    'SUCCESS' | 'INVALID' | 'REVOKED' | 'UNTRUSTED' | 'DECLINED' | 'EXPIRED' | 'FAILURE';
}

export class MockEidStackAdapter implements EidStackPort {
  constructor(private readonly options: MockIssuerOptions = {}) {}

  technicalStatus(): IssuerTechnicalStatus {
    return {
      mode: 'mock',
      hostname: null,
      tenantConfigured: true,
      schemaConfigured: true,
      credentialDefinitionConfigured: true,
      revocationSupportKnown: true,
      revocationSupported: true,
      responseContractVerified: true,
    };
  }

  references() {
    return {
      schemaId: 'mock-deligate-rider-schema-v1',
      credentialDefinitionId: 'mock-deligate-rider-revocable-v1',
      revocationSupported: true,
    };
  }

  assertIssuanceReady(): void {}

  issueRiderCredential(input: IssueRiderInput): Promise<IssuanceResult> {
    if (this.options.fail === 'issue') throw new EidStackError('UPSTREAM_REJECTED');
    const id = `mock-${input.requestId}`;
    return Promise.resolve({
      credentialExchangeId: id,
      state: 'AWAITING_WALLET',
      source: 'mock',
      invitation: validateIssuerInvitation(
        `https://wallet-simulation.invalid/offer/${encodeURIComponent(id)}`,
      ),
    });
  }

  getIssuanceStatus(input: ExchangeReference): Promise<IssuerState> {
    if (this.options.fail === 'status') throw new EidStackError('UPSTREAM_UNAVAILABLE');
    const elapsed = (this.options.now ?? Date.now)() - Date.parse(input.requestedAt);
    return Promise.resolve(
      elapsed >= 10000 ? (this.options.outcome ?? 'ISSUED') : 'AWAITING_WALLET',
    );
  }

  revokeCredential(_id: string): Promise<void> {
    if (this.options.fail === 'revoke') throw new EidStackError('UPSTREAM_REJECTED');
    return Promise.resolve();
  }

  createRiderProofRequest(input: RiderProofRequest): Promise<ProofRequestResult> {
    if (this.options.verification === 'FAILURE') throw new EidStackError('UPSTREAM_UNAVAILABLE');
    const proofRecordId = `mock-proof-${input.requestId}`;
    return Promise.resolve({
      proofRecordId,
      source: 'mock',
      invitation: validateIssuerInvitation(
        `https://wallet-simulation.invalid/proof/${encodeURIComponent(proofRecordId)}`,
      ),
    });
  }

  getProofStatus(proofRecordId: string): Promise<ProofStatusResult> {
    if (this.options.verification === 'FAILURE') throw new EidStackError('UPSTREAM_UNAVAILABLE');
    const scenario = this.options.verification ?? 'SUCCESS';
    const elapsed = (this.options.now ?? Date.now)() - Number(proofRecordId.split('-').at(-1) ?? 0);
    if (elapsed >= 0 && proofRecordId.includes('pending')) {
      return Promise.resolve({
        state: 'PENDING',
        cryptographicVerification: 'PENDING',
        revocation: 'UNKNOWN',
        issuerDid: null,
      });
    }
    if (scenario === 'DECLINED')
      return Promise.resolve({
        state: 'DECLINED',
        cryptographicVerification: 'FAIL',
        revocation: 'UNKNOWN',
        issuerDid: null,
      });
    if (scenario === 'EXPIRED')
      return Promise.resolve({
        state: 'EXPIRED',
        cryptographicVerification: 'FAIL',
        revocation: 'UNKNOWN',
        issuerDid: null,
      });
    if (scenario === 'INVALID')
      return Promise.resolve({
        state: 'VERIFIED',
        cryptographicVerification: 'FAIL',
        revocation: 'NOT_REVOKED',
        issuerDid: 'did:mock:delivery',
      });
    return Promise.resolve({
      state: 'VERIFIED',
      cryptographicVerification: 'PASS',
      revocation: scenario === 'REVOKED' ? 'REVOKED' : 'NOT_REVOKED',
      issuerDid: scenario === 'UNTRUSTED' ? 'did:mock:untrusted' : 'did:mock:delivery',
      disclosedAttributes: {
        riderId: 'mock-rider',
        deliveryCompany: 'mock-delivery',
        riderStatus: 'ACTIVE',
      },
    });
  }

  checkIssuerTrust(input: { did: string }): Promise<TrustCheckResult> {
    return Promise.resolve({ state: input.did === 'did:mock:untrusted' ? 'UNTRUSTED' : 'TRUSTED' });
  }

  issueTemporaryAccessCredential(input: IssueTemporaryAccessInput): Promise<IssuanceResult> {
    const credentialExchangeId = `mock-access-${input.requestId}`;
    return Promise.resolve({
      credentialExchangeId,
      state: 'AWAITING_WALLET',
      source: 'mock',
      invitation: validateIssuerInvitation(
        `https://wallet-simulation.invalid/access/${encodeURIComponent(credentialExchangeId)}`,
      ),
    });
  }
}
