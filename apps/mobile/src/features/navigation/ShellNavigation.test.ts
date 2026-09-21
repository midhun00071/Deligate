import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('workspace navigation entries are pressable and compact selection closes the drawer', () => {
  const navigation = readFileSync('src/features/navigation/ShellNavigation.tsx', 'utf8');
  const shell = readFileSync('src/features/navigation/AppShell.tsx', 'utf8');

  assert.match(navigation, /<Pressable[\s\S]*onPress=\{onPress\}/);
  assert.match(navigation, /onNavigate\?\.\(item\.id\)/);
  assert.match(shell, /navigation\?\.onNavigate\(section\);\s*setNavOpen\(false\);/);
});
