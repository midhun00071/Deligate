import {
  EidStackError,
  IssuerClient,
  LiveEidStackAdapter,
  LiveEidStackClient,
  MockEidStackAdapter,
  readEidStackConfig,
  validateIssuerInvitation,
  VerificationClient,
} from '@deligate/eidstack';
const config = readEidStackConfig({
  EIDSTACK_MODE: 'live',
  EIDSTACK_API_KEY: 'test-only-key',
  EIDSTACK_DELIVERY_TENANT_ID: 'delivery-tenant-test',
  EIDSTACK_BUILDING_TENANT_ID: 'building-tenant-test',
  EIDSTACK_DELIVERY_ORGANIZATION_ID: 'org-a',
  EIDSTACK_RIDER_SCHEMA_ID: 'schema-a',
  EIDSTACK_RIDER_CREDENTIAL_DEFINITION_ID: 'definition-a',
  EIDSTACK_RIDER_REVOCATION_SUPPORTED: 'true',
});
const claims = {
  riderId: 'opaque-rider',
  deliveryCompany: 'opaque-company',
  riderStatus: 'ACTIVE' as const,
  validFrom: '2026-09-21T00:00:00.000Z',
  validUntil: '2026-12-20T00:00:00.000Z',
};
describe('documented live issuer request contracts', () => {
  let transport: jest.MockedFunction<typeof fetch>;
  let client: IssuerClient;
  beforeEach(() => {
    transport = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockImplementation(() => Promise.resolve(Response.json({ success: true, data: {} })));
    client = new IssuerClient(new LiveEidStackClient(config, transport));
  });
  it('constructs the proven rider OOB request with server-only headers and minimal claims', async () => {
    await client.createRiderOffer('definition-a', claims);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe('https://test.e-idstack.com/api/v1/issuance/oob-offer');
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: {
        'x-api-key': 'test-only-key',
        'x-tenant-id': 'delivery-tenant-test',
        'Content-Type': 'application/json',
      },
    });
    expect(parseBody(init?.body)).toEqual({
      credentialDefinitionId: 'definition-a',
      attributes: [
        { name: 'riderId', value: claims.riderId },
        { name: 'deliveryCompany', value: claims.deliveryCompany },
        { name: 'riderStatus', value: 'ACTIVE' },
      ],
      autoAcceptCredential: true,
      comment: '',
    });
  });
  it('creates a revocation-capable definition explicitly and a minimal schema only when called', async () => {
    expect(transport).not.toHaveBeenCalled();
    await client.createSchema();
    await client.createCredentialDefinition('schema-a');
    expect(transport.mock.calls[0][0]).toMatch(/\/issuance\/schema$/);
    expect(parseBody(transport.mock.calls[0][1]?.body)).toMatchObject({
      name: 'VerifiedRiderCredential',
      version: '1.0.0',
      attributes: Object.keys(claims).map((attributeName) => ({
        attributeName,
        schemaDataType: 'string',
        displayName: attributeName,
      })),
    });
    expect(transport.mock.calls[1][0]).toMatch(/\/issuance\/credential-definition$/);
    expect(parseBody(transport.mock.calls[1][1]?.body)).toEqual({
      schemaId: 'schema-a',
      tag: 'deligate-rider-v1-revocable',
      supportRevocation: true,
    });
  });
  it('uses documented status/revoke routes, encodes references and supplies tenant headers', async () => {
    await client.offerStatus('exchange/a');
    await client.revoke('exchange/a');
    await client.revocationStatus('exchange/a');
    expect(transport.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      [`${config.baseUrl}/issuance/offerStatus?credentialExchangeId=exchange%2Fa`, 'GET'],
      [`${config.baseUrl}/issuance/credentials/exchange%2Fa/revoke`, 'PATCH'],
      [`${config.baseUrl}/issuance/credentials/exchange%2Fa/revocation-status`, 'GET'],
    ]);
    for (const [, init] of transport.mock.calls)
      expect(init?.headers).toMatchObject({ 'x-tenant-id': 'delivery-tenant-test' });
  });

  it.each([400, 401, 500, 503])(
    'sanitizes upstream %s and never retries mutations',
    async (status) => {
      transport.mockResolvedValue(new Response('secret invitation raw credential', { status }));
      await expect(client.createRiderOffer('d', claims)).rejects.toThrow(EidStackError);
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects malformed and false-success envelopes', async () => {
    for (const value of [null, {}, { success: false }, { success: 'true' }]) {
      transport.mockResolvedValue(Response.json(value));
      await expect(client.offerStatus('x')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
    transport.mockResolvedValue(new Response('not json'));
    await expect(client.offerStatus('x')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('aborts on timeout without exposing transport errors', async () => {
    transport.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('secret upstream detail')),
          );
        }),
    );
    const timed = new IssuerClient(new LiveEidStackClient({ ...config, timeoutMs: 5 }, transport));
    await expect(timed.offerStatus('x')).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' });
  });

  it('requires tenant/key configuration before transport', async () => {
    for (const incomplete of [
      { ...config, apiKey: '' },
      { ...config, tenantId: '' },
    ]) {
      await expect(
        new LiveEidStackClient(incomplete, transport).request('GET', '/issuance/offerStatus'),
      ).rejects.toMatchObject({ code: 'CONFIGURATION_UNAVAILABLE' });
    }
    expect(transport).not.toHaveBeenCalled();
  });

  it('maps the exact short URL and exchange reference from a live rider offer', async () => {
    const live = new LiveEidStackAdapter(config, transport);
    transport.mockResolvedValueOnce(
      Response.json({
        success: true,
        data: {
          shortUrl: 'https://test.e-idstack.com/s/short-offer',
          invitationUrl: 'https://test.e-idstack.com/oob?long=invitation',
          outOfBandId: 'out-of-band-1',
          credentialExchange: {
            id: 'exchange-1',
            state: 'offer-sent',
            role: 'issuer',
            protocolVersion: 'v2',
            autoAcceptCredential: 'always',
          },
        },
      }),
    );
    await expect(live.issueRiderCredential({ requestId: 'r', claims })).resolves.toEqual({
      source: 'live',
      state: 'AWAITING_WALLET',
      credentialExchangeId: 'exchange-1',
      invitation: 'https://test.e-idstack.com/s/short-offer',
    });
    expect(JSON.stringify(live.technicalStatus())).not.toContain('test-only-key');
    expect(live.technicalStatus()).toMatchObject({ mode: 'live', responseContractVerified: true });
  });

  it('fails closed for malformed live offer/status responses and upstream failures', async () => {
    const live = new LiveEidStackAdapter(config, transport);
    transport.mockResolvedValueOnce(
      Response.json({ success: true, data: { shortUrl: 'https://x' } }),
    );
    await expect(live.issueRiderCredential({ requestId: 'r', claims })).rejects.toMatchObject({
      code: 'CONTRACT_UNVERIFIED',
    });
    for (const data of [
      {
        invitationUrl: 'https://test.e-idstack.com/oob?long=invitation',
        outOfBandId: 'out-of-band-1',
        credentialExchange: { id: 'exchange-1', state: 'offer-sent' },
      },
      {
        shortUrl: 'https://test.e-idstack.com/s/short-offer',
        invitationUrl: 'https://test.e-idstack.com/oob?long=invitation',
        outOfBandId: 'out-of-band-1',
        credentialExchange: { id: 'exchange-1', state: 'credential-issued' },
      },
    ]) {
      transport.mockResolvedValueOnce(Response.json({ success: true, data }));
      await expect(live.issueRiderCredential({ requestId: 'r', claims })).rejects.toMatchObject({
        code: 'CONTRACT_UNVERIFIED',
      });
    }
    transport.mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    await expect(live.issueRiderCredential({ requestId: 'r', claims })).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });
    transport.mockResolvedValueOnce(
      Response.json({
        success: true,
        data: { credentialExchangeId: 'exchange-1', state: 'offer-sent' },
      }),
    );
    await expect(
      live.getIssuanceStatus({ credentialExchangeId: 'exchange-1', requestedAt: claims.validFrom }),
    ).resolves.toBe('AWAITING_WALLET');
    transport.mockResolvedValueOnce(
      Response.json({
        success: true,
        data: { credentialExchangeId: 'exchange-1', state: 'credential-issued' },
      }),
    );
    await expect(
      live.getIssuanceStatus({ credentialExchangeId: 'exchange-1', requestedAt: claims.validFrom }),
    ).resolves.toBe('ISSUED');
    transport.mockResolvedValueOnce(
      Response.json({
        success: true,
        data: { credentialExchangeId: 'exchange-1', state: 'request-received' },
      }),
    );
    await expect(
      live.getIssuanceStatus({ credentialExchangeId: 'exchange-1', requestedAt: claims.validFrom }),
    ).rejects.toMatchObject({ code: 'CONTRACT_UNVERIFIED' });
    transport.mockResolvedValueOnce(
      Response.json({
        success: true,
        data: { credentialExchangeId: 'other-exchange', state: 'credential-issued' },
      }),
    );
    await expect(
      live.getIssuanceStatus({ credentialExchangeId: 'exchange-1', requestedAt: claims.validFrom }),
    ).rejects.toMatchObject({ code: 'CONTRACT_UNVERIFIED' });
  });

  it('live revoke errors stay errors and success requires the documented envelope', async () => {
    const live = new LiveEidStackAdapter(config, transport);
    transport.mockRejectedValue(new Error('secret'));
    await expect(live.revokeCredential('x')).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });
    transport.mockResolvedValue(Response.json({ success: true, data: {} }));
    await expect(live.revokeCredential('x')).resolves.toBeUndefined();
  });
});

describe('mock and invitation boundary', () => {
  it('keeps mock offers awaiting wallet delivery without a timer transition', async () => {
    const adapter = new MockEidStackAdapter();
    const input = { requestId: 'same', claims };
    expect(await adapter.issueRiderCredential(input)).toEqual(
      await adapter.issueRiderCredential(input),
    );
    expect(
      await adapter.getIssuanceStatus({
        credentialExchangeId: 'mock-same',
        requestedAt: claims.validFrom,
      }),
    ).toBe('AWAITING_WALLET');
    expect(adapter.technicalStatus().mode).toBe('mock');
  });
  it('supports explicit failures without simulating credential delivery', async () => {
    expect(() =>
      new MockEidStackAdapter({ fail: 'issue' }).issueRiderCredential({ requestId: 'x', claims }),
    ).toThrow(EidStackError);
    expect(() => new MockEidStackAdapter({ fail: 'revoke' }).revokeCredential('x')).toThrow(
      EidStackError,
    );
  });
  it('preserves exact invitation bytes and rejects unsafe invitations', () => {
    const invitation = 'https://wallet.example/?_oob=A%2fb%3D&x=AbC';
    expect(validateIssuerInvitation(invitation)).toBe(invitation);
    for (const value of [
      '',
      'javascript:alert(1)',
      'http://example.com',
      'https://u:p@example.com',
      ' https://example.com',
      'https://example.com/\n',
      `https://example.com/${'x'.repeat(2048)}`,
    ]) {
      expect(() => validateIssuerInvitation(value)).toThrow(EidStackError);
    }
  });
  it('rejects mock production/live environments and invalid modes', () => {
    for (const env of [
      { EIDSTACK_MODE: 'invalid' },
      { EIDSTACK_MODE: 'mock', NODE_ENV: 'production' },
      { EIDSTACK_MODE: 'mock', APP_ENV: 'live' },
    ])
      expect(() => readEidStackConfig(env)).toThrow(EidStackError);
  });
});

describe('documented live verification request contracts', () => {
  let transport: jest.MockedFunction<typeof fetch>;
  let client: VerificationClient;
  beforeEach(() => {
    transport = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockImplementation(() => Promise.resolve(Response.json({ success: true, data: {} })));
    client = new VerificationClient(
      new LiveEidStackClient(config, transport),
      config.verificationTenantId,
    );
  });

  it('uses documented proof paths, minimal attributes, and server-only tenant headers', async () => {
    await client.createProofRequest({
      credDefId: 'definition-a',
      attributes: [{ name: 'riderId' }, { name: 'deliveryCompany' }, { name: 'riderStatus' }],
      comment: 'Confirm active delivery-rider status for temporary building access.',
    });
    await client.proofStatus('proof/a');
    await client.trustCheck({ did: 'did:example:issuer', schemaId: 'schema/a' });
    expect(transport.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      [`${config.baseUrl}/verification/createproofRequest`, 'POST'],
      [`${config.baseUrl}/verification/proofStatus?proofRecordId=proof%2Fa`, 'GET'],
      [
        `${config.baseUrl}/trust-registry/check?did=did%3Aexample%3Aissuer&schemaId=schema%2Fa`,
        'GET',
      ],
    ]);
    expect(parseBody(transport.mock.calls[0]?.[1]?.body)).toEqual({
      credDefId: 'definition-a',
      attributes: [{ name: 'riderId' }, { name: 'deliveryCompany' }, { name: 'riderStatus' }],
      comment: 'Confirm active delivery-rider status for temporary building access.',
    });
    for (const [, init] of transport.mock.calls)
      expect(init?.headers).toMatchObject({
        'x-api-key': 'test-only-key',
        'x-tenant-id': 'building-tenant-test',
      });
  });

  it('uses the building tenant for a temporary access offer', async () => {
    const issuer = new IssuerClient(new LiveEidStackClient(config, transport));
    await issuer.createTemporaryAccessOffer(
      'access-schema',
      'access-definition',
      {
        accessId: 'access-1',
        buildingId: 'building-1',
        accessScope: 'BUILDING_ENTRY',
        validFrom: '2026-09-21T00:00:00.000Z',
        validUntil: '2026-09-21T00:30:00.000Z',
      },
      config.verificationTenantId,
    );
    expect(transport.mock.calls[0]?.[1]?.headers).toMatchObject({
      'x-tenant-id': 'building-tenant-test',
    });
  });

  it('fails closed before live verifier mutations while proof response fields are unverified', () => {
    const live = new LiveEidStackAdapter(config, transport);
    expect(() =>
      live.createRiderProofRequest({
        requestId: 'x',
        credentialDefinitionId: 'd',
        attributes: [{ name: 'riderId' }],
        comment: 'x',
      }),
    ).toThrow(EidStackError);
    expect(() => live.getProofStatus('proof')).toThrow(EidStackError);
    expect(() => live.checkIssuerTrust({ did: 'did:example:issuer' })).toThrow(EidStackError);
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    ['SUCCESS', 'ACCEPTED'],
    ['INVALID', 'DENIED'],
    ['REVOKED', 'DENIED'],
    ['UNTRUSTED', 'DENIED'],
  ] as const)('keeps mock %s evidence distinct', async (scenario, _decision) => {
    const mock = new MockEidStackAdapter({ verification: scenario });
    const request = await mock.createRiderProofRequest({
      requestId: scenario,
      credentialDefinitionId: 'mock',
      attributes: [{ name: 'riderId' }],
      comment: 'x',
    });
    const proof = await mock.getProofStatus(request.proofRecordId);
    expect(request.invitation).toContain('/proof/');
    if (scenario === 'INVALID') expect(proof.cryptographicVerification).toBe('FAIL');
    if (scenario === 'REVOKED') expect(proof.revocation).toBe('REVOKED');
    if (scenario === 'UNTRUSTED') expect(proof.issuerDid).toBe('did:mock:untrusted');
  });
});

function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') throw new Error('Expected a JSON request body');
  return JSON.parse(body);
}
