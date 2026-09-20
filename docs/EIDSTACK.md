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

Supplementary hackathon source:
- uploaded eIDStack walkthrough showing issuer -> external wallet -> verifier flows

For an eidStack-specific fact, official docs override generic SSI assumptions.

## 2. Base URL and Headers
Integration base:

`https://test.e-idstack.com/api/v1`

Every request requires:

`x-api-key: <API_KEY>`

Tenant-scoped requests additionally require:

`x-tenant-id: <tenantId>`

The Expo app must never hold either the eidStack API key or Supabase server secret/service-role material.

## 3. Relevant Architecture
Official docs describe eidStack as a NestJS microservices platform using an API Gateway, NATS, an Agent Service based on Credo-ts/Aries and PostgreSQL-backed wallets/storage.

Deligate does not reproduce those internals. It integrates through the HTTP API Gateway.

The holder side is also not implemented by Deligate. The walkthrough shows a separate wallet application that stores credentials, scans issuer/verifier QR codes, lets the holder review and consent, and performs holder-side wallet operations.

## 4. Holder Wallet Boundary
For the core hackathon flow, Deligate treats the organizer-provided/eidStack-compatible wallet as an external dependency.

Deligate does not implement:
- holder DID/private-key generation
- credential storage
- wallet PIN/biometric/backup
- credential acceptance screens
- proof-selection/consent screens
- a DIDComm agent
- AnonCreds wallet cryptography

Deligate does implement:
- server-side issuance/proof orchestration
- display of eidStack-returned QR invitations/links
- workflow status reconciliation
- verification/trust/revocation/access decisions
- privacy-safe application records

## 5. QR vs DIDComm vs OpenID Protocols
Do not say "DIDComm generates the QR."

The practical Deligate model is:

```text
eidStack creates an invitation / credential offer / proof request
                    ↓
Deligate renders the returned invitation/request as QR/link
                    ↓
external holder wallet scans it
                    ↓
applicable protocol/agent exchange continues
```

DIDComm is a secure agent/wallet messaging protocol used by applicable flows. The walkthrough also exposes an agent DIDComm HTTP endpoint and a Generate Invitation action, but the QR itself is a representation of an invitation/request, not "DIDComm barcode generation."

OpenID4VCI and OpenID4VP are separate protocol families. Do not conflate them with DIDComm.

## 6. Documented Operations Used by Deligate

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

Deligate renders the returned invitation for the external holder wallet. Deligate does not scan or accept its own offer.

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

This is the primary Deligate rider-verification pattern. Building Security displays the returned request QR/link and the external wallet performs holder review/consent.

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

## 7. Chained / Linked Credential Fields
Official issuance docs currently describe:
- `linkGroupId`
- `linkedToCredentialExchangeId`
- `linkType`
- `sourceVerificationId`

`sourceVerificationId` is documented as the proof record ID of the presentation that gated the subsequent issuance.

Deligate uses this for:

`VerifiedRiderCredential -> successful rider proof -> TemporaryBuildingAccessCredential`

Do not claim a linked/provenance behavior until the exact live response has been observed on 22 Sep.

## 8. Mock vs Live Contract

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

Mock mode may simulate the *completion* of external-wallet steps for development, but must not create a fake in-app holder wallet UX and must remain clearly labeled as simulation.

## 9. Live Setup Sequence on 22 Sep
1. Validate API key/base URL.
2. Confirm agent details and tenant inventory.
3. Confirm the organizer-compatible holder wallet and required network are available.
4. Create/select delivery-company tenant and DID.
5. Create/select building tenant and DID.
6. Create/select `VerifiedRiderCredential` schema.
7. Create rider credential definition with revocation support.
8. Create/select `TemporaryBuildingAccessCredential` schema/definition.
9. Add/check Trust Registry entries.
10. Issue one real rider credential and accept it in the organizer wallet.
11. Create and complete one real proof request in the organizer wallet.
12. Issue one linked temporary access credential and accept it in the organizer wallet.
13. Revoke rider credential and repeat verification/access test.

Keep only non-secret identifiers in application setup records/logs.
