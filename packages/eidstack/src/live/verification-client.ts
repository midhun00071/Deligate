import { LiveEidStackClient } from './live-client';

/** Only documented endpoint shapes live here. Response fields remain deliberately unparsed. */
export class VerificationClient {
  constructor(
    private readonly http: LiveEidStackClient,
    private readonly tenantId: string,
  ) {}

  createProofRequest(input: {
    credDefId: string;
    attributes: Array<{ name: string }>;
    comment: string;
  }) {
    return this.http.request('POST', '/verification/createproofRequest', input, this.tenantId);
  }

  proofStatus(proofRecordId: string) {
    return this.http.request(
      'GET',
      `/verification/proofStatus?proofRecordId=${encodeURIComponent(proofRecordId)}`,
      undefined,
      this.tenantId,
    );
  }

  trustCheck(input: { did: string; schemaId?: string }) {
    const params = new URLSearchParams({ did: input.did });
    if (input.schemaId) params.set('schemaId', input.schemaId);
    return this.http.request(
      'GET',
      `/trust-registry/check?${params.toString()}`,
      undefined,
      this.tenantId,
    );
  }
}
