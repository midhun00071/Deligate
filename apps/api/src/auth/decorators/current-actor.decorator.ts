import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import type { AuthenticatedActor } from '@deligate/types';

import type { AuthenticatedRequest } from '../domain/authenticated-request';

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.actor) {
      throw new UnauthorizedException('Authenticated actor is unavailable');
    }

    return request.actor;
  },
);
