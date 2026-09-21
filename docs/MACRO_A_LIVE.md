# Macro A issuer setup and live boundary

## Verified source evidence

Inspected 2026-09-21:
- [Official issuance documentation](https://test.e-idstack.com/docs/modules/issuance/)
- [API reference](https://test.e-idstack.com/docs/api-reference/)
- [Live Swagger](https://test.e-idstack.com/api/docs)
- [Swagger initialization document](https://test.e-idstack.com/api/docs/swagger-ui-init.js)

Swagger `OobOfferCredentialDto` defines `credentialDefinitionId`, `attributes`,
`schemaId`, `subjectAttribute`, `useConnection`, `autoAcceptCredential`, `comment`
and `category`, among optional fields not needed by this slice.
The client uses connectionless offers, category `employment`, and
`autoAcceptCredential: false` to preserve external wallet review.
Compatibility and the subsequent issuer-side completion behavior still need an APK run.

The prose success envelope is `{ success: true, statusCode, message, data: {} }`.
Swagger's OOB/status responses have descriptions but no content schema.
No authoritative field names for invitation, exchange reference, issuance state,
revocation-status data, or schema/definition creation results were available.
No live API key or dedicated delivery tenant was configured in this environment.

**Live issuance and issuance-state parsing remain blocked.** The live adapter checks
configuration and then throws `CONTRACT_UNVERIFIED` before mutating eidStack.
There is no parser with guessed field names and no mock fallback.
The successful revoke command envelope is supported; it does not establish a fresh
ledger revocation-status result. H01 is not closed by mock evidence.

## Credential contract and persistence

`VerifiedRiderCredential` version `1.0.0` uses five string attributes:

| Attribute | Purpose |
|---|---|
| riderId | Opaque Deligate rider UUID |
| deliveryCompany | Opaque issuing organization UUID |
| riderStatus | Employment claim `ACTIVE` at issuance |
| validFrom | ISO timestamp when issuance was reserved |
| validUntil | ISO timestamp 90 days later |

Validity strings are claims, not a claim of automatic cryptographic expiry.
No name, national ID, contact details, raw credential or holder secret is collected.
Employee reference is application data and is not included in the credential.

The database records mode, schema/definition IDs, exchange reference, workflow state,
timestamps, revocation capability, pending-command lock and a safe error code.
Audit insertion occurs in the same database transaction as each state change.
Existing table RLS remains default-deny for client roles; Nest applies role/org scope.

Invitations are retained in bounded server memory for at most 15 minutes, with no
database storage. This is a local retention limit, not eidStack invitation expiry.
After server restart/eviction the UI says unavailable; it never reconstructs the link
or creates another offer. Exchange status still persists. Use one API process for this
hackathon handoff. A verified invitation-retrieval contract is needed for durable recovery.

One reserved issuer workflow is allowed per rider. Repeated issuance returns the existing
record. Ambiguous timeouts and persistence failures require operator reconciliation.
Renewal/reissuance is deliberately not an automatic retry path in this slice.
Revocation failures preserve the earlier state and retain the pending lock because a
failed response can also mean the ledger command succeeded or was already revoked.

## Configuration and resource strategy

Select existing resources externally and configure their IDs. Startup and issuance
never create schemas or definitions. The low-level creation wrappers are explicit only;
no bootstrap route is exposed. Confirm a dedicated Deligate tenant externally and do
not initialize, shut down, delete or manage the shared root agent or unrelated tenants.

Server `.env` (never `EXPO_PUBLIC_*`):

```dotenv
EIDSTACK_MODE=live
EIDSTACK_BASE_URL=https://test.e-idstack.com/api/v1
EIDSTACK_API_KEY=<set locally; never paste into source>
EIDSTACK_DELIVERY_TENANT_ID=<dedicated tenant>
EIDSTACK_DELIVERY_ORGANIZATION_ID=<Deligate delivery organization UUID>
EIDSTACK_RIDER_SCHEMA_ID=<existing matching schema>
EIDSTACK_RIDER_CREDENTIAL_DEFINITION_ID=<existing matching definition>
EIDSTACK_RIDER_REVOCATION_SUPPORTED=true
EIDSTACK_TIMEOUT_MS=8000
```

Set revocation support to true only after verifying the configured definition was
created with it. The creation wrapper always sends `supportRevocation: true`.
Do not assume it can be enabled later. Existing schemas must match all five attributes.
The configured tenant is bound to one application organization; other organizations
cannot use it for credential actions. Mock mode is rejected in production/live app environments.

`GET /api/riders/technical-status` requires a Delivery Admin bearer session. It returns
mode, hostname, configuration booleans, revocation capability and parser readiness.
It returns no API key, tenant ID or raw upstream body. This is a technical endpoint,
not an operator-facing health claim.

## Implemented live request wrappers

All paths below are relative to `/api/v1`; every call sends `x-api-key` and `x-tenant-id`.

| Method | Path | Response support |
|---|---|---|
| POST | `/issuance/schema` | Safe envelope only; resource ID mapping blocked |
| POST | `/issuance/credential-definition` | Safe envelope only; ID mapping blocked |
| POST | `/issuance/oob-offer` | Request tested; application use blocked before POST |
| GET | `/issuance/offerStatus?credentialExchangeId=...` | Request tested; state mapping blocked |
| PATCH | `/issuance/credentials/{credentialExchangeId}/revoke` | Documented success envelope |
| GET | `/issuance/credentials/{credentialExchangeId}/revocation-status` | Request tested; ledger-status mapping blocked |

No live authenticated call was executed during Macro A. Unit HTTP fixtures verify
request construction and error behavior; they are not fabricated success-shape evidence.

## Safe manual verification

Use PowerShell with the server variables already set in the process; disable transcript
capture and never paste secrets into a command literal. Read-only connectivity check:

```powershell
$issuerHeaders = @{ 'x-api-key' = $env:EIDSTACK_API_KEY }
$agentResult = Invoke-RestMethod -Uri "$env:EIDSTACK_BASE_URL/agents/details" -Headers $issuerHeaders
$agentResult.success
$issuerHeaders['x-tenant-id'] = $env:EIDSTACK_DELIVERY_TENANT_ID
```

After checking existing Deligate resources in Swagger, create only a missing matching
schema/definition explicitly. Use the schema contract above and `supportRevocation: true`.
Record the authoritative ID fields locally, then set the server configuration.

Use the dedicated tenant in Swagger for one minimal OOB offer. Do not run a repeat POST
after a timeout until the original exchange is reconciled. Keep the returned object
private. Inspect property names and types locally; provide sanitized structure evidence
with invitation/claim/secret values removed. Verify the invitation byte-for-byte and
its scheme/length, exchange ID, and all observed status values before writing the parser.

For an exchange ID obtained from that authoritative response, read-only checks are:

```powershell
$exchangePath = [uri]::EscapeDataString($exchangeId)
$offerState = Invoke-RestMethod -Headers $issuerHeaders -Uri "$env:EIDSTACK_BASE_URL/issuance/offerStatus?credentialExchangeId=$exchangePath"
$revocationState = Invoke-RestMethod -Headers $issuerHeaders -Uri "$env:EIDSTACK_BASE_URL/issuance/credentials/$exchangePath/revocation-status"
# Inspect the objects privately. Do not log or persist raw responses in Deligate.
```

The organizer APK must demonstrate review/acceptance, actual issuance completion, and
revocation. Only then add response mapping fixtures from the observed sanitized shape.
Keep unknown state fail-closed. No proof, access, trust-registry or holder implementation
is included in this Macro A run.
