# MODULES.md — Deligate Module and File Layout

## 1. Repository Layout

```text
deligate/
├─ apps/
│  ├─ mobile/
│  │  ├─ app/                         # Expo Router: thin routes only
│  │  │  ├─ (auth)/
│  │  │  ├─ (delivery-admin)/
│  │  │  ├─ (rider)/
│  │  │  └─ (security)/
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
│  │     │  ├─ rider-home/
│  │     │  ├─ wallet/
│  │     │  ├─ scanner/
│  │     │  ├─ qr/
│  │     │  ├─ offers/
│  │     │  ├─ proof-consent/
│  │     │  ├─ security-dashboard/
│  │     │  ├─ verification/
│  │     │  ├─ verification-result/
│  │     │  ├─ access-grant/
│  │     │  ├─ access-pass/
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

## 2. Frontend Feature Pattern

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

Do not create one giant `VerifyRider.tsx` containing camera code, API calls, polling, state mapping and presentation markup.

## 3. Backend Module Pattern

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

## 4. Module Ownership Rules

### Auth

Owns app identity/session bootstrap and backend role context.

### Riders

Owns operational rider profile and delivery-platform association.

### Credentials

Owns application-level issuance/revocation orchestration and credential record references.

### Verification

Owns proof policy, verification workflow, trust decision composition and fail-closed result.

### Buildings

Owns building/zone/elevator access policy data.

### Access

Owns the server-side gate from successful verification to temporary access issuance and expiry.

### Audit

Owns privacy-safe immutable application event records.

### eidStack

Owns all server-side HTTP integration and translation to application-domain results.

## 5. Import Direction

```text
Route -> Feature screen -> feature hook/API -> NestJS controller
NestJS controller -> application service -> domain rules / ports
Infrastructure adapter -> implements port
```

Forbidden shortcuts:

- React screen -> eidStack API
- React screen -> Supabase service-role query
- Controller -> raw external HTTP without adapter
- Domain -> Supabase/eidStack/React import
- Feature A importing Feature B internals when a shared contract/component is the real dependency

## 6. Keep Code Small by Keeping Responsibilities Small

Use helpers only when they represent a stable responsibility. Do not create abstraction layers merely to reduce line counts.

Prefer:

- `verification-decision.service.ts`
- `proof-status.mapper.ts`
- `TrustStatusBadge.tsx`

Avoid:

- `utils.ts` with unrelated helpers
- generic `helpers.ts`
- giant `services.ts`
- giant `types.ts` shared by the whole application
