# MODULES.md — Deligate Module and File Layout

## 1. Repository Layout

```text
deligate/
├─ apps/
│  ├─ mobile/
│  │  ├─ app/                         # Expo Router: thin routes only
│  │  │  ├─ (auth)/
│  │  │  ├─ (delivery-admin)/
│  │  │  ├─ (security)/
│  │  │  └─ (rider)/                  # optional non-wallet companion only
│  │  └─ src/
│  │     ├─ components/
│  │     │  ├─ ui/
│  │     │  └─ states/
│  │     ├─ features/
│  │     │  ├─ auth/
│  │     │  ├─ admin-dashboard/
│  │     │  ├─ riders/
│  │     │  ├─ credentials/
│  │     │  ├─ issuance/
│  │     │  ├─ revocation/
│  │     │  ├─ qr/                    # render/validate server-returned invitations
│  │     │  ├─ wallet-handoff/        # instructions/deeplink only if documented
│  │     │  ├─ rider-status/          # optional read-only companion
│  │     │  ├─ security-dashboard/
│  │     │  ├─ verification/
│  │     │  ├─ verification-result/
│  │     │  ├─ access-grant/
│  │     │  ├─ activity/
│  │     │  ├─ analytics/
│  │     │  ├─ settings/
│  │     │  └─ technical-status/
│  │     ├─ lib/
│  │     │  ├─ api/
│  │     │  ├─ supabase/
│  │     │  └─ query/
│  │     └─ theme/
│  └─ api/
│     └─ src/
│        ├─ common/
│        │  ├─ auth/
│        │  ├─ guards/
│        │  ├─ decorators/
│        │  ├─ errors/
│        │  ├─ logger/
│        │  └─ validation/
│        ├─ config/
│        └─ modules/
│           ├─ auth/
│           ├─ organizations/
│           ├─ riders/
│           ├─ buildings/
│           ├─ credentials/
│           ├─ verification/
│           ├─ access/
│           ├─ analytics/
│           ├─ audit/
│           ├─ health/
│           └─ eidstack/
│              ├─ domain/
│              ├─ application/
│              └─ infrastructure/
│                 ├─ mock/
│                 └─ live/
├─ packages/
│  └─ contracts/
├─ supabase/
│  ├─ migrations/
│  └─ seed.sql
├─ tests/
│  └─ e2e/
├─ AGENTS.md
├─ ARCH.md
├─ MODULES.md
├─ SECURITY.md
├─ EIDSTACK.md
├─ CODEX_BUNDLES.md
└─ HACKATHON_DAY.md
```

## 2. Holder Wallet Is External

Do not create Deligate feature folders such as:
- `wallet/` for credential storage
- `scanner/` for the holder QR scanner
- `proof-consent/` for wallet proof selection
- wallet key/backup/biometric modules

Those responsibilities belong to the organizer-provided/eidStack-compatible holder wallet.

`wallet-handoff/` is allowed only for lightweight instructions or a documented wallet deep-link. It must not become a wallet implementation.

## 3. Frontend Feature Pattern

The same feature API, hooks, state, and domain contracts serve Android, iOS, and web. A `.web.tsx` presentation counterpart is allowed only where desktop interaction or layout materially differs; it must compose the same feature layer rather than duplicate it.

A feature owns only what it needs:

```text
features/verification/
├─ api/
│  └─ verification.api.ts
├─ components/
│  ├─ VerificationQrCard.tsx
│  └─ VerificationStatusPanel.tsx
├─ hooks/
│  └─ useVerificationSession.ts
├─ screens/
│  └─ VerifyRiderScreen.tsx
├─ types.ts
└─ index.ts
```

Do not create one giant `VerifyRider.tsx` containing API calls, polling, state mapping and presentation markup.

The guard screen displays the proof-request QR; the external wallet scans it.

## 4. Backend Module Pattern

```text
modules/verification/
├─ domain/
│  ├─ rider-proof-policy.ts
│  └─ verification-state.ts
├─ application/
│  ├─ create-proof-request.service.ts
│  ├─ reconcile-proof-status.service.ts
│  └─ verification-decision.service.ts
├─ infrastructure/
│  └─ verification-session.repository.ts
├─ presentation/
│  ├─ verification.controller.ts
│  └─ verification.dto.ts
└─ verification.module.ts
```

The eidStack module provides a port to this module. The verification module should not know raw HTTP endpoint strings.

## 5. Module Ownership Rules

### Auth
Owns app identity/session bootstrap and backend role context.

### Riders
Owns operational rider profile and delivery-platform association. It does not own the rider's cryptographic wallet.

### Credentials
Owns application-level issuance/revocation orchestration and credential record references. Admin issuance UI may render the eidStack invitation QR/link.

### QR
Owns safe rendering/copy/share of server-returned invitation/request values. It does not scan holder QRs, create SSI invitations or run DIDComm.

### Wallet Handoff
Optional lightweight instructions/deep-link support for the organizer wallet. No key storage, credential storage, proof selection or cryptography.

### Verification
Owns proof policy, verification workflow, trust decision composition and fail-closed result. Building Security displays the proof request for the external wallet.

### Buildings
Owns building/zone/elevator access policy data.

### Access
Owns the server-side gate from successful verification to temporary access issuance and expiry.

### Audit
Owns privacy-safe immutable application event records.

### eidStack
Owns all server-side HTTP integration and translation to application-domain results.

## 6. Import Direction

```text
Route -> Feature screen -> feature hook/API -> NestJS controller
NestJS controller -> application service -> domain rules / ports
Infrastructure adapter -> implements port
```

Forbidden shortcuts:
- React screen -> eidStack API
- React screen -> Supabase server secret/service-role query
- Deligate feature -> holder private-key/credential wallet implementation
- Controller -> raw external HTTP without adapter
- Domain -> Supabase/eidStack/React import
- Feature A importing Feature B internals when a shared contract/component is the real dependency

## 7. File Size and Responsibility

All hand-written files follow the global rule in `AGENTS.md`:
- target <= 300 lines
- hard review limit <= 400 lines

Prefer the tighter per-type limits already defined in the task sheet. Split by responsibility, not cosmetic line count.

Prefer:
- `verification-decision.service.ts`
- `proof-status.mapper.ts`
- `TrustStatusBadge.tsx`
- `InvitationQrCard.tsx`

Avoid:
- `utils.ts` with unrelated helpers
- generic `helpers.ts`
- giant `services.ts`
- giant `types.ts` shared by the whole application
- a Deligate `wallet.ts` that starts accumulating SSI key/credential logic
