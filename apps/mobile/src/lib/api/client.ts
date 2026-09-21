import { supabase } from '@/lib/supabase/client';

import { getApiBaseUrl } from './config';
import { ApiRequestError, errorForStatus, normalizeApiError } from './errors';

export { ApiRequestError } from './errors';

const DEFAULT_TIMEOUT_MS = 10_000;

export async function getAuthenticatedJson(path: string): Promise<unknown> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new ApiRequestError('unauthenticated', 401, 'An authenticated session is required');
  }

  return getJsonWithAccessToken(path, session.access_token);
}

export async function getJsonWithAccessToken(
  path: string,
  accessToken: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw errorForStatus(response.status);
    }

    try {
      return await response.json();
    } catch {
      throw new ApiRequestError(
        'malformed_response',
        response.status,
        'The service returned an unexpected response.',
      );
    }
  } catch (error) {
    throw normalizeApiError(error);
  } finally {
    clearTimeout(timeout);
  }
}
