# SECURITY.md — Deligate Security Baseline

## 1. Security Objective

Deligate is an access-decision application. A false positive is more dangerous than an inconvenient failure. Security-sensitive decisions therefore fail closed.

## 2. Primary Assets

- eidStack API key
- Supabase service-role key
- Supabase user sessions
- eidStack tenant IDs and DIDs
- credential/proof exchange references
- building access policy
- rider identity attributes used for verification
- audit evidence

## 3. High-Risk Failure Modes

- cross-organization authorization bypass
- frontend-only role enforcement
- leaked API/service-role keys
- mock result presented as live verification
- schema-only/weak issuer acceptance
- trusted/valid status confusion
- revoked rider shown as allowed
- temporary access issued without a verified proof
- arbitrary QR/deep-link execution
- sensitive rider data over-collection or logging
- unbounded polling/resource consumption
- mass assignment into security fields

## 4. Required Security Boundaries

### Secrets

- eidStack `x-api-key`: server only
- Supabase service-role key: server only
- mobile may contain only the public Supabase project configuration intended for client use
- do not print secrets on startup errors
- no secrets in screenshots, task sheets, audit rows or test fixtures

### Authorization

NestJS validates the Supabase session and enforces role/object scope. Supabase RLS provides a second boundary for exposed tables.

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
- complete QR invitation payloads

### QR input

- length bound
- allow-list supported schemes/flow types
- canonical parsing
- no arbitrary browser open
- no JavaScript/custom command execution
- duplicate scan suppression

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

## 8. OWASP / ASVS Working Map

- OWASP A01 / API1/API5: role/object authorization, RLS
- OWASP A03: dependency/lockfile review
- OWASP A04: secret protection
- OWASP A05 / API3/API4: input validation, mass assignment, resource bounds
- OWASP A06: secure design, trust/issuer policy, QR allow-list
- OWASP A07 / API2: Supabase session validation
- OWASP A08: workflow/data integrity, idempotency, chained issuance
- OWASP A09: audit/logging without sensitive payloads
- OWASP A10: fail-closed exceptional conditions and truthful state

Use ASVS 5.0 as a verification reference for applicable server/client controls. Do not claim certification/compliance simply because a control is mapped.

## 9. Release Security Gate

Before live integration:

- lint/typecheck pass
- RLS negative suite passes
- API authorization matrix passes
- QR parser hostile tests pass
- no-secret scan passes
- mock/live failure test passes
- mock E2E succeeds from fresh seed
- complete changed-file review performed

Before demo freeze:

- live mode contains no mock marker in active path
- no Critical unresolved security defect
- revocation denial observed or explicitly documented as blocked
- trust result observed or explicitly documented as blocked
