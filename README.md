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

## Root Commands

Once the applications are initialized:

    pnpm install
    pnpm dev
    pnpm dev:api
    pnpm dev:mobile
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build
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
