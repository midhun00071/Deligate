import { supabase } from '@/lib/supabase/client';

import { getApiBaseUrl } from './config';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function getAuthenticatedJson(path: string): Promise<unknown> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new ApiRequestError(401, 'An authenticated session is required');
  }

  return getJsonWithAccessToken(path, session.access_token);
}

export async function getJsonWithAccessToken(path: string, accessToken: string): Promise<unknown> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status, 'Authenticated API request failed');
  }

  return response.json();
}
