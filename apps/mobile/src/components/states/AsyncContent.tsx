import type { ReactNode } from 'react';

import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

export type AsyncPhase = 'initial' | 'loading' | 'success' | 'empty' | 'error';

interface Props {
  phase: AsyncPhase;
  children: ReactNode;
  empty?: { title: string; description: string };
  error?: { description: string; onRetry?: () => void };
}

export function AsyncContent({ phase, children, empty, error }: Props) {
  if (phase === 'initial' || phase === 'loading') {
    return <LoadingState label={phase === 'initial' ? 'Preparing workspace' : 'Loading'} />;
  }

  if (phase === 'empty') {
    return (
      <EmptyState
        title={empty?.title ?? 'Nothing here yet'}
        description={empty?.description ?? 'No records are available.'}
      />
    );
  }

  if (phase === 'error') {
    return (
      <ErrorState
        description={error?.description ?? 'Please check your connection and try again.'}
        onRetry={error?.onRetry}
      />
    );
  }

  return <>{children}</>;
}
