import type { Session } from '@supabase/supabase-js';

import type { AuthenticatedActor } from '@deligate/types';

export interface SignInCredentials {
  email: string;
  password: string;
}

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'unavailable';

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  actor: AuthenticatedActor | null;
  error: Error | null;
}

export interface AuthContextValue extends AuthState {
  signIn(credentials: SignInCredentials): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
}
