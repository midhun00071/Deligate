import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { AuthService } from '../auth.service';
import type { AuthenticatedRequest } from '../domain/authenticated-request';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = extractBearerToken(request.headers.authorization);

    request.actor = await this.authService.authenticate(accessToken);
    return true;
  }
}

export function extractBearerToken(header: string | undefined): string {
  if (!header) {
    throw new UnauthorizedException('Authorization header is required');
  }

  const match = /^Bearer ([^\s]+)$/i.exec(header);

  if (!match?.[1]) {
    throw new UnauthorizedException('Authorization header must use Bearer authentication');
  }

  return match[1];
}
