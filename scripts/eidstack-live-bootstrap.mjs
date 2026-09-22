import { createRequire } from 'node:module';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { EidStackLiveBootstrapError, runLiveBootstrap } from './eidstack-live-bootstrap-lib.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const statePath = join(repositoryRoot, '.deligate', 'eidstack-live-state.json');
const envPath = join(repositoryRoot, '.env');
const managedKeys = [
  'EIDSTACK_MODE',
  'EIDSTACK_DELIVERY_TENANT_ID',
  'EIDSTACK_BUILDING_TENANT_ID',
  'EIDSTACK_DELIVERY_ORGANIZATION_ID',
  'EIDSTACK_BUILDING_ORGANIZATION_ID',
  'EIDSTACK_RIDER_SCHEMA_ID',
  'EIDSTACK_RIDER_CREDENTIAL_DEFINITION_ID',
  'EIDSTACK_RIDER_REVOCATION_SUPPORTED',
  'EIDSTACK_ACCESS_SCHEMA_ID',
  'EIDSTACK_ACCESS_CREDENTIAL_DEFINITION_ID',
];

function fail(code, message) {
  throw new EidStackLiveBootstrapError(code, message);
}

export function loadRootEnvironment(path = envPath) {
  try {
    loadEnvFile(path);
  } catch (error) {
    if (error?.code !== 'ENOENT')
      fail('CONFIGURATION_UNAVAILABLE', 'The root .env file cannot be read safely.');
  }
  return process.env;
}

function requireEnv(env, key) {
  if (!env[key]) fail('CONFIGURATION_UNAVAILABLE', `${key} is required for configure-local.`);
  return env[key];
}

export function assertLocalSupabaseUrl(value) {
  try {
    if (!['127.0.0.1', 'localhost'].includes(new URL(value).hostname)) throw new Error();
  } catch {
    fail('LOCAL_ONLY', 'configure-local refuses non-local SUPABASE_URL values.');
  }
}

async function query(request, message) {
  const { data, error } = await request;
  if (error) fail('LOCAL_BINDING_UNAVAILABLE', message);
  return data;
}

async function resolveAccount(supabase, { email, role, organizationType }) {
  const users = await query(
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    `Could not inspect the local demo identity for ${email}.`,
  );
  const user = users?.users?.find((candidate) => candidate.email === email);
  if (!user?.id) fail('LOCAL_BINDING_UNAVAILABLE', `Local demo identity is missing: ${email}.`);
  const profile = await query(
    supabase.from('profiles').select('id,role,organization_id').eq('id', user.id).maybeSingle(),
    `Local demo profile lookup failed for ${email}.`,
  );
  if (!profile?.id || !profile.organization_id)
    fail('LOCAL_BINDING_UNAVAILABLE', `Local demo profile is missing for ${email}.`);
  if (profile.role !== role)
    fail('LOCAL_BINDING_UNAVAILABLE', `Local demo role is invalid for ${email}.`);
  const organization = await query(
    supabase
      .from('organizations')
      .select('id,type')
      .eq('id', profile.organization_id)
      .maybeSingle(),
    `Local demo organization lookup failed for ${email}.`,
  );
  if (!organization?.id)
    fail('LOCAL_BINDING_UNAVAILABLE', `Local demo organization is missing for ${email}.`);
  if (organization.type !== organizationType)
    fail('LOCAL_BINDING_UNAVAILABLE', `Local demo organization type is invalid for ${email}.`);
  return organization.id;
}

function createLocalSupabaseClient(url, secretKey) {
  const require = createRequire(resolve(process.cwd(), 'apps/api/package.json'));
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function managedValues(state, bindings) {
  for (const role of ['delivery', 'building']) {
    const entry = state[role];
    if (!entry?.tenantId || !entry.schemaId || !entry.credentialDefinitionId)
      fail('INCOMPLETE_STATE', `The ${role} eidStack role is incomplete after bootstrap.`);
  }
  return {
    EIDSTACK_MODE: 'live',
    EIDSTACK_DELIVERY_TENANT_ID: state.delivery.tenantId,
    EIDSTACK_BUILDING_TENANT_ID: state.building.tenantId,
    EIDSTACK_DELIVERY_ORGANIZATION_ID: bindings.deliveryOrganizationId,
    EIDSTACK_BUILDING_ORGANIZATION_ID: bindings.buildingOrganizationId,
    EIDSTACK_RIDER_SCHEMA_ID: state.delivery.schemaId,
    EIDSTACK_RIDER_CREDENTIAL_DEFINITION_ID: state.delivery.credentialDefinitionId,
    EIDSTACK_RIDER_REVOCATION_SUPPORTED: 'true',
    EIDSTACK_ACCESS_SCHEMA_ID: state.building.schemaId,
    EIDSTACK_ACCESS_CREDENTIAL_DEFINITION_ID: state.building.credentialDefinitionId,
  };
}

export async function updateManagedEnvironment(path, values) {
  let original = '';
  try {
    original = await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT')
      fail('CONFIGURATION_UNAVAILABLE', 'The root .env file cannot be updated safely.');
  }
  const seen = new Set();
  const lines = original.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    const key = match?.[1];
    if (!key || !managedKeys.includes(key)) return [line];
    if (seen.has(key)) return [];
    seen.add(key);
    return [`${key}=${values[key]}`];
  });
  for (const key of managedKeys) if (!seen.has(key)) lines.push(`${key}=${values[key]}`);
  const content = `${lines.filter((line, index, all) => line || index < all.length - 1).join('\n')}\n`;
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, path);
}

export async function runConfigureLocal({
  env,
  statePath: configuredStatePath = statePath,
  envPath: configuredEnvPath = envPath,
  fetchImpl,
  supabaseClient,
  output = console.log,
}) {
  const apiKey = requireEnv(env, 'EIDSTACK_API_KEY');
  const supabaseUrl = requireEnv(env, 'SUPABASE_URL');
  const supabaseSecretKey = requireEnv(env, 'SUPABASE_SECRET_KEY');
  assertLocalSupabaseUrl(supabaseUrl);
  const bootstrap = await runLiveBootstrap({
    command: 'bootstrap',
    apiKey,
    baseUrl: env.EIDSTACK_BASE_URL,
    statePath: configuredStatePath,
    fetchImpl,
    output,
  });
  const supabase = supabaseClient ?? createLocalSupabaseClient(supabaseUrl, supabaseSecretKey);
  const [deliveryOrganizationId, buildingOrganizationId] = await Promise.all([
    resolveAccount(supabase, {
      email: 'delivery.admin@deligate.local',
      role: 'DELIVERY_ADMIN',
      organizationType: 'DELIVERY_COMPANY',
    }),
    resolveAccount(supabase, {
      email: 'building.security@deligate.local',
      role: 'BUILDING_SECURITY',
      organizationType: 'BUILDING_OPERATOR',
    }),
  ]);
  await updateManagedEnvironment(
    configuredEnvPath,
    managedValues(bootstrap.state, { deliveryOrganizationId, buildingOrganizationId }),
  );
  output('Delivery application binding: READY');
  output('Building application binding: READY');
  output('eidStack delivery tenant: READY');
  output('eidStack building tenant: READY');
  return { ...bootstrap, deliveryOrganizationId, buildingOrganizationId };
}

async function main() {
  const env = loadRootEnvironment();
  const command = process.argv[2];
  if (command === 'configure-local') {
    await runConfigureLocal({ env });
    return;
  }
  await runLiveBootstrap({
    command,
    apiKey: env.EIDSTACK_API_KEY,
    baseUrl: env.EIDSTACK_BASE_URL,
    statePath,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    if (error instanceof EidStackLiveBootstrapError)
      console.error(`${error.code}: ${error.message}`);
    else
      console.error(
        'UNEXPECTED_FAILURE: eidStack live bootstrap failed without a safe diagnostic.',
      );
    process.exitCode = 1;
  });
}
