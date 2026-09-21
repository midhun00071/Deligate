import type { AppRole } from '@deligate/types';
import { Redirect, type Href } from 'expo-router';
import type { ReactNode } from 'react';

import { ErrorState, LoadingState } from '@/components/states';
import { Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';

import { roleHomePath } from './paths';
import { canAccessRole } from './roleAccess';

interface RoleGateProps {
  role: AppRole;
  children: ReactNode;
}

export function RoleGate({ role, children }: RoleGateProps) {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return (
      <Screen>
        <LoadingState label="Restoring your workspace" />
      </Screen>
    );
  }

  if (auth.status === 'unavailable') {
    return (
      <Screen>
        <ErrorState
          title="Workspace unavailable"
          description={auth.error?.message ?? 'Your account context could not be confirmed.'}
          onRetry={() => void auth.refresh()}
        />
      </Screen>
    );
  }

  if (!auth.actor || auth.status === 'unauthenticated') {
    return <Redirect href={'/sign-in' as Href} />;
  }

  if (!canAccessRole(auth.actor.role, role)) {
    return <Redirect href={roleHomePath[auth.actor.role] as Href} />;
  }

  return <>{children}</>;
}
