import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { authStorage } from './auth-storage';
import { getSupabaseClientConfig } from './config';

const { url, publishableKey } = getSupabaseClientConfig();

export const supabase = createClient(url, publishableKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
