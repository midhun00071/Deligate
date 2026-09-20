# AGENTS.md — Deligate

## 1. Mission
Deligate is a hackathon application for privacy-preserving delivery-rider verification and temporary building access using eidStack verifiable credentials.

Primary demo flow:

1. Delivery company initiates a `VerifiedRiderCredential` issuance through eidStack.
2. Deligate displays the eidStack invitation/offer QR or link.
3. The rider uses the organizer-provided/eidStack-compatible holder wallet to scan, review and accept the credential.
4. Building security creates a minimal connectionless proof request in Deligate and displays the returned QR/link.
5. The rider uses the external wallet to review the exact requested claims and consent or deny.
6. Deligate receives the verification result and separately evaluates issuer trust, revocation evidence and building policy.
7. If accepted, the building issues a short-lived `TemporaryBuildingAccessCredential` linked to the successful verification.
8. Revoking the rider credential must prevent a later access attempt from being shown as accepted.

## 2. Read Order Before Editing
1. `AGENTS.md`
2. `ARCH.md`
3. `MODULES.md`
4. `SECURITY.md`
5. `EIDSTACK.md`
6. `CODEX_BUNDLES.md`
7. `HACKATHON_DAY.md`
8. `Deligate_Hackathon_Task_Sheet.xlsx`

## 3. Source Priority
For eidStack-specific behavior, use this order:

1. Official eidStack docs: https://test.e-idstack.com/docs/
2. Official eidStack API/module pages referenced in `EIDSTACK.md`
3. Uploaded eIDStack walkthrough supplied for the hackathon
4. Deligate task sheet and architecture docs
5. General SSI knowledge only when the above do not define the behavior

Never invent an eidStack endpoint, request field, response field, protocol capability, limitation or status.

## 4. Technology Stack
- Mobile frontend: Expo React Native + TypeScript
- Routing: Expo Router
- Styling: NativeWind / small shared UI primitives
- Backend: NestJS + TypeScript
- App database/auth: Supabase Postgres + Supabase Auth
- Database client: `@supabase/supabase-js`
- SSI platform: eidStack sandbox
- Holder runtime: organizer-provided/eidStack-compatible external wallet
- Validation: Zod where appropriate at client/shared boundaries; NestJS DTO validation on server
- Package manager: pnpm workspaces

`apps/mobile` is the single universal Expo client for Android, iOS, and web. Platform-specific files are presentation-only exceptions; API clients, services, hooks, validation, state transitions, and authentication state stay shared. Web should be desktop-dashboard appropriate and native touch-first.

Supabase is the app data platform. It is not the source of truth for cryptographic credential validity.

## 5. Architecture Rules
- Deligate's core mobile surfaces are Delivery Admin and Building Security. A Rider companion surface is optional and must remain non-wallet.
- Mobile talks to Deligate NestJS for business actions.
- The Expo bundle must never contain the eidStack `x-api-key` or Supabase server secret/service-role material.
- eidStack calls are server-only through the `eidstack` backend module.
- Application modules depend on an `EidStackPort`, not raw HTTP details.
- Use feature-first frontend folders and module-first backend folders.
- Route files are thin composition only.
- Shared components contain no feature-specific business logic.
- Domain rules must not import React, HTTP clients, Supabase clients or eidStack transport code.

## 6. Holder Wallet Boundary — Non-Negotiable
Deligate does **not** implement an SSI holder wallet unless the official hackathon requirements explicitly change.

The external holder wallet is responsible for:
- holder DID/key management
- secure credential storage
- wallet PIN/biometric controls
- wallet backup/restore
- scanning issuance/proof QR codes
- credential acceptance
- requested-claim review and consent
- proof/credential presentation
- wallet-side cryptographic operations

Deligate may:
- display eidStack-returned issuance or proof-request QR codes/links
- show instructions for using the external wallet
- reconcile server-side workflow status
- show privacy-safe application status/history

Deligate must not:
- store holder private keys or wallet backups
- store raw verifiable credentials or raw proof presentations unless an explicit protected requirement is introduced
- implement a custom DIDComm agent or AnonCreds wallet
- recreate the holder consent/proof-selection screens already owned by the wallet
- claim that an app-side Rider status screen is the cryptographic wallet

## 7. File-Size / Responsibility Guardrails
All hand-written project files must remain easy to review.

**Global rule:**
- target: **300 lines or fewer per hand-written file**
- hard review limit: **400 lines**
- if a file approaches 300 lines, split it by real responsibility before adding substantial behavior
- a hand-written file over 400 lines is not complete until it is refactored or an explicit architectural exception is documented

Generated files, lockfiles, vendored code and an atomic database migration that cannot be safely split are excluded from the hard limit.

Existing tighter targets remain preferred:
- Expo route: target <= 80 LOC
- Screen composition: target <= 160 LOC
- Reusable component: target <= 150 LOC
- Hook: target <= 120 LOC
- NestJS controller: target <= 150 LOC
- DTO/schema file: target <= 100 LOC
- Application/domain service: target <= 200 LOC
- External adapter: target <= 220 LOC
- Test file: target <= 250 LOC

Do not split files cosmetically. Split along real boundaries such as controller/service/repository, screen/components/hooks, adapter/client/mapper, schemas/types or separate domain policies.

## 8. Non-Negotiable Integrity Rules
### No hidden fallback
Deligate has explicit adapter modes:

- `mock`: local/demo development only
- `live`: real eidStack sandbox calls

A failed live call must remain failed. Do not catch a live failure and return mock success, cached green status, hard-coded credential validity or a fabricated invitation.

Mock mode must be visibly identifiable in diagnostics and must be blocked in any production/live configuration.

### No fake cryptographic truth
Never treat any Supabase field such as `status = ACTIVE` as proof that a VC is cryptographically valid, trusted or not revoked.

Supabase may store application references and last-known workflow state. Actual live verification comes from eidStack.

### No test weakening
Do not delete, skip, loosen or rewrite a failing security/behavior test solely to make a bundle pass. Fix the implementation or record the blocker.

## 9. Privacy Rules
Deligate does not need or store:
- full Emirates ID number
- Emirates ID image
- home address
- holder wallet private keys/recovery material
- raw proof presentations
- raw credential payloads by default

Request the minimum attributes necessary for the access decision.

The external wallet, not Deligate, owns the holder's final consent screen. Deligate must ensure the proof request it creates contains only the approved attributes/predicates and a clear purpose/comment where supported.

## 10. Authorization Rules
Roles:
- `DELIVERY_ADMIN`
- `RIDER` — optional Deligate companion role; not the cryptographic holder wallet
- `BUILDING_SECURITY`

Frontend role checks are UX only. NestJS authorization and Supabase RLS are authoritative.

Every object read/write must be scoped to the relevant organization, building or rider. Add negative direct-request tests.

## 11. QR / Invitation / DIDComm Rules
- Deligate renders QR codes from eidStack-returned invitation/request data; it does not invent invitation URLs.
- The organizer-compatible wallet is the component that scans the issuance/proof QR in the core demo.
- DIDComm is a secure agent/wallet messaging protocol used by applicable flows; it is **not** the QR-code generator.
- OpenID4VCI/OpenID4VP are separate protocol families and must not be described as DIDComm.
- Bound invitation length and validate expected server-side shape before rendering/copying.
- Never auto-open arbitrary external URLs.
- Never log complete invitation payloads; use an explicitly redacted diagnostic representation if needed.

## 12. eidStack Rules
Current documented integration base:

`https://test.e-idstack.com/api/v1`

Every request requires `x-api-key`. Tenant-scoped calls also require `x-tenant-id`.

Core Deligate flow should prefer documented connectionless/OOB credential and proof flows unless live sandbox testing establishes another required documented path.

Revocation support must be decided when creating the rider credential definition. Do not assume it can be enabled later.

Credential revocation and Trust Registry entity status are separate security concepts.

Linked issuance may use documented fields such as:
- `linkGroupId`
- `linkedToCredentialExchangeId`
- `linkType`
- `sourceVerificationId`

See `EIDSTACK.md` for endpoint details.

## 13. Codex Bundle Execution Protocol
Execute work by bundle from the `Codex Execution Bundles` sheet, not by randomly selecting individual tasks.

For each bundle:
1. Read the included task rows and prerequisites.
2. Confirm the repository is clean or record existing user changes before editing.
3. Implement only the bundle's authorized combined purpose.
4. Respect the 300-line target / 400-line hard review limit for hand-written files.
5. Run the listed validation boundary.
6. Review complete changed files, not only diffs/summaries.
7. Do not commit unrelated edits.
8. Record task-specific closure evidence.
9. Stop/split if the bundle's scope-guard trigger is hit.

Never let Codex implement a custom holder wallet merely because generic SSI patterns suggest one.

Hackathon-day live bundles `H01` and `H02` remain blocked until authorized API access and the organizer-compatible holder-wallet path are available.

## 14. Definition of Done for Any Task
A task is complete only when:
- requested behavior exists,
- failure behavior is truthful,
- authorization/data scope is correct,
- tests/validation listed in the task row pass,
- no secret is exposed,
- hand-written files satisfy the file-size rule or have an explicit approved exception,
- documentation is updated if behavior/architecture changed,
- no unrelated placeholder or mock has been added to production/live behavior.

## 15. Commands to Preserve
Use stable root scripts once created, for example:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:security
pnpm test:e2e:mock
pnpm dev:api
pnpm dev:mobile
pnpm dev:web
pnpm build:web
```

On Windows, `run.cmd` is the normal local-development entry point and `run.cmd --check` runs the non-watching foundation validation suite. The runner must preserve local data and existing environment values; it must never reset Supabase as ordinary startup behavior.

If the actual repo chooses different names, update this file and the README together.
