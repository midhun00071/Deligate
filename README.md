# Deligate

Privacy-preserving delivery rider verification and temporary building access powered by verifiable credentials and eidStack.

## Project Status

Deligate is being developed for the CodeNova Hackathon.

Current phase:

- Application architecture defined
- Development environment being initialized
- eidStack integration runs in explicit `mock` mode until sandbox API access is provided
- Live eidStack integration is planned for hackathon day

## Problem

Delivery riders may be required to disclose more personal information than necessary when entering residential communities, towers, and other controlled buildings.

Deligate is designed around a minimum-disclosure access workflow:

1. A delivery company issues a rider credential.
2. The rider holds that credential.
3. Building security requests only the required proof attributes.
4. The rider reviews and approves the request.
5. The proof is verified using eidStack.
6. A successful verification may trigger issuance of a temporary building-access credential.
7. Revoked rider credentials must fail future verification.

## Core Roles

- **Delivery Admin** � issues and revokes rider credentials
- **Rider** � holds credentials and presents requested proofs
- **Building Security** � verifies riders and grants temporary access

## Technology Stack

### Mobile

- Expo
- React Native
- TypeScript
- Expo Router
- NativeWind

### Backend

- NestJS
- TypeScript
- Zod / DTO validation

### Application Platform

- Supabase Postgres
- Supabase Auth
- Supabase Realtime where appropriate

### Identity Infrastructure

- eidStack Sandbox
- Verifiable Credentials
- Connectionless / OOB credential and proof workflows
- Revocation
- Trust Registry
- Linked verify-then-issue workflows

### Repository

- pnpm workspaces
- Turborepo
- ESLint
- Prettier
- TypeScript strict mode

## Architecture

High-level flow:

    Expo Mobile App
            |
            v
      Deligate NestJS API
         /          \
        v            v
    Supabase      eidStack
    App Data      SSI / Trust

The mobile application never receives:

- eidStack API keys
- Supabase service-role keys
- private wallet keys

eidStack integrations are isolated behind a server-side adapter boundary.

See:

- [Architecture](docs/ARCH.md)
- [Modules](docs/MODULES.md)
- [Security](docs/SECURITY.md)
- [eidStack Integration](docs/EIDSTACK.md)

## Repository Structure

    Deligate/
    |
    +-- apps/
    |   +-- mobile/
    |   +-- api/
    |
    +-- packages/
    |   +-- eidstack/
    |   +-- types/
    |   +-- validation/
    |   +-- config/
    |
    +-- supabase/
    |   +-- migrations/
    |
    +-- docs/
    |
    +-- scripts/
    |
    +-- AGENTS.md
    +-- package.json
    +-- pnpm-workspace.yaml
    +-- turbo.json

## Development Rules

Before modifying the project, coding agents should read:

1. `AGENTS.md`
2. `docs/ARCH.md`
3. `docs/MODULES.md`
4. `docs/SECURITY.md`
5. `docs/EIDSTACK.md`

The project follows a modular architecture.

Large route/page files containing entire feature implementations should not be created. Routes should compose feature modules, while business logic belongs in dedicated hooks, services, domain modules, adapters, and shared packages.

## Environment

Copy:

    .env.example

to:

    .env

Never commit `.env`.

The default pre-hackathon identity mode is:

    EIDSTACK_MODE=mock

Live mode must be enabled explicitly after authorized sandbox credentials are provided.

A failed live eidStack request must never silently fall back to mock success.

### eidStack live bootstrap

With `EIDSTACK_API_KEY` set only in the shell/server environment, inspect or create the two
live eidStack roles without editing `.env`:

    pnpm eidstack:live status
    pnpm eidstack:live bootstrap
    pnpm eidstack:live configure-local

`status` performs only `GET` requests. `bootstrap` tracks public tenant, DID, schema,
credential-definition, and revocation-registry references in the gitignored
`.deligate/eidstack-live-state.json`; it never writes API keys, seeds, wallets, credentials,
proofs, or tokens. It uses `EIDSTACK_BASE_URL` when supplied, otherwise the sandbox base URL.
`configure-local` refuses remote Supabase URLs, reuses the same bootstrap recovery logic, resolves
the two seeded local application organizations, and atomically writes only safe eidStack role
references and organization bindings to `.env`; it never writes an API key or tenant seed.

## Local Development

On Windows, use the single normal entry point after installing Git, Docker Desktop, and Node.js 22 or newer:

    git clone <repository-url>
    cd Deligate
    .\run.cmd

The runner verifies the exact repository pnpm, repairs an incomplete local dependency store once when required tools are missing, starts Docker Desktop when it is installed but stopped, starts or reuses local Supabase without resetting data, applies pending migrations, and seeds idempotent local demo records. It creates missing `.env` files without replacing user-managed values. The seed refuses every non-local Supabase URL.

Use the commands below for the normal setup and diagnostics:

    .\run.cmd
    .\run.cmd --doctor
    .\run.cmd --check
    .\run.cmd --lan-ip <IPv4>

`--doctor` does not start watch processes. It reports tool, Docker, local Supabase, LAN, generated-URL, and port readiness without printing credentials. `--check` is non-destructive and runs whitespace, lint, typecheck, build, and local Supabase schema checks. The runner chooses an active physical Wi-Fi interface ahead of Ethernet and excludes loopback, Docker, WSL, Hyper-V, and link-local adapters; use `--lan-ip` when that choice is unsuitable.

For a physical device, put the phone and laptop on the same reachable network, open Expo Go (and sign in if it asks), then scan the Expo LAN QR. The API listens on the selected LAN address while development is running. Local development creates or updates only these demo accounts: `delivery.admin@deligate.local` and `building.security@deligate.local`. Their shared local-only password is `DeligateDemo2026!`; it must never be used outside local Supabase. The seed never creates the legacy `security@deligate.local` account.

The default mode is `EIDSTACK_MODE=mock`, which simulates the external wallet only at the server adapter boundary. Deligate is not a holder wallet. Live mode requires these server-only environment variable names: `EIDSTACK_API_KEY`, `EIDSTACK_DELIVERY_TENANT_ID`, `EIDSTACK_BUILDING_TENANT_ID`, `EIDSTACK_DELIVERY_ORGANIZATION_ID`, `EIDSTACK_BUILDING_ORGANIZATION_ID`, `EIDSTACK_RIDER_SCHEMA_ID`, `EIDSTACK_RIDER_CREDENTIAL_DEFINITION_ID`, `EIDSTACK_ACCESS_SCHEMA_ID`, and `EIDSTACK_ACCESS_CREDENTIAL_DEFINITION_ID`. Rider OOB offers use the proven short URL and exchange-ID response fields; incomplete live configuration or unverified response fields fail explicitly without a mock fallback.

The Expo app is one universal Android, iOS, and web client. Its eventual web dashboards use desktop-appropriate density while native remains touch-first; API clients, auth state, hooks, and domain logic remain shared.

## Authentication

Supabase Auth is the source of application sessions. The Expo client uses only
publishable Supabase configuration, restores the Supabase session, and resolves
safe application context from `GET /api/auth/me`. The NestJS API validates the
Supabase bearer token, resolves the corresponding Deligate profile, and applies
role authorization server-side. A valid Supabase user without a profile is not
treated as an application actor.

Riders do not need a Deligate account to receive or use credentials: the
external organizer-compatible wallet remains the holder runtime.

## Root Commands

Once the applications are initialized:

    pnpm install
    pnpm dev
    pnpm dev:api
    pnpm dev:mobile
    pnpm dev:web
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build
    pnpm build:web
    pnpm check

## Planning

The development backlog and Codex bundles are documented in:

- `docs/Deligate_Hackathon_Task_Sheet.xlsx`
- `docs/CODEX_BUNDLES.md`
- `docs/HACKATHON_DAY.md`

## Security

Deligate follows secure-by-default implementation rules including:

- server-side authorization
- Supabase Row Level Security
- least-privilege data access
- strict secret separation
- input validation
- QR/deep-link validation
- no hidden mock fallback
- minimal disclosure
- explicit separation between credential validity and issuer trust

See `docs/SECURITY.md` for the complete security model.

# Macro A issuer workflow

Delivery Admin now supports organization-scoped rider records, issuance, status refresh,
and confirmed revocation. Start with `run.cmd`; use the existing Supabase Delivery Admin
account and profile. The server persists references and workflow state only.

`EIDSTACK_MODE=mock` visibly simulates wallet completion after ten seconds. The mock
QR is not usable by the real wallet. `EIDSTACK_MODE=live` currently blocks issuance
before sending an offer because official docs/Swagger do not specify its response fields.
See [issuer setup and live blockers](docs/MACRO_A_LIVE.md).

After `pnpm build`, `node scripts/test-issuer-local.cjs` runs the real local Supabase
Auth/API/database mock flow and removes its isolated fixtures. It refuses remote databases.
The SQL checks in `supabase/tests/issuer_security.sql` run inside a rolled-back transaction.
