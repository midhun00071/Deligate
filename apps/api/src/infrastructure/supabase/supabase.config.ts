import { ConfigService } from '@nestjs/config';

export function getSupabaseServerConfig(config: ConfigService) {
  const url = config.get<string>('SUPABASE_URL');
  const secretKey = config.get<string>('SUPABASE_SECRET_KEY');

  if (!url) {
    throw new Error('SUPABASE_URL is required');
  }

  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is required');
  }

  return {
    url,
    secretKey,
  };
}
