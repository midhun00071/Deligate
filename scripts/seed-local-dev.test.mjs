import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const { demoPassword, demoUsers, ensureDemoUser } = await import('./seed-local-dev.mjs');

test('updates only an existing named local demo account to the deterministic password', async () => {
  const updates = [];
  const admin = {
    listUsers: async () => ({ data: { users: [{ id: 'demo-user', email: demoUsers[0].email }] } }),
    updateUserById: async (id, input) => {
      updates.push({ id, input });
      return { data: { user: { id } } };
    },
    createUser: async () => assert.fail('an existing demo account must not be recreated'),
  };

  await ensureDemoUser(admin, demoUsers[0].email);

  assert.deepEqual(updates, [
    { id: 'demo-user', input: { password: demoPassword, email_confirm: true } },
  ]);
  assert.deepEqual(
    demoUsers.map((user) => user.email),
    ['delivery.admin@deligate.local', 'building.security@deligate.local'],
  );
});
