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
  const credentials: CredentialRecord[] = [];
  const latestCredential = () => credentials.at(-1) ?? null;
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
          credentialState:
            latestCredential()?.riderId === value.id ? latestCredential()?.state : null,
          credentialSource:
            latestCredential()?.riderId === value.id ? latestCredential()?.source : null,
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
      org === rider.organizationId && id === rider.id ? latestCredential() : null,
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
        const current = latestCredential();
        if (current && !['REVOKED', 'FAILED'].includes(current.state))
          throw new ConflictException();
        const credential: CredentialRecord = {
          id: `40000000-0000-4000-8000-${String(credentials.length + 1).padStart(12, '0')}`,
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
        credentials.push(credential);
        return credential;
      },
    ),
    update: jest.fn(
      async (_org: string, record: CredentialRecord, _actor: string, patch: CredentialPatch) => {
        const index = credentials.findIndex((value) => value.id === record.id);
        const credential = credentials[index];
        if (
          !credential ||
          credential.state !== record.state ||
          credential.revocationPending !== record.revocationPending
        )
          throw new ConflictException();
        const { exchangeId, ...fields } = patch;
        credentials[index] = {
          ...credential,
          ...fields,
          ...(exchangeId ? { credentialExchangeId: exchangeId } : {}),
        };
        return credentials[index];
      },
    ),
  };
  return {
    riderRepo,
    credentialRepo,
    getCredential: latestCredential,
    getCredentials: () => [...credentials],
  };
}
