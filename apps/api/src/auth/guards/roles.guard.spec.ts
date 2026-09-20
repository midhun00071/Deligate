import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from '../domain/authenticated-request';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  it('allows a delivery admin with the required role', () => {
    const guard = createGuard(['DELIVERY_ADMIN']);
    const request = createRequest('DELIVERY_ADMIN');

    expect(guard.canActivate(createExecutionContext(request))).toBe(true);
  });

  it('allows building security with the required role', () => {
    const guard = createGuard(['BUILDING_SECURITY']);
    const request = createRequest('BUILDING_SECURITY');

    expect(guard.canActivate(createExecutionContext(request))).toBe(true);
  });

  it('rejects an authenticated actor with a different role', () => {
    const guard = createGuard(['DELIVERY_ADMIN']);
    const request = createRequest('BUILDING_SECURITY');

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(ForbiddenException);
  });

  it('rejects a role-protected request without an authenticated actor', () => {
    const guard = createGuard(['DELIVERY_ADMIN']);

    expect(() => guard.canActivate(createExecutionContext(createRequest(null)))).toThrow(
      UnauthorizedException,
    );
  });

  it('does not create an authentication requirement when no role metadata exists', () => {
    const guard = createGuard(undefined);

    expect(guard.canActivate(createExecutionContext(createRequest(null)))).toBe(true);
  });
});

function createGuard(requiredRoles: string[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;

  return new RolesGuard(reflector);
}

function createRequest(role: 'DELIVERY_ADMIN' | 'BUILDING_SECURITY' | null): AuthenticatedRequest {
  return {
    headers: {},
    ...(role
      ? {
          actor: {
            userId: 'user-1',
            profileId: 'user-1',
            role,
            organizationId: 'organization-1',
            displayName: 'Test User',
          },
        }
      : {}),
  } as unknown as AuthenticatedRequest;
}

function createExecutionContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: <T>(): T => request as T,
    }),
  } as unknown as ExecutionContext;
}
