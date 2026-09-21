import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MockEidStackAdapter, readEidStackConfig } from '@deligate/eidstack';
import { AuthService } from '../../auth/auth.service';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { RiderController } from './rider.controller';
import { RiderRepository } from './rider.repository';
import { RiderService } from './rider.service';
import { CredentialService } from '../credentials/credential.service';
import { CredentialRepository } from '../credentials/credential.repository';
import { InvitationCache } from '../credentials/invitation-cache';
import { IssuerOverviewRepository } from '../credentials/issuer-overview.repository';
import { EIDSTACK_CONFIG, EIDSTACK_PORT } from '../eidstack/eidstack.module';
import { actor, issuerRepositories, rider } from '../../../test/issuer.fixture';

describe('Delivery Admin direct HTTP requests', () => {
  let app: INestApplication;
  let currentActor = { ...actor };
  const path = `/riders/${rider.id}`;
  beforeEach(async () => {
    currentActor = { ...actor };
    const repos = issuerRepositories();
    const module = await Test.createTestingModule({
      controllers: [RiderController],
      providers: [
        RiderService,
        CredentialService,
        InvitationCache,
        SupabaseAuthGuard,
        RolesGuard,
        { provide: AuthService, useValue: { authenticate: async () => currentActor } },
        { provide: RiderRepository, useValue: repos.riderRepo },
        { provide: CredentialRepository, useValue: repos.credentialRepo },
        {
          provide: IssuerOverviewRepository,
          useValue: {
            read: async () => ({
              activeRiders: 1,
              issued: 0,
              revoked: 0,
              mode: 'mock',
              recent: [],
            }),
          },
        },
        {
          provide: EIDSTACK_PORT,
          useValue: new MockEidStackAdapter({ now: () => Date.now() + 11000 }),
        },
        { provide: EIDSTACK_CONFIG, useValue: readEidStackConfig({ EIDSTACK_MODE: 'mock' }) },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/riders').expect(401);
  });

  it.each(['RIDER', 'BUILDING_SECURITY'] as const)(
    'blocks %s from all issuer routes',
    async (role) => {
      currentActor.role = role;
      const server = app.getHttpServer();
      for (const route of ['/riders', path, '/riders/overview', '/riders/technical-status']) {
        await request(server).get(route).set('Authorization', 'Bearer test').expect(403);
      }
      for (const route of ['/riders', `${path}/issuance`, `${path}/refresh`, `${path}/revoke`]) {
        await request(server)
          .post(route)
          .set('Authorization', 'Bearer test')
          .send({ confirmed: true })
          .expect(403);
      }
      await request(server)
        .patch(path)
        .set('Authorization', 'Bearer test')
        .send({ employeeReference: 'X' })
        .expect(403);
    },
  );

  it('rejects direct requests for a rider in another organization', async () => {
    currentActor.organizationId = '20000000-0000-4000-8000-000000000002';
    const server = app.getHttpServer();
    await request(server).get(path).set('Authorization', 'Bearer test').expect(404);
    await request(server)
      .patch(path)
      .set('Authorization', 'Bearer test')
      .send({ employeeReference: 'X' })
      .expect(404);
    for (const action of ['issuance', 'refresh', 'revoke']) {
      await request(server)
        .post(`${path}/${action}`)
        .set('Authorization', 'Bearer test')
        .send({ confirmed: true })
        .expect(404);
    }
  });

  it('rejects mass assignment, invalid enums, UUIDs and unbounded queries', async () => {
    for (const body of [
      { employeeReference: 'X', role: 'DELIVERY_ADMIN' },
      { employeeReference: 'X', employmentStatus: 'ISSUED' },
      { employeeReference: 'X', emiratesId: 'forbidden' },
    ]) {
      await request(app.getHttpServer())
        .post('/riders')
        .set('Authorization', 'Bearer test')
        .send(body)
        .expect(400);
    }
    for (const query of ['limit=500', 'page=0', 'search=%25', 'organizationId=other']) {
      await request(app.getHttpServer())
        .get(`/riders?${query}`)
        .set('Authorization', 'Bearer test')
        .expect(400);
    }
    await request(app.getHttpServer())
      .get('/riders/not-a-uuid')
      .set('Authorization', 'Bearer test')
      .expect(400);
  });

  it('supports create/list/detail/edit and simulated issuance/revocation through HTTP', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/riders')
      .set('Authorization', 'Bearer test')
      .send({ employeeReference: 'R-002' })
      .expect(201);
    await request(server)
      .get('/riders')
      .set('Authorization', 'Bearer test')
      .expect(200)
      .expect((response) => {
        expect(response.body.riders).toHaveLength(2);
      });
    await request(server)
      .patch(path)
      .set('Authorization', 'Bearer test')
      .send({ employeeReference: 'R-001A' })
      .expect(200);
    await request(server)
      .post(`${path}/issuance`)
      .set('Authorization', 'Bearer test')
      .expect(201)
      .expect((response) => {
        expect(response.body.credential.state).toBe('AWAITING_WALLET');
        expect(response.body.invitation).toContain('wallet-simulation.invalid');
      });
    await request(server)
      .post(`${path}/refresh`)
      .set('Authorization', 'Bearer test')
      .expect(201)
      .expect((response) => {
        expect(response.body.credential.state).toBe('ISSUED');
      });
    await request(server)
      .post(`${path}/revoke`)
      .set('Authorization', 'Bearer test')
      .send({ confirmed: false })
      .expect(400);
    await request(server)
      .post(`${path}/revoke`)
      .set('Authorization', 'Bearer test')
      .send({ confirmed: true })
      .expect(201)
      .expect((response) => {
        expect(response.body.credential.state).toBe('REVOKED');
      });
    await request(server)
      .get(path)
      .set('Authorization', 'Bearer test')
      .expect('Cache-Control', 'no-store')
      .expect(200);
  });

  it('returns safe technical status only', async () => {
    await request(app.getHttpServer())
      .get('/riders/technical-status')
      .set('Authorization', 'Bearer test')
      .expect(200)
      .expect((response) => {
        expect(response.body.mode).toBe('mock');
        expect(response.body).not.toHaveProperty('apiKey');
        expect(response.body).not.toHaveProperty('tenantId');
      });
  });
});
