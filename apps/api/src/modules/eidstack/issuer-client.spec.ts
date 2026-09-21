import {
  EidStackError,
  IssuerClient,
  LiveEidStackAdapter,
  LiveEidStackClient,
  MockEidStackAdapter,
  readEidStackConfig,
  validateIssuerInvitation,
} from '@deligate/eidstack';

const config = readEidStackConfig({
  EIDSTACK_MODE: 'live',
  EIDSTACK_API_KEY: 'test-only-key',
  EIDSTACK_DELIVERY_TENANT_ID: 'tenant-a',
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

  it('constructs the documented OOB request with server-only headers and minimal claims', async () => {
    await client.createOffer('schema-a', 'definition-a', claims);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe('https://test.e-idstack.com/api/v1/issuance/oob-offer');
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: {
        'x-api-key': 'test-only-key',
        'x-tenant-id': 'tenant-a',
        'Content-Type': 'application/json',
      },
    });
    expect(parseBody(init?.body)).toEqual({
      schemaId: 'schema-a',
      credentialDefinitionId: 'definition-a',
      attributes: claims,
      subjectAttribute: 'riderId',
      useConnection: false,
      autoAcceptCredential: false,
      comment: 'Delivery rider employment credential. Review and accept in your holder wallet.',
      category: 'employment',
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
      expect(init?.headers).toMatchObject({ 'x-tenant-id': 'tenant-a' });
  });

  it.each([400, 401, 500, 503])(
    'sanitizes upstream %s and never retries mutations',
    async (status) => {
      transport.mockResolvedValue(new Response('secret invitation raw credential', { status }));
      await expect(client.createOffer('s', 'd', claims)).rejects.toThrow(EidStackError);
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

  it('blocks live issuance before mutation when response fields are unverified', () => {
    const live = new LiveEidStackAdapter(config, transport);
    expect(() => live.issueRiderCredential({ requestId: 'r', claims })).toThrow(
      /verified sandbox response/,
    );
    expect(() =>
      live.getIssuanceStatus({ credentialExchangeId: 'x', requestedAt: claims.validFrom }),
    ).toThrow(EidStackError);
    expect(transport).not.toHaveBeenCalled();
    expect(JSON.stringify(live.technicalStatus())).not.toContain('test-only-key');
    expect(live.technicalStatus()).toMatchObject({ mode: 'live', responseContractVerified: false });
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
  it('deterministically simulates the same offer and wallet completion', async () => {
    const adapter = new MockEidStackAdapter({ now: () => Date.parse(claims.validFrom) + 10001 });
    const input = { requestId: 'same', claims };
    expect(await adapter.issueRiderCredential(input)).toEqual(
      await adapter.issueRiderCredential(input),
    );
    expect(
      await adapter.getIssuanceStatus({
        credentialExchangeId: 'mock-same',
        requestedAt: claims.validFrom,
      }),
    ).toBe('ISSUED');
    expect(adapter.technicalStatus().mode).toBe('mock');
  });
  it('supports explicit failures and a never-completing simulation', async () => {
    expect(() =>
      new MockEidStackAdapter({ fail: 'issue' }).issueRiderCredential({ requestId: 'x', claims }),
    ).toThrow(EidStackError);
    expect(() => new MockEidStackAdapter({ fail: 'revoke' }).revokeCredential('x')).toThrow(
      EidStackError,
    );
    expect(
      await new MockEidStackAdapter({ outcome: 'AWAITING_WALLET' }).getIssuanceStatus({
        credentialExchangeId: 'x',
        requestedAt: claims.validFrom,
      }),
    ).toBe('AWAITING_WALLET');
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

function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') throw new Error('Expected a JSON request body');
  return JSON.parse(body);
}
