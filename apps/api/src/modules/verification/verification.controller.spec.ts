import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AuthenticatedActor } from '@deligate/types';
import { AuthService } from '../../auth/auth.service';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { SecurityOverviewRepository } from './security-overview.repository';

const actor = {
  userId: 'user-1',
  profileId: 'user-1',
  role: 'BUILDING_SECURITY' as const,
  organizationId: '10000000-0000-4000-8000-000000000001',
  displayName: 'Security',
};

describe('Security building selection endpoint', () => {
  let app: INestApplication;
  let current: AuthenticatedActor = { ...actor };
  const buildings = [{ id: '20000000-0000-4000-8000-000000000001', name: 'Tower A', zones: [] }];
  beforeEach(async () => {
    current = { ...actor };
    const module = await Test.createTestingModule({
      controllers: [VerificationController],
      providers: [
        SupabaseAuthGuard,
        RolesGuard,
        { provide: AuthService, useValue: { authenticate: async () => current } },
        {
          provide: VerificationService,
          useValue: { buildings: jest.fn().mockResolvedValue(buildings) },
        },
        {
          provide: SecurityOverviewRepository,
          useValue: { read: jest.fn() },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    if (app) await app.close();
  });

  it('returns only the authenticated security organization building choices', async () => {
    await request(app.getHttpServer())
      .get('/security/verifications/buildings')
      .set('Authorization', 'Bearer test')
      .expect(200)
      .expect(buildings);
  });
  it('rejects unauthenticated and Delivery Admin requests', async () => {
    await request(app.getHttpServer()).get('/security/verifications/buildings').expect(401);
    current.role = 'DELIVERY_ADMIN';
    await request(app.getHttpServer())
      .get('/security/verifications/buildings')
      .set('Authorization', 'Bearer test')
      .expect(403);
  });
});
