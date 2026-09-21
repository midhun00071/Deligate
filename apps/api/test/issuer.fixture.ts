import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedActor } from '@deligate/types';
import type { CredentialRecord, Rider, RiderInput, RiderQuery } from '@deligate/validation';
import type { EidStackMode, IssuerReferences } from '@deligate/eidstack';
import type { CredentialPatch } from '../src/modules/credentials/credential.repository';

export const actor: AuthenticatedActor = {
  userId: '10000000-0000-4000-8000-000000000001',
  profileId: '10000000-0000-4000-8000-000000000001',
  organizationId: '20000000-0000-4000-8000-000000000001',
  role: 'DELIVERY_ADMIN',
  displayName: 'Test admin',
};
export const rider: Rider = {
  id: '30000000-0000-4000-8000-000000000001',
  organizationId: actor.organizationId!,
  employeeReference: 'R-001',
  employmentStatus: 'ACTIVE',
  createdAt: '2026-09-21T00:00:00.000Z',
};

/** Test persistence only. Production always uses Supabase repositories. */
export function issuerRepositories() {
  const riders = new Map<string, Rider>([[rider.id, { ...rider }]]);
  let credential: CredentialRecord | null = null;
  const riderRepo = {
    assertDeliveryCompany: jest.fn(async (_org: string) => {}),
    find: jest.fn(async (org: string, id: string) => {
      const value = riders.get(id);
      if (!value || value.organizationId !== org) throw new NotFoundException();
      return value;
    }),
    list: jest.fn(async (org: string, query: RiderQuery) => ({
      riders: [...riders.values()]
        .filter((value) => value.organizationId === org)
        .map((value) => ({
          ...value,
          credentialState: credential?.riderId === value.id ? credential.state : null,
          credentialSource: credential?.riderId === value.id ? credential.source : null,
        })),
      total: riders.size,
      page: query.page,
      limit: query.limit,
    })),
    create: jest.fn(async (org: string, input: RiderInput) => {
      const created = {
        ...rider,
        ...input,
        organizationId: org,
        id: '30000000-0000-4000-8000-000000000002',
      };
      riders.set(created.id, created);
      return created;
    }),
    update: jest.fn(async (org: string, id: string, input: RiderInput) => {
      const value = riders.get(id);
      if (!value || value.organizationId !== org) throw new NotFoundException();
      const updated = { ...value, ...input };
      riders.set(id, updated);
      return updated;
    }),
  };
  const credentialRepo = {
    find: jest.fn(async (org: string, id: string) =>
      org === rider.organizationId && id === rider.id ? credential : null,
    ),
    reserve: jest.fn(
      async (
        _org: string,
        riderId: string,
        _actor: string,
        source: EidStackMode,
        refs: IssuerReferences,
        validUntil: string,
      ) => {
        if (credential) throw new ConflictException();
        credential = {
          id: '40000000-0000-4000-8000-000000000001',
          riderId,
          source,
          ...refs,
          state: 'REQUESTING',
          requestedAt: new Date().toISOString(),
          validUntil,
          credentialExchangeId: null,
          issuedAt: null,
          revokedAt: null,
          errorCode: null,
          revocationPending: false,
        };
        return credential;
      },
    ),
    update: jest.fn(
      async (_org: string, record: CredentialRecord, _actor: string, patch: CredentialPatch) => {
        if (
          !credential ||
          credential.state !== record.state ||
          credential.revocationPending !== record.revocationPending
        )
          throw new ConflictException();
        const { exchangeId, ...fields } = patch;
        credential = {
          ...credential,
          ...fields,
          ...(exchangeId ? { credentialExchangeId: exchangeId } : {}),
        };
        return credential;
      },
    ),
  };
  return { riderRepo, credentialRepo, getCredential: () => credential };
}
