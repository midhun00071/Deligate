import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const DEFAULT_EIDSTACK_BASE_URL = 'https://test.e-idstack.com/api/v1';

const ROLE_DEFINITIONS = {
  delivery: {
    label: 'delivery issuer',
    schemaName: 'AuthorizationRecord',
    attributes: ['riderId', 'deliveryCompany', 'riderStatus'],
  },
  building: {
    label: 'building verifier/access issuer',
    schemaName: 'AccessRecord',
    attributes: ['accessId', 'buildingId', 'accessScope', 'validFrom', 'validUntil'],
  },
};

const ROLE_KEYS = Object.keys(ROLE_DEFINITIONS);
const STATE_KEYS = [
  'tenantId',
  'did',
  'schemaId',
  'credentialDefinitionId',
  'revocationRegistryId',
  'tenantLabel',
];
const REQUIRED_ROLE_KEYS = STATE_KEYS.slice(0, 5);

export class EidStackLiveBootstrapError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'EidStackLiveBootstrapError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new EidStackLiveBootstrapError(code, message);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSafeString(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 2048;
}

function normalizeBaseUrl(baseUrl) {
  const value = baseUrl || DEFAULT_EIDSTACK_BASE_URL;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      fail('CONFIGURATION_UNAVAILABLE', 'EIDSTACK_BASE_URL must be an HTTPS API base URL.');
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    if (error instanceof EidStackLiveBootstrapError) throw error;
    fail('CONFIGURATION_UNAVAILABLE', 'EIDSTACK_BASE_URL must be an HTTPS API base URL.');
  }
}

export function generateTenantSeed() {
  return randomBytes(16).toString('hex');
}

export function validateState(value) {
  if (!isRecord(value)) fail('INVALID_STATE', 'The local live state must be a JSON object.');
  for (const key of Object.keys(value)) {
    if (!ROLE_KEYS.includes(key))
      fail('INVALID_STATE', `The local state has an unsupported key: ${key}.`);
  }
  for (const role of ROLE_KEYS) {
    const entry = value[role];
    if (entry === undefined) continue;
    if (!isRecord(entry)) fail('INVALID_STATE', `The ${role} state must be an object.`);
    for (const key of Object.keys(entry)) {
      if (!STATE_KEYS.includes(key) || !isSafeString(entry[key]))
        fail('INVALID_STATE', `The ${role} state contains an invalid reference.`);
    }
  }
  return value;
}

export async function loadState(statePath) {
  try {
    return validateState(JSON.parse(await readFile(statePath, 'utf8')));
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    if (error instanceof EidStackLiveBootstrapError) throw error;
    fail('INVALID_STATE', 'The local live state is unreadable or invalid JSON.');
  }
}

export async function saveState(statePath, state) {
  validateState(state);
  await mkdir(dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporaryPath, statePath);
}

function parseTenants(value) {
  if (!isRecord(value) || !Array.isArray(value.data))
    fail('CONTRACT_UNVERIFIED', 'Tenant inventory response does not match the observed contract.');
  return value.data.map((tenant) => {
    if (
      !isRecord(tenant) ||
      !isSafeString(tenant.tenantId) ||
      !isSafeString(tenant.label) ||
      !isSafeString(tenant.did) ||
      !isSafeString(tenant.network)
    ) {
      fail(
        'CONTRACT_UNVERIFIED',
        'Tenant inventory response does not match the observed contract.',
      );
    }
    return tenant;
  });
}

export function parseSchemaResponse(value) {
  if (
    !isRecord(value) ||
    !isRecord(value.data) ||
    !isSafeString(value.data.schemaId) ||
    value.data.state !== 'finished'
  )
    fail(
      'CONTRACT_UNVERIFIED',
      'Schema response does not match the observed finished-state contract.',
    );
  return { schemaId: value.data.schemaId };
}

export function parseCredentialDefinitionResponse(value) {
  if (
    !isRecord(value) ||
    !isRecord(value.data) ||
    !isSafeString(value.data.credentialDefinitionId) ||
    value.data.state !== 'finished' ||
    !isSafeString(value.data.revocationRegistryId)
  ) {
    fail(
      'CONTRACT_UNVERIFIED',
      'Credential-definition response does not match the observed finished-state contract.',
    );
  }
  return {
    credentialDefinitionId: value.data.credentialDefinitionId,
    revocationRegistryId: value.data.revocationRegistryId,
  };
}

class EidStackLiveClient {
  constructor({ apiKey, baseUrl, fetchImpl }) {
    if (!isSafeString(apiKey))
      fail(
        'CONFIGURATION_UNAVAILABLE',
        'EIDSTACK_API_KEY is required for live eidStack operations.',
      );
    this.apiKey = apiKey;
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.fetch = fetchImpl ?? fetch;
  }

  async request(method, path, { body, tenantId, parseJson = true } = {}) {
    const headers = { 'x-api-key': this.apiKey };
    if (tenantId) headers['x-tenant-id'] = tenantId;
    if (body !== undefined) headers['content-type'] = 'application/json';
    let response;
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, {
        method,
        redirect: 'error',
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      fail('UPSTREAM_UNAVAILABLE', 'eidStack live request could not be completed.');
    }
    if (!response.ok)
      fail('UPSTREAM_REJECTED', `eidStack live request failed with HTTP ${response.status}.`);
    if (!parseJson) return undefined;
    try {
      return await response.json();
    } catch {
      fail('CONTRACT_UNVERIFIED', 'eidStack returned an unreadable JSON response.');
    }
  }

  verifyHealth() {
    return this.request('GET', '/agents/details', { parseJson: false });
  }

  async listTenants() {
    return parseTenants(await this.request('GET', '/agents/tenants'));
  }

  async createTenant(label) {
    const seed = generateTenantSeed();
    await this.request('POST', '/agents/tenants/create', {
      body: { config: { label }, seed, network: 'BCOVRIN_TESTNET' },
      parseJson: false,
    });
  }

  createSchema(role, entry) {
    const definition = ROLE_DEFINITIONS[role];
    return this.request('POST', '/issuance/schema', {
      tenantId: entry.tenantId,
      body: {
        issuerId: entry.did,
        name: definition.schemaName,
        version: '1.0.0',
        attributes: definition.attributes.map((attributeName) => ({
          attributeName,
          schemaDataType: 'string',
          displayName: attributeName,
        })),
      },
    });
  }

  createCredentialDefinition(entry) {
    return this.request('POST', '/issuance/credential-definition', {
      tenantId: entry.tenantId,
      body: {
        issuerId: entry.did,
        schemaId: entry.schemaId,
        supportRevocation: true,
        tag: 'v1',
      },
    });
  }
}

function roleCondition(entry, tenants) {
  if (entry === undefined) return 'UNCONFIGURED';
  const tenant = isSafeString(entry.tenantId)
    ? tenants.find((candidate) => candidate.tenantId === entry.tenantId)
    : undefined;
  if (!tenant) return 'MISSING';
  if (!REQUIRED_ROLE_KEYS.every((key) => isSafeString(entry[key])) || entry.did !== tenant.did)
    return 'MISSING';
  return 'PRESENT';
}

function assertReusableRole(entry, tenant, role) {
  if (!REQUIRED_ROLE_KEYS.every((key) => isSafeString(entry[key])))
    fail(
      'INCOMPLETE_STATE',
      `${ROLE_DEFINITIONS[role].label} is present but its local artifact references are incomplete.`,
    );
  if (entry.did !== tenant.did)
    fail(
      'INCOMPLETE_STATE',
      `${ROLE_DEFINITIONS[role].label} DID does not match the tracked tenant.`,
    );
}

function makeTenantLabel() {
  return `cn-${randomBytes(16).toString('hex')}`;
}

async function createRole({ client, state, role, statePath }) {
  const tenantLabel = makeTenantLabel();
  await client.createTenant(tenantLabel);
  const tenant = (await client.listTenants()).find((candidate) => candidate.label === tenantLabel);
  if (!tenant)
    fail(
      'CONTRACT_UNVERIFIED',
      'Tenant creation succeeded but the new tenant was not found by its label.',
    );

  state[role] = { tenantId: tenant.tenantId, did: tenant.did, tenantLabel };
  await saveState(statePath, state);

  const schema = parseSchemaResponse(await client.createSchema(role, state[role]));
  state[role] = { ...state[role], schemaId: schema.schemaId };
  await saveState(statePath, state);

  const definition = parseCredentialDefinitionResponse(
    await client.createCredentialDefinition(state[role]),
  );
  state[role] = { ...state[role], ...definition };
  await saveState(statePath, state);
}

function reportRole(output, role, entry, tenants) {
  const condition = roleCondition(entry, tenants);
  output(`${ROLE_DEFINITIONS[role].label}: ${condition}`);
  if (entry) {
    for (const key of STATE_KEYS) if (entry[key]) output(`  ${key}: ${entry[key]}`);
  }
}

function printSummary(output, state) {
  output('Live bootstrap complete. Copy only into server-side configuration:');
  output(`EIDSTACK_DELIVERY_TENANT_ID=${state.delivery.tenantId}`);
  output(`EIDSTACK_RIDER_SCHEMA_ID=${state.delivery.schemaId}`);
  output(`EIDSTACK_RIDER_CREDENTIAL_DEFINITION_ID=${state.delivery.credentialDefinitionId}`);
  output(`EIDSTACK_BUILDING_TENANT_ID=${state.building.tenantId}`);
  output(`EIDSTACK_ACCESS_SCHEMA_ID=${state.building.schemaId}`);
  output(`EIDSTACK_ACCESS_CREDENTIAL_DEFINITION_ID=${state.building.credentialDefinitionId}`);
}

export async function runLiveBootstrap({
  command,
  apiKey,
  baseUrl,
  statePath,
  fetchImpl,
  output = console.log,
}) {
  if (command !== 'status' && command !== 'bootstrap')
    fail('INVALID_COMMAND', 'Use either "status" or "bootstrap".');
  const client = new EidStackLiveClient({ apiKey, baseUrl, fetchImpl });
  await client.verifyHealth();
  let tenants = await client.listTenants();
  const state = await loadState(statePath);

  if (command === 'status') {
    output('eidStack live API/auth health: OK');
    for (const role of ROLE_KEYS) reportRole(output, role, state[role], tenants);
    return { state, tenants };
  }

  for (const role of ROLE_KEYS) {
    const entry = state[role];
    const tenant = entry?.tenantId
      ? tenants.find((candidate) => candidate.tenantId === entry.tenantId)
      : undefined;
    if (tenant) {
      assertReusableRole(entry, tenant, role);
      output(`${ROLE_DEFINITIONS[role].label}: PRESENT (reused)`);
      continue;
    }
    if (entry?.tenantId) output(`${ROLE_DEFINITIONS[role].label}: MISSING (creating replacement)`);
    else if (entry !== undefined)
      fail('INCOMPLETE_STATE', `${ROLE_DEFINITIONS[role].label} has incomplete local state.`);
    else output(`${ROLE_DEFINITIONS[role].label}: UNCONFIGURED (creating)`);
    await createRole({ client, state, role, statePath });
    tenants = await client.listTenants();
  }
  printSummary(output, state);
  return { state, tenants };
}
