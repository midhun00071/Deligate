import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from '@/lib/supabase/client';

import { getCurrentActor } from '../services/auth-context.api';
import { signInWithPassword, signOut as endSession } from '../services/auth.service';
import type { AuthContextValue, AuthState, SignInCredentials } from '../types';

const initialState: AuthState = {
  status: 'loading',
  session: null,
  actor: null,
  error: null,
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);
  const resolutionGeneration = useRef(0);

  const resolveSession = useCallback(async (session: Session | null): Promise<void> => {
    const generation = ++resolutionGeneration.current;

    if (!session) {
      setState({ status: 'unauthenticated', session: null, actor: null, error: null });
      return;
    }

    setState({ status: 'loading', session, actor: null, error: null });

    try {
      const actor = await getCurrentActor(session.access_token);

      if (resolutionGeneration.current !== generation) {
        return;
      }

      setState({ status: 'authenticated', session, actor, error: null });
    } catch (error: unknown) {
      if (resolutionGeneration.current !== generation) {
        return;
      }

      setState({
        status: 'unavailable',
        session,
        actor: null,
        error: toError(error),
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initialGeneration = ++resolutionGeneration.current;

    const resolveInitialSession = async (): Promise<void> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (active && resolutionGeneration.current === initialGeneration) {
        await resolveSession(session);
      }
    };

    void resolveInitialSession();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        void resolveSession(session);
      }
    });

    return () => {
      active = false;
      resolutionGeneration.current += 1;
      data.subscription.unsubscribe();
    };
  }, [resolveSession]);

  const signIn = useCallback(async (credentials: SignInCredentials): Promise<void> => {
    await signInWithPassword(credentials);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await endSession();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      signOut,
      refresh: async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await resolveSession(session);
      },
    }),
    [resolveSession, signIn, signOut, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Authentication context could not be resolved');
}
