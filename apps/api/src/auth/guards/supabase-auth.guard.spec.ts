import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import type { AuthenticatedActor } from '@deligate/types';

import { AuthService } from '../auth.service';
import type { AuthenticatedRequest } from '../domain/authenticated-request';
import { extractBearerToken, SupabaseAuthGuard } from './supabase-auth.guard';

describe('SupabaseAuthGuard', () => {
  const actor: AuthenticatedActor = {
    userId: 'user-1',
    profileId: 'user-1',
    role: 'BUILDING_SECURITY',
    organizationId: 'organization-1',
    displayName: 'Security Officer',
  };

  it('attaches the resolved actor to an authenticated request', async () => {
    const authenticate = jest.fn().mockResolvedValue(actor);
    const authService = {
      authenticate,
    } as unknown as AuthService;
    const guard = new SupabaseAuthGuard(authService);
    const request = { headers: { authorization: 'Bearer valid-token' } } as AuthenticatedRequest;

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect(request.actor).toEqual(actor);
    expect(authenticate).toHaveBeenCalledWith('valid-token');
  });

  it.each([undefined, 'Basic valid-token', 'Bearer', 'Bearer token extra'])(
    'rejects malformed or missing authorization header %p',
    (header) => {
      expect(() => extractBearerToken(header)).toThrow(UnauthorizedException);
    },
  );
});

function createExecutionContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: <T>(): T => request as T,
    }),
  } as ExecutionContext;
}
