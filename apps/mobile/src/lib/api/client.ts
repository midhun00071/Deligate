import { supabase } from '@/lib/supabase/client';

import { getApiBaseUrl } from './config';
import { ApiRequestError, errorForStatus, normalizeApiError } from './errors';

export { ApiRequestError } from './errors';

const DEFAULT_TIMEOUT_MS = 10_000;

export async function getAuthenticatedJson(path: string): Promise<unknown> {
  return authenticatedJson(path);
}

export async function authenticatedJson(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown,
): Promise<unknown> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new ApiRequestError('unauthenticated', 401, 'An authenticated session is required');
  }

  return getJsonWithAccessToken(path, session.access_token, DEFAULT_TIMEOUT_MS, method, body);
}

export async function getJsonWithAccessToken(
  path: string,
  accessToken: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        /* Fall back to status. */
      }
      if (
        errorBody &&
        typeof errorBody === 'object' &&
        'code' in errorBody &&
        typeof errorBody.code === 'string'
      ) {
        const message = issuerErrorMessage(errorBody.code);
        if (message) throw new ApiRequestError('request_failed', response.status, message);
      }
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

function issuerErrorMessage(code: string): string | undefined {
  const messages: Record<string, string> = {
    CONFIGURATION_UNAVAILABLE:
      'Issuer configuration is unavailable. Contact the technical operator.',
    RESOURCES_UNAVAILABLE: 'The rider schema or credential definition is unavailable.',
    CONTRACT_UNVERIFIED:
      'Live issuance is blocked until the sandbox response contract is verified.',
    UPSTREAM_UNAVAILABLE:
      'The issuer service is unavailable. Refresh the saved state before retrying.',
    UPSTREAM_REJECTED: 'The issuer rejected this action. Contact the technical operator.',
    UPSTREAM_TIMEOUT:
      'Issuer response timed out. Refresh the saved state; do not create another offer.',
    INVALID_RESPONSE: 'The issuer returned an unsupported response.',
    INVITATION_UNAVAILABLE: 'A safe wallet invitation is unavailable.',
    REVOCATION_UNAVAILABLE: 'Revocation support has not been confirmed.',
    INVALID_INPUT: 'Check the permitted fields and input limits.',
  };
  return messages[code];
}
