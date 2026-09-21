import assert from 'node:assert/strict';
import test from 'node:test';
import { workspaceNavigationItems } from './workspace-navigation';

test('Delivery workspace navigation exposes overview, rider records, and activity', () => {
  assert.deepEqual(workspaceNavigationItems('DELIVERY_ADMIN'), [
    { id: 'overview', label: 'Overview' },
    { id: 'workspace', label: 'Rider records' },
    { id: 'activity', label: 'Activity' },
  ]);
});

test('Security workspace navigation exposes overview, verification desk, and activity', () => {
  assert.deepEqual(workspaceNavigationItems('BUILDING_SECURITY'), [
    { id: 'overview', label: 'Overview' },
    { id: 'workspace', label: 'Verification desk' },
    { id: 'activity', label: 'Activity' },
  ]);
});
