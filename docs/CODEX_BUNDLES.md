# CODEX_BUNDLES.md — Execution Model

## 1. Why Bundles
The task sheet contains small verifiable tasks, but Codex should usually execute a coherent group in one pass so it can preserve context and avoid repeated setup/review overhead.

The authoritative bundle list is the `Codex Execution Bundles` worksheet.

## 2. Planned Sequence

| Seq | Bundle | Purpose |
|---:|---|---|
| 0 | C00 | Foundation and engineering guardrails |
| 1 | C01 | Supabase data and authentication core |
| 2 | C02 | Expo shell, shared UI and QR/invitation rendering primitives |
| 3 | C03 | eidStack contract, mock and live-client skeleton |
| 4 | C04 | Delivery Admin issuer slice |
| 5 | C05 | Optional Rider companion/status — **deferred by default; not a holder wallet** |
| 6 | C06 | Building Security verifier slice |
| 7 | C07 | Verify-then-issue temporary access |
| 8 | C08 | Dashboards, audit and technical status |
| 9 | C09 | Security hardening and pre-hackathon release |
| 10 | H01 | Live eidStack onboarding — external gate |
| 11 | H02 | Live E2E integration with organizer holder wallet and demo freeze — external gate |

C06 does not depend on C05. The core demo can proceed without any Deligate Rider companion UI because the organizer-compatible wallet is the holder runtime.

## 3. Bundle Prompt Pattern
When asking Codex to execute a bundle, use a prompt like:

```text
Execute bundle C04 from Deligate_Hackathon_Task_Sheet.xlsx.
Read AGENTS.md, ARCH.md, MODULES.md, SECURITY.md and EIDSTACK.md first.
Work only within the bundle's authorized combined purpose.
Respect every included task's acceptance/validation criteria.
Keep hand-written files <=300 lines where practical and never >400 lines without an explicit architectural exception.
Do not implement a custom SSI holder wallet, QR scanner for the holder, holder key storage, credential storage, or proof-consent UI; the organizer-compatible wallet owns those responsibilities.
Do not add hidden mock/live fallback or weaken tests.
Run the bundle validation boundary, review all changed files, and report task-by-task closure evidence plus any blocker.
Do not start the next bundle.
```

## 4. Required Bundle Output
At the end of a bundle, Codex should report:
- bundle ID
- tasks attempted
- tasks closed
- tasks blocked/deferred
- files changed
- tests/commands run
- security checks run
- files approaching/exceeding 300 lines and any >400-line exception
- exact remaining issue, if any
- whether the working tree is clean after the intended commit

## 5. Split Triggers
Split a bundle rather than broadening scope when:
- an eidStack behavior is undocumented,
- a security-critical behavior cannot be validated,
- a task requires external API/wallet access not yet available,
- a proposed change starts implementing holder-wallet responsibilities inside Deligate,
- the bundle starts changing unrelated modules,
- RLS/auth behavior is uncertain,
- a hand-written file approaches 300 lines and the next behavior belongs to a separate responsibility,
- a required dependency change risks Expo/NestJS compatibility.

## 6. C05 Rule
C05 is deferred unless the core issuer/verifier/access demo is stable and a Rider companion adds clear demo value.

If activated, C05 may only implement privacy-safe application status/history/instructions. It must not implement:
- credential storage
- holder DID/key management
- wallet backup/restore
- QR scanning for issuer/verifier flows
- credential acceptance
- proof-selection/consent
- DIDComm agent logic

## 7. H01 / H02 Rules
These bundles cannot be marked complete before authorized API access and a real organizer-compatible holder-wallet path exist.

Do not close them based on:
- mock responses
- screenshots of the eidStack dashboard
- manually edited Supabase status
- hard-coded IDs
- simulated QR results

A labeled simulation remains useful pre-hackathon evidence, but it is not live closure evidence.
