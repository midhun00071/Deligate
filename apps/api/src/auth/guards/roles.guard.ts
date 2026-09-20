import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AppRole } from '@deligate/types';

import type { AuthenticatedRequest } from '../domain/authenticated-request';
import { ROLES_METADATA_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.actor) {
      throw new UnauthorizedException('Authentication is required for this action');
    }

    if (!roles.includes(request.actor.role)) {
      throw new ForbiddenException('Your role is not authorized for this action');
    }

    return true;
  }
}
