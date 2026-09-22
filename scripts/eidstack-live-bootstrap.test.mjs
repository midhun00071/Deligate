import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { EidStackLiveBootstrapError, generateTenantSeed, runLiveBootstrap, saveState } from './eidstack-live-bootstrap-lib.mjs';
import { loadRootEnvironment, runConfigureLocal } from './eidstack-live-bootstrap.mjs';
const apiKey = 'api-key-that-must-not-persist';
function role(role) {
  return {
    tenantId: `${role}-tenant`,
    did: `did:test:${role}`,
    schemaId: `${role}-schema`,
    credentialDefinitionId: `${role}-definition`,
    revocationRegistryId: `${role}-revocation`,
    tenantLabel: `deligate-${role}-existing`,
  };
}
function tenant(entry) { return { tenantId: entry.tenantId, label: entry.tenantLabel, did: entry.did, network: 'BCOVRIN_TESTNET' }; }
function fakeEidstack({
  tenants = [],
  schema = { data: { schemaId: 'new-schema', state: 'finished' } },
  definition = {
    data: {
      credentialDefinitionId: 'new-definition',
      state: 'finished',
      revocationRegistryId: 'new-revocation',
    },
  },
} = {}) {
  const calls = [];
  let nextTenant = 1;
  const fetchImpl = async (url, init) => {
    const request = {
      url: String(url),
      method: init.method,
      body: init.body,
      headers: init.headers,
    };
    calls.push(request);
    const path = new URL(url).pathname;
    if (path.endsWith('/agents/details')) return Response.json({ authenticated: true });
    if (path.endsWith('/agents/tenants')) return Response.json({ data: tenants });
    if (path.endsWith('/agents/tenants/create')) {
      const body = JSON.parse(init.body);
      const entry = {
        tenantId: `new-tenant-${nextTenant++}`,
        label: body.config.label,
        did: `did:test:${body.config.label}`,
        network: body.network,
      };
      tenants.push(entry);
      return Response.json({ ignored: 'tenant create response is never parsed' });
    }
    if (path.endsWith('/issuance/schema')) return Response.json(schema);
    if (path.endsWith('/issuance/credential-definition')) return Response.json(definition);
    throw new Error(`Unexpected path: ${path}`);
  };
  return { calls, fetchImpl };
}
async function withState(testBody) {
  const directory = await mkdtemp(join(tmpdir(), 'deligate-live-bootstrap-'));
  const statePath = join(directory, 'state.json');
  try {
    await testBody(statePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
function run(command, statePath, fake, output = () => {}) {
  return runLiveBootstrap({ command, apiKey, statePath, fetchImpl: fake.fetchImpl, output });
}
function localSupabase({ delivery = {}, building = {} } = {}) {
  const accounts = {
    delivery: {
      user: { id: 'delivery-user', email: 'delivery.admin@deligate.local' },
      profile: {
        id: 'delivery-user',
        role: 'DELIVERY_ADMIN',
        organization_id: 'delivery-org',
        ...delivery.profile,
      },
      organization: { id: 'delivery-org', type: 'DELIVERY_COMPANY', ...delivery.organization },
    },
    building: {
      user: { id: 'building-user', email: 'building.security@deligate.local' },
      profile: {
        id: 'building-user',
        role: 'BUILDING_SECURITY',
        organization_id: 'building-org',
        ...building.profile,
      },
      organization: { id: 'building-org', type: 'BUILDING_OPERATOR', ...building.organization },
    },
  };
  const allUsers = [accounts.delivery.user, accounts.building.user].filter(Boolean);
  return {
    auth: { admin: { listUsers: async () => ({ data: { users: allUsers }, error: null }) } },
    from(table) {
      return {
        select: () => ({
          eq: (_column, id) => ({
            maybeSingle: async () => {
              const account = Object.values(accounts).find(
                (entry) => entry.user?.id === id || entry.profile?.organization_id === id,
              );
              const data = table === 'profiles' ? account?.profile : account?.organization;
              return { data, error: null };
            },
          }),
        }),
      };
    },
  };
}
function configureEnv(overrides = {}) {
  return {
    EIDSTACK_API_KEY: apiKey,
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_SECRET_KEY: 'local-secret-that-must-not-print',
    ...overrides,
  };
}
test('generates fresh tenant seeds as 32 hexadecimal characters', () => {
  const first = generateTenantSeed();
  const second = generateTenantSeed();
  assert.match(first, /^[0-9a-f]{32}$/);
  assert.match(second, /^[0-9a-f]{32}$/);
  assert.notEqual(first, second);
});
test('loads a root .env API key without replacing an explicit shell value', async () =>
  withState(async (statePath) => {
    const rootEnvPath = join(dirname(statePath), '.env');
    const key = 'EIDSTACK_LIVE_BOOTSTRAP_ENV_TEST_KEY';
    const previous = process.env[key];
    try {
      delete process.env[key];
      await writeFile(rootEnvPath, `${key}=root-env-key-that-must-not-print\n`);
      assert.equal(loadRootEnvironment(rootEnvPath)[key], 'root-env-key-that-must-not-print');
      process.env[key] = 'explicit-shell-value';
      assert.equal(loadRootEnvironment(rootEnvPath)[key], 'explicit-shell-value');
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }));
test('status is read-only and reports configured roles without exposing the API key', async () => {
  await withState(async (statePath) => {
    const state = { delivery: role('delivery'), building: role('building') };
    await saveState(statePath, state);
    const fake = fakeEidstack({ tenants: [tenant(state.delivery), tenant(state.building)] });
    const lines = [];
    await run('status', statePath, fake, (line) => lines.push(line));
    assert.equal(
      fake.calls.some((call) => call.method === 'POST'),
      false,
    );
    assert.match(lines.join('\n'), /delivery issuer: PRESENT/);
    assert.equal(lines.join('\n').includes(apiKey), false);
  });
});
test('bootstrap fails immediately when the API key is absent', async () => {
  await withState(async (statePath) => {
    const fake = fakeEidstack();
    await assert.rejects(
      runLiveBootstrap({ command: 'bootstrap', statePath, fetchImpl: fake.fetchImpl }),
      (error) =>
        error instanceof EidStackLiveBootstrapError && error.code === 'CONFIGURATION_UNAVAILABLE',
    );
    assert.equal(fake.calls.length, 0);
  });
});
test('bootstrap reuses an existing complete role without duplicate creation', async () => {
  await withState(async (statePath) => {
    const state = { delivery: role('delivery'), building: role('building') };
    await saveState(statePath, state);
    const fake = fakeEidstack({ tenants: [tenant(state.delivery), tenant(state.building)] });
    const result = await run('bootstrap', statePath, fake);
    assert.deepEqual(result.state, state);
    assert.equal(
      fake.calls.some((call) => call.method === 'POST'),
      false,
    );
  });
});
test('a missing role is replaced without recreating the other complete role', async () => {
  await withState(async (statePath) => {
    const state = { delivery: role('delivery'), building: role('building') };
    await saveState(statePath, state);
    const fake = fakeEidstack({ tenants: [tenant(state.building)] });
    const result = await run('bootstrap', statePath, fake);
    const posts = fake.calls.filter((call) => call.method === 'POST');
    assert.equal(posts.length, 3);
    assert.equal(posts.filter((call) => call.url.endsWith('/issuance/schema')).length, 1);
    assert.equal(
      posts.filter((call) => call.url.endsWith('/issuance/credential-definition')).length,
      1,
    );
    assert.equal(result.state.building.tenantId, state.building.tenantId);
    assert.notEqual(result.state.delivery.tenantId, state.delivery.tenantId);
  });
  await withState(async (statePath) => {
    const state = { delivery: role('delivery'), building: role('building') };
    await saveState(statePath, state);
    const fake = fakeEidstack({ tenants: [tenant(state.delivery)] });
    const result = await run('bootstrap', statePath, fake);
    assert.equal(fake.calls.filter((call) => call.method === 'POST').length, 3);
    assert.equal(result.state.delivery.tenantId, state.delivery.tenantId);
    assert.notEqual(result.state.building.tenantId, state.building.tenantId);
  });
});
test('an existing tenant with incomplete local artifacts fails closed', async () => {
  await withState(async (statePath) => {
    const delivery = {
      tenantId: 'delivery-tenant',
      did: 'did:test:delivery',
      tenantLabel: 'deligate-delivery-existing',
    };
    await saveState(statePath, { delivery, building: role('building') });
    const fake = fakeEidstack({ tenants: [tenant(delivery), tenant(role('building'))] });
    await assert.rejects(
      run('bootstrap', statePath, fake),
      (error) => error instanceof EidStackLiveBootstrapError && error.code === 'INCOMPLETE_STATE',
    );
    assert.equal(
      fake.calls.some((call) => call.method === 'POST'),
      false,
    );
  });
});
test('malformed schema and credential-definition responses are rejected', async () => {
  await withState(async (statePath) => {
    const schemaFake = fakeEidstack({ schema: { data: { schemaId: 'schema', state: 'queued' } } });
    await assert.rejects(
      run('bootstrap', statePath, schemaFake),
      (error) =>
        error instanceof EidStackLiveBootstrapError && error.code === 'CONTRACT_UNVERIFIED',
    );
  });
  await withState(async (statePath) => {
    const definitionFake = fakeEidstack({
      definition: { data: { credentialDefinitionId: 'definition', state: 'finished' } },
    });
    await assert.rejects(
      run('bootstrap', statePath, definitionFake),
      (error) =>
        error instanceof EidStackLiveBootstrapError && error.code === 'CONTRACT_UNVERIFIED',
    );
  });
});
test('state stores only public references and never stores API keys or seeds', async () => {
  await withState(async (statePath) => {
    const unrelated = { tenantId: 'old-friendly-tenant', label: 'Deligate deli', did: 'did:test:unrelated', network: 'BCOVRIN_TESTNET' };
    const fake = fakeEidstack({ tenants: [unrelated] });
    const result = await run('bootstrap', statePath, fake);
    const rawState = await readFile(statePath, 'utf8');
    const tenantBodies = fake.calls
      .filter((call) => call.url.endsWith('/agents/tenants/create'))
      .map((call) => JSON.parse(call.body));
    const definitionBodies = fake.calls
      .filter((call) => call.url.endsWith('/issuance/credential-definition'))
      .map((call) => JSON.parse(call.body));
    const schemaBodies = fake.calls
      .filter((call) => call.url.endsWith('/issuance/schema'))
      .map((call) => JSON.parse(call.body));
    assert.equal(rawState.includes(apiKey), false);
    for (const body of tenantBodies) assert.equal(rawState.includes(body.seed), false);
    assert.equal(rawState.includes('credentialDefinition"'), false);
    assert.deepEqual(Object.keys(result.state.delivery).sort(), [
      'credentialDefinitionId',
      'did',
      'revocationRegistryId',
      'schemaId',
      'tenantId',
      'tenantLabel',
    ]);
    assert.equal(
      tenantBodies.every((body) => /^[0-9a-f]{32}$/.test(body.seed)),
      true,
    );
    const labels = tenantBodies.map((body) => body.config.label);
    assert.equal(new Set(labels).size, labels.length);
    assert(labels.every((label) => /^cn-[0-9a-f]{32}$/.test(label) && !/deligate|delivery|building|rider/i.test(label)));
    assert.deepEqual([result.state.delivery.tenantLabel, result.state.building.tenantLabel], labels);
    assert.notEqual(result.state.delivery.tenantId, unrelated.tenantId);
    const schemaIssuerIds = Object.fromEntries(
      schemaBodies.map((body) => [body.name, body.issuerId]),
    );
    assert.equal(schemaIssuerIds.AuthorizationRecord, result.state.delivery.did);
    assert.equal(schemaIssuerIds.AccessRecord, result.state.building.did);
    assert.equal(
      definitionBodies.every((body) => body.supportRevocation === true),
      true,
    );
    assert.equal(
      definitionBodies.every((body) => body.tag === 'v1' && typeof body.issuerId === 'string'),
      true,
    );
  });
});
test('configure-local refuses remote Supabase before eidStack or Supabase access', async () => {
  await withState(async (statePath) => {
    const fake = fakeEidstack();
    await assert.rejects(
      runConfigureLocal({
        env: configureEnv({ SUPABASE_URL: 'https://project.supabase.co' }),
        statePath,
        fetchImpl: fake.fetchImpl,
      }),
      (error) => error instanceof EidStackLiveBootstrapError && error.code === 'LOCAL_ONLY',
    );
    assert.equal(fake.calls.length, 0);
  });
});
test('configure-local resolves both supported local application roles and preserves secrets', async () => {
  await withState(async (statePath) => {
    const envPath = join(dirname(statePath), '.env');
    await writeFile(
      envPath,
      'UNRELATED=value\nEIDSTACK_API_KEY=existing-key\nEIDSTACK_MODE=mock\n',
    );
    const state = { delivery: role('delivery'), building: role('building') };
    await saveState(statePath, state);
    const fake = fakeEidstack({ tenants: [tenant(state.delivery), tenant(state.building)] });
    const lines = [];
    const result = await runConfigureLocal({
      env: configureEnv(),
      statePath,
      envPath,
      fetchImpl: fake.fetchImpl,
      supabaseClient: localSupabase(),
      output: (line) => lines.push(line),
    });
    const written = await readFile(envPath, 'utf8');
    assert.equal(
      fake.calls.some((call) => call.method === 'POST'),
      false,
    );
    assert.equal(result.deliveryOrganizationId, 'delivery-org');
    assert.equal(result.buildingOrganizationId, 'building-org');
    assert.match(written, /^UNRELATED=value$/m);
    assert.match(written, /^EIDSTACK_API_KEY=existing-key$/m);
    assert.match(written, /^EIDSTACK_DELIVERY_ORGANIZATION_ID=delivery-org$/m);
    assert.match(written, /^EIDSTACK_BUILDING_ORGANIZATION_ID=building-org$/m);
    assert.match(written, /^EIDSTACK_DELIVERY_TENANT_ID=delivery-tenant$/m);
    assert.match(written, /^EIDSTACK_BUILDING_TENANT_ID=building-tenant$/m);
    assert.equal(written.includes(apiKey), false);
    assert.equal(lines.join('\n').includes(apiKey), false);
  });
});
test('configure-local fails closed for invalid local application bindings', async () => {
  for (const [label, supabase] of [
    ['wrong role', localSupabase({ delivery: { profile: { role: 'RIDER' } } })],
    [
      'missing profile',
      localSupabase({ delivery: { profile: { id: null, organization_id: null } } }),
    ],
    ['missing organization', localSupabase({ building: { organization: { id: null } } })],
  ]) {
    await withState(async (statePath) => {
      const state = { delivery: role('delivery'), building: role('building') };
      await saveState(statePath, state);
      const fake = fakeEidstack({ tenants: [tenant(state.delivery), tenant(state.building)] });
      await assert.rejects(
        runConfigureLocal({
          env: configureEnv(),
          statePath,
          envPath: join(dirname(statePath), '.env'),
          fetchImpl: fake.fetchImpl,
          supabaseClient: supabase,
        }),
        (error) =>
          error instanceof EidStackLiveBootstrapError && error.code === 'LOCAL_BINDING_UNAVAILABLE',
        label,
      );
    });
  }
});
test('configure-local replaces only the missing eidStack role before binding', async () => {
  for (const [missing, present] of [
    ['delivery', 'building'],
    ['building', 'delivery'],
  ]) {
    await withState(async (statePath) => {
      const state = { delivery: role('delivery'), building: role('building') };
      await saveState(statePath, state);
      const fake = fakeEidstack({ tenants: [tenant(state[present])] });
      const result = await runConfigureLocal({
        env: configureEnv(),
        statePath,
        envPath: join(dirname(statePath), '.env'),
        fetchImpl: fake.fetchImpl,
        supabaseClient: localSupabase(),
      });
      assert.equal(fake.calls.filter((call) => call.method === 'POST').length, 3);
      assert.equal(result.state[present].tenantId, state[present].tenantId);
      assert.notEqual(result.state[missing].tenantId, state[missing].tenantId);
    });
  }
});
