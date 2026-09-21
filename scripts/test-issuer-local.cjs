// Explicit local-only mock E2E against real Supabase Auth, RLS, repositories and Nest.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const { createClient } = apiRequire('@supabase/supabase-js');
const { NestFactory } = apiRequire('@nestjs/core');
process.loadEnvFile(path.join(root, '.env'));
const url = process.env.SUPABASE_URL;
if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  throw new Error('This test requires local Supabase. Remote databases are never used.');
}
process.env.EIDSTACK_MODE = 'mock';
process.env.NODE_ENV = 'test';
process.env.APP_ENV = 'development';
const { AppModule } = apiRequire('./dist/app.module.js');
const db = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const org = randomUUID();
const userId = randomUUID();
const password = randomUUID() + '-Aa1!';
const email = `issuer-${userId}@example.test`;
let app;
let createdUser;

async function check(query) {
  const result = await query;
  if (result.error) throw new Error('Local fixture/database operation failed');
  return result.data;
}

async function run() {
  await check(
    db
      .from('organizations')
      .insert({ id: org, name: 'Macro A isolated test', type: 'DELIVERY_COMPANY' }),
  );
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error('Test account creation failed');
  createdUser = created.data.user.id;
  await check(
    db.from('profiles').insert({
      id: createdUser,
      organization_id: org,
      role: 'DELIVERY_ADMIN',
      display_name: 'Test admin',
    }),
  );
  const client = createClient(url, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw new Error('Test account sign-in failed');
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  async function request(route, method = 'GET', body) {
    const response = await fetch(`${base}/api${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${signedIn.data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.ok(response.ok, `HTTP request failed: ${method} ${route} (${response.status})`);
    return response.json();
  }
  const rider = await request('/riders', 'POST', { employeeReference: 'MACRO-A-TEST' });
  assert.equal(rider.organizationId, org);
  const list = await request('/riders?search=MACRO-A&limit=5');
  assert.equal(list.total, 1);
  const offered = await request(`/riders/${rider.id}/issuance`, 'POST');
  assert.equal(offered.credential.state, 'AWAITING_WALLET');
  assert.equal(offered.credential.source, 'mock');
  const repeat = await request(`/riders/${rider.id}/issuance`, 'POST');
  assert.equal(repeat.credential.id, offered.credential.id);
  assert.equal(repeat.invitation, offered.invitation);
  await new Promise((resolve) => setTimeout(resolve, 10500));
  const issued = await request(`/riders/${rider.id}/refresh`, 'POST');
  assert.equal(issued.credential.state, 'ISSUED');
  const revoked = await request(`/riders/${rider.id}/revoke`, 'POST', { confirmed: true });
  assert.equal(revoked.credential.state, 'REVOKED');
  assert.equal(revoked.invitation, undefined);
  await request(`/riders/${rider.id}/revoke`, 'POST', { confirmed: true });
  const overview = await request('/riders/overview');
  assert.equal(overview.revoked, 1);
  assert.ok(overview.recent.length >= 3);
  const rows = await check(
    db.from('credential_records').select('*').eq('issuer_organization_id', org),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'REVOKED');
  for (const key of ['invitation', 'raw_credential', 'private_key', 'proof'])
    assert.equal(key in rows[0], false);
  const direct = await client.from('riders').select('id').eq('employer_organization_id', org);
  assert.equal(direct.error, null);
  assert.deepEqual(direct.data, []);
  console.log('PASS: real local Supabase Auth + Nest + persistence + mock issuance + revoke + RLS');
}

async function cleanup() {
  if (app) await app.close();
  await check(db.from('credential_records').delete().eq('issuer_organization_id', org));
  await check(db.from('audit_events').delete().eq('organization_id', org));
  await check(db.from('riders').delete().eq('employer_organization_id', org));
  if (createdUser) {
    await check(db.from('profiles').delete().eq('id', createdUser));
    const deleted = await db.auth.admin.deleteUser(createdUser);
    if (deleted.error) throw new Error('Test auth cleanup failed');
  }
  await check(db.from('organizations').delete().eq('id', org));
}

run()
  .catch(() => {
    console.error(
      'FAIL: local issuer E2E. Check local services and schema; no secret response bodies are printed.',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
      console.log('Isolated test fixtures removed.');
    } catch {
      console.error('Fixture cleanup failed. Remove only the Macro A isolated test organization.');
      process.exitCode = 1;
    }
  });
