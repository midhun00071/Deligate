import type { AppRole } from '@deligate/types';

export type WorkspaceSection = 'overview' | 'workspace' | 'activity';

export interface WorkspaceNavigationItem {
  id: WorkspaceSection;
  label: string;
}

export function workspaceNavigationItems(role: AppRole): WorkspaceNavigationItem[] {
  return [
    { id: 'overview', label: 'Overview' },
    {
      id: 'workspace',
      label:
        role === 'DELIVERY_ADMIN'
          ? 'Rider records'
          : role === 'BUILDING_SECURITY'
            ? 'Verification desk'
            : 'Account status',
    },
    { id: 'activity', label: 'Activity' },
  ];
}
