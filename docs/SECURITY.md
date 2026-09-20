# SECURITY.md — Deligate Security Baseline

## 1. Security Objective
Deligate is an access-decision application. A false positive is more dangerous than an inconvenient failure. Security-sensitive decisions therefore fail closed.

## 2. Primary Assets
- eidStack API key
- Supabase server secret/service-role material
- Supabase user sessions
- eidStack tenant IDs and DIDs
- credential/proof exchange references
- building access policy
- rider identity attributes used for verification
- audit evidence

Holder private keys, wallet backups and raw credential storage are intentionally **outside Deligate's trust boundary** and remain in the organizer-compatible holder wallet.

## 3. High-Risk Failure Modes
- cross-organization authorization bypass
- frontend-only role enforcement
- leaked API/server secret keys
- mock result presented as live verification
- schema-only/weak issuer acceptance
- trusted/valid status confusion
- revoked rider shown as allowed
- temporary access issued without a verified proof
- malicious/unsupported invitation URI rendered or auto-opened unsafely
- sensitive rider data over-collection or logging
- Deligate accidentally becoming a home-grown credential wallet
- unbounded polling/resource consumption
- mass assignment into security fields

## 4. Required Security Boundaries

### Secrets
- eidStack `x-api-key`: server only
- Supabase server secret/service-role key: server only
- mobile may contain only the public Supabase project configuration intended for client use
- holder private keys/recovery material: never received or stored by Deligate
- do not print secrets on startup errors
- no secrets in screenshots, task sheets, audit rows or test fixtures

### Browser origins
- the API uses an explicit comma-separated `CORS_ORIGINS` allow-list
- development has a small local Expo-origin default when no allow-list is supplied
- production with no configured origin denies cross-origin browser access rather than enabling a wildcard
- cookie credentials remain disabled unless a future authenticated browser design requires and reviews them

### External holder wallet
The organizer-provided/eidStack-compatible wallet owns:
- holder DIDs/keys
- credential storage
- wallet PIN/biometric/backup
- QR scanning
- credential acceptance
- proof selection and consent
- holder-side cryptography

Deligate must not duplicate these controls or create a weaker parallel wallet.

### Authorization
NestJS validates the Supabase session and enforces role/object scope. Supabase RLS provides a second boundary for exposed tables.

For C01, the only direct authenticated-client table access is a self-read of
`profiles`, constrained by `auth.uid() = profiles.id`. There are no client
profile write policies, so a client cannot elevate its role or move itself to a
different organization. All business-domain tables remain default-deny for
direct authenticated access until their feature bundle defines a narrow policy.

Use explicit object checks for:
- rider organization
- building organization
- verification session building/rider
- access pass rider/building
- audit event visibility

### Data minimization
Do not create fields for full Emirates ID number, EID image or home address unless project scope changes with an explicit legal/security review.

Do not log:
- API keys
- bearer tokens
- raw proof presentations
- raw VC/JWT unless explicitly required for a protected debug workflow
- complete QR/invitation payloads
- holder wallet secrets

### QR / invitation handling
The core Deligate flow **renders** eidStack-returned issuance/proof invitations; the external holder wallet scans them.

Controls:
- bound invitation length
- validate expected server-returned shape before render/copy/share
- never invent or modify invitation URLs to make a flow appear successful
- never auto-open arbitrary external URLs
- allow wallet deep-link launch only if the organizer documents the scheme and the user explicitly triggers it
- redact invitation payloads from logs

### Error handling
- client receives safe typed error codes/messages
- server logs a safe correlation/event ID
- do not return stack traces or internal HTTP request bodies
- network/verification uncertainty is not success

## 5. Mock / Live Integrity

The most important hackathon-specific control:

```text
live eidStack error -> error
```

Never:

```text
live eidStack error -> mock success
```

Mock mode must be explicit, deterministic and blocked from live/production startup.

## 6. Trust Decision Model
A green building-access decision requires all applicable checks to pass:

1. proof/credential cryptographic verification
2. expected issuer/credential-definition restriction
3. issuer trusted/authorized in the Trust Registry
4. credential not revoked where revocation is applicable
5. application access policy passes
6. temporary pass has not expired

Cryptographic validity and ecosystem trust are separate checks.

## 7. Temporary Access Controls
- only server creates access grant
- source verification session must be in accepted terminal state
- building/zone is server-owned policy
- expiry is checked using server time
- repeated request is idempotent
- direct API call without valid verification is denied
- temporary credential acceptance/storage remains the external wallet's job

## 8. File Review Security Rule
Hand-written files target <=300 lines and have a hard review limit of 400 lines unless an explicit architectural exception is recorded. Oversized security-sensitive files are split by responsibility so reviewers can reason about authorization, trust and error paths.

## 9. OWASP / ASVS Working Map
- OWASP A01 / API1/API5: role/object authorization, RLS
- OWASP A03: dependency/lockfile review
- OWASP A04: secret protection
- OWASP A05 / API3/API4: input validation, mass assignment, resource bounds
- OWASP A06: secure design, trust/issuer policy, invitation boundary
- OWASP A07 / API2: Supabase session validation
- OWASP A08: workflow/data integrity, idempotency, chained issuance
- OWASP A09: audit/logging without sensitive payloads
- OWASP A10: fail-closed exceptional conditions and truthful state

Use ASVS 5.0 as a verification reference for applicable server/client controls. Do not claim certification/compliance simply because a control is mapped.

## 10. Release Security Gate
Before live integration:
- lint/typecheck pass
- RLS negative suite passes
- API authorization matrix passes
- invitation/QR rendering boundary tests pass
- no-secret scan passes
- mock/live failure test passes
- mock E2E succeeds from fresh seed using simulated external-wallet completion
- complete changed-file review performed
- no hand-written file exceeds 400 lines without an explicit approved exception

Before demo freeze:
- live mode contains no mock marker in active path
- no Critical unresolved security defect
- real organizer wallet successfully handles the required issuance/proof flow or the demo is explicitly blocked
- revocation denial observed or explicitly documented as blocked
- trust result observed or explicitly documented as blocked
