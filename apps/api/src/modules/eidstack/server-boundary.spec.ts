import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(folder, entry.name))
      : /\.(ts|tsx)$/.test(entry.name)
        ? [join(folder, entry.name)]
        : [],
  );
}

it('keeps all server issuer modules and keys out of the universal client source', () => {
  for (const file of sourceFiles('../mobile/src')) {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(
      /@deligate\/eidstack|EIDSTACK_API_KEY|x-api-key|EIDSTACK_DELIVERY_TENANT_ID|SUPABASE_SECRET_KEY/,
    );
  }
  const publicEnv = readFileSync('../mobile/.env.example', 'utf8');
  expect(publicEnv).not.toMatch(/EIDSTACK|SERVICE_ROLE|SECRET_KEY/);
});
