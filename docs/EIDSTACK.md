# EIDSTACK.md — Deligate eidStack Integration Notes

## 1. Official Sources

Primary documentation:

- https://test.e-idstack.com/docs/
- https://test.e-idstack.com/docs/api-reference/
- https://test.e-idstack.com/docs/guides/architecture/
- https://test.e-idstack.com/docs/modules/agents/
- https://test.e-idstack.com/docs/modules/issuance/
- https://test.e-idstack.com/docs/modules/verification/
- https://test.e-idstack.com/docs/modules/trust-registry/

For an eidStack-specific fact, these docs override generic SSI assumptions.

## 2. Base URL and Headers

Integration base:

`https://test.e-idstack.com/api/v1`

Every request requires:

`x-api-key: <API_KEY>`

Tenant-scoped requests additionally require:

`x-tenant-id: <tenantId>`

The Expo app must never hold either secret API key or server service-role material.

## 3. Relevant Architecture

Official docs describe eidStack as a NestJS microservices platform using an API Gateway, NATS, an Agent Service based on Credo-ts/Aries and PostgreSQL-backed wallets/storage.

Deligate does not reproduce those internals. It integrates only through the HTTP API Gateway.

## 4. Documented Operations Used by Deligate

### Agents / tenants

- `POST /agents/tenants/create`
- `GET /agents/details`
- `GET /agents/tenants`

Important current limitation from docs: `GET /agents/{agentId}/status` is documented as returning 500 in the current build. Do not use it as a required green-health source unless the docs/build change and it is revalidated.

### Schemas / credential definitions

- `POST /issuance/schema`
- `POST /issuance/credential-definition`

The credential-definition body includes `supportRevocation`. For `VerifiedRiderCredential`, Deligate intends to set this to `true` on the live definition unless the sandbox on 22 Sep proves a different documented path is required.

### Connectionless credential offer

- `POST /issuance/oob-offer`

Docs state this creates a connectionless credential offer and returns an invitation URL. `useConnection` can request a persistent handshake, but Deligate should prefer connectionless OOB for the gate use case unless live testing gives a reason not to.

### Revocation

- `PATCH /issuance/credentials/{credentialExchangeId}/revoke`
- `GET /issuance/credentials/{credentialExchangeId}/revocation-status`

The docs describe revocation as permanent. UI must require confirmation and may only update application state after API success.

### Connectionless proof request

- `POST /verification/createproofRequest`

Documented request fields include:

- `credDefId`
- `attributes[]`
- optional `predicates[]`
- optional `comment`
- optional `verifierId`

This is the primary Deligate rider-verification pattern.

### Proof verification / status

- `POST /verification/verify-proof`
- `GET /verification/proofStatus`
- `GET /verification/proofs/{proofId}` where useful

Do not assume exact live state names beyond documented/observed responses. Translate external states in the live adapter.

### Trust Registry

- `GET /trust-registry/check`
- `POST /trust-registry/entries`
- `PUT /trust-registry/entries/{id}`

Documented entry roles:

- `ISSUER`
- `VERIFIER`
- `BOTH`

Documented update statuses:

- `ACTIVE`
- `REVOKED`
- `SUSPENDED`

Credential revocation is not the same as a Trust Registry entity being revoked/suspended.

## 5. Chained / Linked Credential Fields

Official issuance docs currently describe:

- `linkGroupId`
- `linkedToCredentialExchangeId`
- `linkType`
- `sourceVerificationId`

`sourceVerificationId` is documented as the proof record ID of the presentation that gated the subsequent issuance.

Deligate uses this for:

`VerifiedRiderCredential -> successful rider proof -> TemporaryBuildingAccessCredential`

Do not claim a linked/provenance behavior until the exact live response has been observed on 22 Sep.

## 6. Mock vs Live Contract

Application code sees a domain port, not HTTP responses.

Example result shapes:

```ts
type VerificationDecision = {
  proofRecordId: string;
  status: 'pending' | 'verified' | 'denied' | 'failed';
  cryptographicValid?: boolean;
  issuerTrusted?: boolean;
  revoked?: boolean;
  disclosedAttributes?: Record<string, string>;
  source: 'mock' | 'live';
};
```

If live data does not establish a field, leave it `undefined`/unknown. Do not fill unknown values with optimistic defaults.

## 7. Live Setup Sequence on 22 Sep

1. Validate API key/base URL.
2. Confirm agent details and tenant inventory.
3. Create/select delivery-company tenant and DID.
4. Create/select building tenant and DID.
5. Create/select `VerifiedRiderCredential` schema.
6. Create rider credential definition with revocation support.
7. Create/select `TemporaryBuildingAccessCredential` schema/definition.
8. Add/check Trust Registry entries.
9. Issue one real rider credential.
10. Create and complete one real proof request.
11. Issue one linked temporary access credential.
12. Revoke rider credential and repeat verification/access test.

Keep only non-secret identifiers in application setup records/logs.
