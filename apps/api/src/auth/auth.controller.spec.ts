import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import type { AuthenticatedActor } from '@deligate/types';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';

describe('AuthController', () => {
  let app: INestApplication;
  let authenticate: jest.MockedFunction<(accessToken: string) => Promise<AuthenticatedActor>>;

  const actor: AuthenticatedActor = {
    userId: 'user-1',
    profileId: 'user-1',
    role: 'DELIVERY_ADMIN',
    organizationId: 'organization-1',
    displayName: 'Delivery Admin',
  };

  beforeEach(async () => {
    authenticate = jest.fn();
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        SupabaseAuthGuard,
        {
          provide: AuthService,
          useValue: { authenticate },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 without an authorization header', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('returns 401 for a malformed authorization header', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Basic not-a-bearer-token')
      .expect(401);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid Supabase token', async () => {
    authenticate.mockRejectedValue(new UnauthorizedException('Invalid session'));

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('returns 401 when an authenticated Supabase user has no profile', async () => {
    authenticate.mockRejectedValue(new UnauthorizedException('No application profile'));

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(401);
  });

  it('returns only the resolved safe actor context', async () => {
    authenticate.mockResolvedValue(actor);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
      .expect({ actor });
  });
});
