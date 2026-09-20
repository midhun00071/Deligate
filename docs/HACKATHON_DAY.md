# HACKATHON_DAY.md — 22 Sep Live Integration Runbook

## Before Receiving the API Key

- C00-C09 complete or blockers explicitly documented
- mock E2E works from fresh seed
- mobile and API start from a clean clone
- no secrets committed
- live adapter code exists but is not silently active

## H01 — Live Setup

### 1. Configure secrets

Set server-side environment variables only. Do not paste them into source, screenshots or the task sheet.

### 2. Validate API base

Confirm authorized access to:
`https://test.e-idstack.com/api/v1`

### 3. Agent / tenants

- inspect agent details
- inspect existing tenants
- create/select Delivery Platform tenant/DID
- create/select Building tenant/DID
- record only tenant IDs/DIDs required by the app

### 4. Schemas / credential definitions

Create/select:

`VerifiedRiderCredential`

- minimal rider attributes only
- credential definition with revocation enabled

`TemporaryBuildingAccessCredential`

- accessId
- rider reference suitable for demo
- building/zone/floor/elevator bank
- validFrom / expiresAt policy data as supported by the chosen credential representation

Do not add sensitive EID/home-address fields.

### 5. Trust Registry

Ensure the delivery issuer and building verifier/issuer identities have the required trusted role/schema authorization for the demo.

## H02 — Live Flow

### Rider issuance

1. Delivery Admin selects seeded rider.
2. Issue real credential via live adapter.
3. Display returned invitation QR.
4. Holder uses organizer-compatible wallet flow.
5. Confirm actual issued status/reference.

### Rider verification

1. Security creates connectionless proof request.
2. Request only required rider attributes/predicates.
3. Holder reviews and approves.
4. Confirm actual proof result.
5. Confirm issuer trust separately.
6. Show green only after required evidence is actually available.

### Temporary access

1. Use verified session as server-side gate.
2. Issue temporary access credential using documented linkage fields when supported.
3. Confirm rider pass is active for configured duration/zone.

### Revocation twist

1. Revoke the live rider credential.
2. Confirm revocation/status as the sandbox exposes it.
3. Repeat the next verification/access attempt.
4. Show red only from actual failed/revoked result, not an app-side flag.

## Freeze Checklist

- switch app to live mode
- restart API/mobile cleanly
- confirm diagnostics say live
- perform at least three consecutive rehearsal runs if time permits
- capture non-secret IDs/screens for evidence
- tag/freeze the demo commit
- stop dependency upgrades/refactors unless fixing a release blocker

## If the Sandbox Is Temporarily Unavailable

Allowed:

- show previously captured screenshots/video as clearly labeled evidence
- explain the current service blocker
- keep the app in an explicit unavailable/error state

Not allowed:

- auto-switch live to mock and keep green output
- call a Supabase flag “cryptographic verification”
- claim the revocation/trust check ran if it did not
