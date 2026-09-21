export type ApiErrorCode =
  | 'unauthenticated'
  | 'unauthorized'
  | 'server'
  | 'network'
  | 'timeout'
  | 'malformed_response'
  | 'request_failed';

export class ApiRequestError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function normalizeApiError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) {
    return error;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiRequestError('timeout', null, 'The request timed out. Please try again.');
  }

  if (error instanceof TypeError) {
    return new ApiRequestError(
      'network',
      null,
      'Network unavailable. Check your connection and try again.',
    );
  }

  return new ApiRequestError('request_failed', null, 'The request could not be completed.');
}

export function errorForStatus(status: number): ApiRequestError {
  if (status === 401) {
    return new ApiRequestError(
      'unauthenticated',
      status,
      'Your session has ended. Please sign in again.',
    );
  }

  if (status === 403) {
    return new ApiRequestError(
      'unauthorized',
      status,
      'You do not have permission to perform this action.',
    );
  }

  if (status >= 500) {
    return new ApiRequestError(
      'server',
      status,
      'The service is unavailable. Please try again later.',
    );
  }

  return new ApiRequestError('request_failed', status, 'The request could not be completed.');
}
