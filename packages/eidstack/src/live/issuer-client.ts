import type { RiderClaims, TemporaryAccessClaims } from '../types/eidstack.types';
import { LiveEidStackClient } from './live-client';

/** Verified against official docs and Swagger on 2026-09-21.
 * Response data remains unknown: Swagger provides no response content schema.
 * Transport methods are not exposed directly to application controllers.
 */
export class IssuerClient {
  constructor(private readonly http: LiveEidStackClient) {}

  createSchema() {
    return this.http.request('POST', '/issuance/schema', {
      name: 'VerifiedRiderCredential',
      version: '1.0.0',
      attributes: ['riderId', 'deliveryCompany', 'riderStatus', 'validFrom', 'validUntil'].map(
        (attributeName) => ({
          attributeName,
          schemaDataType: 'string',
          displayName: attributeName,
        }),
      ),
    });
  }

  createCredentialDefinition(schemaId: string) {
    return this.http.request('POST', '/issuance/credential-definition', {
      schemaId,
      tag: 'deligate-rider-v1-revocable',
      supportRevocation: true,
    });
  }

  createOffer(schemaId: string, credentialDefinitionId: string, attributes: RiderClaims) {
    return this.http.request('POST', '/issuance/oob-offer', {
      schemaId,
      credentialDefinitionId,
      attributes,
      subjectAttribute: 'riderId',
      useConnection: false,
      autoAcceptCredential: false,
      comment: 'Delivery rider employment credential. Review and accept in your holder wallet.',
      category: 'employment',
    });
  }

  offerStatus(id: string) {
    return this.http.request(
      'GET',
      `/issuance/offerStatus?credentialExchangeId=${encodeURIComponent(id)}`,
    );
  }

  revoke(id: string) {
    return this.http.request('PATCH', `/issuance/credentials/${encodeURIComponent(id)}/revoke`);
  }

  revocationStatus(id: string) {
    return this.http.request(
      'GET',
      `/issuance/credentials/${encodeURIComponent(id)}/revocation-status`,
    );
  }

  createTemporaryAccessOffer(
    schemaId: string,
    credentialDefinitionId: string,
    attributes: TemporaryAccessClaims,
    tenantId: string,
  ) {
    return this.http.request(
      'POST',
      '/issuance/oob-offer',
      {
        schemaId,
        credentialDefinitionId,
        attributes,
        subjectAttribute: 'accessId',
        useConnection: false,
        autoAcceptCredential: false,
        comment: 'Temporary building access. Review and accept in your holder wallet.',
        category: 'access',
      },
      tenantId,
    );
  }
}
