export type EidStackErrorCode =
  | 'CONFIGURATION_UNAVAILABLE'
  | 'RESOURCES_UNAVAILABLE'
  | 'CONTRACT_UNVERIFIED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_REJECTED'
  | 'UPSTREAM_TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'INVITATION_UNAVAILABLE'
  | 'REVOCATION_UNAVAILABLE';

const messages: Record<EidStackErrorCode, string> = {
  CONFIGURATION_UNAVAILABLE: 'Issuer configuration is unavailable.',
  RESOURCES_UNAVAILABLE: 'The rider schema or credential definition is not configured.',
  CONTRACT_UNVERIFIED:
    'Live response mapping requires a verified sandbox response. Contact the technical operator.',
  UPSTREAM_UNAVAILABLE: 'The live issuer service is unavailable.',
  UPSTREAM_REJECTED:
    'The issuer rejected the request. Check configuration and the exchange in eidStack.',
  UPSTREAM_TIMEOUT:
    'The issuer request timed out. Its outcome is uncertain; reconcile before retrying.',
  INVALID_RESPONSE: 'The issuer returned an unsupported response.',
  INVITATION_UNAVAILABLE: 'A safe wallet invitation is unavailable.',
  REVOCATION_UNAVAILABLE:
    'Revocation support has not been confirmed for this credential definition.',
};

export class EidStackError extends Error {
  constructor(public readonly code: EidStackErrorCode) {
    super(messages[code]);
    this.name = 'EidStackError';
  }
}
