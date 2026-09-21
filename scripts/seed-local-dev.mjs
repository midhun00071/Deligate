import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(resolve(root, 'apps/api/package.json'));
const { createClient } = require('@supabase/supabase-js');
process.loadEnvFile(resolve(root, '.env'));

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const testMode = process.env.NODE_ENV === 'test';
if (!testMode && (!url || !secret || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname))) {
  throw new Error('Local demo seed refused: SUPABASE_URL must be a local Supabase instance.');
}

const db = createClient(url ?? 'http://127.0.0.1:54321', secret ?? 'test-only', {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const demoUsers = [
  {
    email: 'delivery.admin@deligate.local',
    role: 'DELIVERY_ADMIN',
    name: 'Demo Delivery Admin',
    org: 'Deligate Demo Delivery',
  },
  {
    email: 'building.security@deligate.local',
    role: 'BUILDING_SECURITY',
    name: 'Demo Building Security',
    org: 'Deligate Demo Building',
  },
];
export const demoPassword = 'DeligateDemo2026!'; // LOCAL DEVELOPMENT ONLY; never used outside local Supabase.

async function value(request, message) {
  const result = await request;
  if (result.error) throw new Error(message);
  return result.data;
}

async function organization(name, type) {
  const existing = await value(
    db.from('organizations').select('id').eq('name', name).eq('type', type).maybeSingle(),
    'Could not check demo organization.',
  );
  if (existing) return existing.id;
  const created = await value(
    db.from('organizations').insert({ name, type }).select('id').single(),
    'Could not create demo organization.',
  );
  return created.id;
}

export async function ensureDemoUser(admin, email) {
  const listed = await value(
    admin.listUsers({ perPage: 1000 }),
    'Could not inspect local demo users.',
  );
  const existing = listed.users.find((user) => user.email === email);
  if (existing) {
    await value(
      admin.updateUserById(existing.id, { password: demoPassword, email_confirm: true }),
      'Could not update the local demo user password.',
    );
    return existing.id;
  }
  const created = await value(
    admin.createUser({ email, password: demoPassword, email_confirm: true }),
    'Could not create local demo user.',
  );
  if (!created.user) throw new Error('Local demo user creation returned no user.');
  return created.user.id;
}

async function run() {
  const deliveryOrg = await organization(demoUsers[0].org, 'DELIVERY_COMPANY');
  const buildingOrg = await organization(demoUsers[1].org, 'BUILDING_OPERATOR');
  for (const person of demoUsers) {
    const id = await ensureDemoUser(db.auth.admin, person.email);
    const organizationId = person.role === 'DELIVERY_ADMIN' ? deliveryOrg : buildingOrg;
    await value(
      db.from('profiles').upsert({
        id,
        organization_id: organizationId,
        role: person.role,
        display_name: person.name,
      }),
      'Could not save local demo profile.',
    );
  }
  const building = await value(
    db
      .from('buildings')
      .select('id')
      .eq('organization_id', buildingOrg)
      .eq('name', 'Deligate Demo Tower')
      .maybeSingle(),
    'Could not check demo building.',
  );
  const buildingId =
    building?.id ??
    (
      await value(
        db
          .from('buildings')
          .insert({
            organization_id: buildingOrg,
            name: 'Deligate Demo Tower',
            address_label: 'Local demonstration site',
          })
          .select('id')
          .single(),
        'Could not create demo building.',
      )
    ).id;
  const zone = await value(
    db
      .from('building_zones')
      .select('id')
      .eq('building_id', buildingId)
      .eq('zone_code', 'LOBBY')
      .maybeSingle(),
    'Could not check demo zone.',
  );
  if (!zone)
    await value(
      db.from('building_zones').insert({
        building_id: buildingId,
        zone_code: 'LOBBY',
        name: 'Main lobby',
        floor_label: 'Ground',
      }),
      'Could not create demo zone.',
    );
  console.log(
    JSON.stringify({
      seeded: true,
      deliveryAdmin: demoUsers[0].email,
      buildingSecurity: demoUsers[1].email,
    }),
  );
}

if (!testMode) await run();
