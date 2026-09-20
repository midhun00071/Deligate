import { supabase } from '@/lib/supabase/client';

import type { SignInCredentials } from '../types';

export async function signInWithPassword(credentials: SignInCredentials): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
