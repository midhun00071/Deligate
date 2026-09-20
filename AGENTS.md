# AGENTS.md � Deligate

## 1. Mission

Deligate is a hackathon application for privacy-preserving delivery-rider verification and temporary building access using eidStack verifiable credentials.

Primary demo flow:

1. Delivery company issues a VerifiedRiderCredential.
2. Rider holds the credential in a compatible wallet flow.
3. Building security creates a connectionless proof request.
4. Rider reviews exactly what is requested and consents.
5. Backend evaluates cryptographic verification, issuer trust and revocation evidence.
6. If accepted, the building issues a short-lived TemporaryBuildingAccessCredential linked to the successful verification.
7. Revoking the rider credential must prevent a later access attempt from being shown as accepted.

## 2. Read Order Before Editing

1. AGENTS.md
2. docs/ARCH.md
3. docs/MODULES.md
4. docs/SECURITY.md
5. docs/EIDSTACK.md
6. docs/CODEX_BUNDLES.md
7. docs/HACKATHON_DAY.md
8. docs/Deligate_Hackathon_Task_Sheet.xlsx

## 3. Source Priority

For eidStack-specific behavior, use this order:

1. Official eidStack docs: https://test.e-idstack.com/docs/
2. Official eidStack API/module pages referenced in docs/EIDSTACK.md
3. The supplied eIDStack hackathon walkthrough
4. Deligate task sheet and architecture docs
5. General SSI knowledge only when the above do not define the behavior

Never invent an eidStack endpoint, request field, response field, protocol capability, limitation or status.

## 4. Technology Stack

- Mobile frontend: Expo React Native + TypeScript
- Routing: Expo Router
- Styling: NativeWind / small shared UI primitives
- Backend: NestJS + TypeScript
- App database/auth: Supabase Postgres + Supabase Auth
- Database client: @supabase/supabase-js
- SSI platform: eidStack sandbox
- Validation: Zod at client/shared boundaries; DTO validation on server
- Package manager: pnpm workspaces
- Monorepo orchestration: Turborepo

Supabase is the application data platform. It is not the source of truth for cryptographic credential validity.

## 5. Architecture Rules

- Mobile talks to Deligate NestJS for business actions.
- The Expo bundle must never contain the eidStack x-api-key or Supabase service-role key.
- eidStack calls are server-only.
- Application modules depend on an EidStackPort, not raw eidStack HTTP details.
- Use feature-first frontend folders.
- Use module-first backend folders.
- Route files are thin composition only.
- Shared components contain no feature-specific business logic.
- Domain rules must not import React, HTTP clients, Supabase clients or eidStack transport code.

## 6. File-Size / Responsibility Guardrails

These are review triggers, not arbitrary hard limits.

- Expo route: target <= 80 LOC
- Screen composition: target <= 160 LOC
- Reusable component: target <= 150 LOC
- Hook: target <= 120 LOC
- NestJS controller: target <= 150 LOC
- DTO/schema file: target <= 100 LOC
- Application/domain service: target <= 200 LOC
- External adapter: target <= 220 LOC
- Migration by concern: target <= 250 LOC
- Test file: target <= 250 LOC

If a file exceeds a guardrail, split by responsibility rather than by arbitrary line count.

## 7. Non-Negotiable Integrity Rules

### No hidden fallback

Deligate has explicit integration modes:

- mock: local/demo development only
- live: real eidStack sandbox calls

A failed live call must remain failed.

Do not catch a live eidStack failure and return:

- mock success
- cached green status
- hard-coded credential validity
- fabricated QR/invitation data
- fabricated verification result

Mock mode must be visibly identifiable in diagnostics.

### No fake cryptographic truth

Never treat a Supabase value such as:

status = ACTIVE

as proof that a credential is:

- cryptographically valid
- trusted
- unrevoked

Supabase may store application references and workflow state.

Actual live credential/proof validity comes from eidStack.

### No test weakening

Do not delete, skip, loosen or rewrite a failing security or behavior test solely to make a task pass.

Fix the implementation or record the blocker.

## 8. Privacy Rules

Deligate should not require or store:

- full Emirates ID number
- Emirates ID image
- rider home address
- raw proof presentations
- private wallet keys/secrets

Request only the minimum attributes necessary for the building-access decision.

The rider consent screen must show the exact requested attributes/predicates and purpose before sharing.

## 9. Authorization Rules

Roles:

- DELIVERY_ADMIN
- RIDER
- BUILDING_SECURITY

Frontend role checks are UX only.

NestJS authorization and Supabase RLS are authoritative.

Every object read/write must be scoped to the correct:

- organization
- rider
- building
- access session

Add negative authorization tests where applicable.

## 10. QR / Deep-Link Rules

- Never auto-open arbitrary scanned URLs.
- Apply payload-length limits.
- Allow only known flow/scheme patterns.
- Reject malformed/unknown payloads safely.
- Deduplicate repeated camera scans.
- Never log full invitation payloads unless explicitly redacted.

## 11. eidStack Rules

Current integration base:

https://test.e-idstack.com/api/v1

Every request requires:

x-api-key

Tenant-scoped calls also require:

x-tenant-id

Core Deligate flows should prefer documented connectionless/OOB credential and proof workflows.

Revocation support must be decided when creating the rider credential definition.

Do not assume revocation can be enabled later.

Credential revocation and Trust Registry entity status are separate security concepts.

Linked issuance may use documented fields such as:

- linkGroupId
- linkedToCredentialExchangeId
- linkType
- sourceVerificationId

See docs/EIDSTACK.md for integration details.

## 12. Codex Bundle Execution Protocol

Execute work by bundle from the task sheet, not by randomly selecting isolated tasks.

For each bundle:

1. Read included task rows and prerequisites.
2. Check existing repository changes before editing.
3. Implement only the bundle's authorized purpose.
4. Run the listed validation boundary.
5. Review complete changed files, not only summaries.
6. Do not modify unrelated areas.
7. Record task-specific closure evidence.
8. Stop or split if the bundle scope guard is hit.

Hackathon-day live bundles remain blocked until authorized eidStack API access and a compatible holder-wallet path are available.

## 13. Definition of Done

A task is complete only when:

- requested behavior exists
- failure behavior is truthful
- authorization/data scope is correct
- relevant tests and validation pass
- no secret is exposed
- documentation is updated if architecture or behavior changes
- no unrelated placeholder or mock has been added to live behavior

## 14. Root Commands

Expected stable root commands:

    pnpm install
    pnpm dev
    pnpm dev:api
    pnpm dev:mobile
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build
    pnpm check

If command names change, update `AGENTS.md` and `README.md` together.
