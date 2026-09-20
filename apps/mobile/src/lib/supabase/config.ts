export function getSupabaseClientConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is required');
  }

  if (!publishableKey) {
    throw new Error('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required');
  }

  return {
    url,
    publishableKey,
  };
}
