import { EidStackError } from '../errors';
import { validateIssuerInvitation } from '../invitation';
import type { EidStackPort } from '../ports/eidstack.port';
import type {
  ExchangeReference,
  IssueRiderInput,
  IssuanceResult,
  IssuerState,
  IssuerTechnicalStatus,
} from '../types/eidstack.types';

export interface MockIssuerOptions {
  fail?: 'issue' | 'status' | 'revoke';
  outcome?: 'ISSUED' | 'FAILED' | 'AWAITING_WALLET';
  now?: () => number;
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
}
