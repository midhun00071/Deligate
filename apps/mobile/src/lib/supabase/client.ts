import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import 'expo-sqlite/localStorage/install';

import { getSupabaseClientConfig } from './config';

const { url, publishableKey } = getSupabaseClientConfig();

export const supabase = createClient(url, publishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
