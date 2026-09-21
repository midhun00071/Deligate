import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resetVerificationDesk } from './verification-desk';

test('returning to the verification desk clears only client session state and route state', () => {
  const calls: string[] = [];
  resetVerificationDesk({
    clearSession: () => calls.push('session'),
    clearAccess: () => calls.push('access'),
    clearError: () => calls.push('error'),
    clearProofQr: () => calls.push('proof-qr'),
    clearRoute: () => calls.push('route'),
  });
  assert.deepEqual(calls, ['session', 'access', 'error', 'proof-qr', 'route']);
});

test('Security workspace navigation and Verify another rider use the shared client-only desk reset', () => {
  const screen = readFileSync(
    'src/features/verification/screens/SecurityVerifierScreen.tsx',
    'utf8',
  );
  assert.match(screen, /resetVerificationDesk\(/);
  assert.match(
    screen,
    /if \(section === 'workspace'\) \{\s*startFreshVerificationDesk\(\);\s*return;\s*\}\s*scrollTo\(section\);/,
  );
  assert.match(screen, /navigation=\{\{ activeSection, onNavigate: navigate \}\}/);
  assert.match(screen, /label=\{access \? 'Verify another rider' : 'New verification'\}/);
  assert.match(screen, /onPress=\{startFreshVerificationDesk\}/);
});
