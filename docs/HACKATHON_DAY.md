# HACKATHON_DAY.md — 22 Sep Live Integration Runbook

## Before Receiving the API Key
- C00-C04 and C06-C09 complete or blockers explicitly documented
- C05 Rider companion may remain deferred; it is not required for the core demo
- mock E2E works from fresh seed using simulated external-wallet completion
- mobile and API start from a clean clone
- no secrets committed
- live adapter code exists but is not silently active
- no hand-written file exceeds 400 lines without an explicit approved exception

## External Holder Wallet Gate
Before live issuance/verification, confirm:
- the organizer-provided/eidStack-compatible holder wallet is available
- the wallet is on the required sandbox/test network
- the wallet can scan the eidStack issuance/proof QR used by the sandbox
- Deligate is **not** expected to implement holder keys, credential storage, PIN/biometric, backup, scan, acceptance or proof-consent screens

If the organizer changes this expectation, update `AGENTS.md`, `ARCH.md`, `MODULES.md`, `EIDSTACK.md` and the task sheet before coding the new scope.

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
2. Deligate calls the live adapter to create a real credential offer.
3. Deligate displays the returned invitation QR/link.
4. Rider opens the organizer-compatible wallet and scans/reviews/accepts there.
5. Deligate reconciles and confirms the actual issued status/reference.

There is no Deligate holder scanner or credential-acceptance screen in this flow.

### Rider verification
1. Security creates a connectionless proof request.
2. Deligate requests only the required rider attributes/predicates.
3. Deligate displays the returned proof-request QR/link.
4. Rider scans with the organizer wallet, reviews the exact request and approves/denies there.
5. Deligate confirms the actual proof result.
6. Deligate confirms issuer trust separately.
7. Show green only after required evidence is actually available.

### Temporary access
1. Use verified session as server-side gate.
2. Issue temporary access credential using documented linkage fields when supported.
3. Display the returned issuance QR/link if wallet acceptance is required.
4. Rider accepts the credential in the organizer wallet.
5. Confirm Deligate application access policy is active for configured duration/zone.

Do not claim that a countdown in Deligate proves wallet-side cryptographic expiry unless the live platform behavior actually establishes that.

### Revocation twist
1. Revoke the live rider credential.
2. Confirm revocation/status as the sandbox exposes it.
3. Repeat the next verification/access attempt with the organizer wallet.
4. Show red only from actual failed/revoked result, not an app-side flag.

## QR / DIDComm Note
DIDComm is not "the QR generator." Deligate renders the invitation/request value returned by eidStack. The external wallet scans that QR and the applicable protocol exchange continues. OpenID4VCI/OpenID4VP are separate protocol families.

## Freeze Checklist
- switch app to live mode
- restart API/mobile cleanly
- confirm diagnostics say live
- confirm organizer wallet path works
- perform at least three consecutive rehearsal runs if time permits
- capture non-secret IDs/screens for evidence
- tag/freeze the demo commit
- stop dependency upgrades/refactors unless fixing a release blocker

## If the Sandbox or Holder Wallet Is Temporarily Unavailable
Allowed:
- show previously captured screenshots/video as clearly labeled evidence
- explain the current external-service/wallet blocker
- keep the app in an explicit unavailable/error state

Not allowed:
- auto-switch live to mock and keep green output
- call a Supabase flag "cryptographic verification"
- claim the revocation/trust check ran if it did not
- replace the organizer wallet with a rushed fake Deligate wallet and present it as live
