# CODEX_BUNDLES.md — Execution Model

## 1. Why Bundles

The task sheet contains small verifiable tasks, but Codex should usually execute a coherent group in one pass so it can preserve context and avoid repeated setup/review overhead.

The authoritative bundle list is the `Codex Execution Bundles` worksheet.

## 2. Planned Sequence

| Seq | Bundle | Purpose                                              |
| --: | ------ | ---------------------------------------------------- |
|   0 | C00    | Foundation and engineering guardrails                |
|   1 | C01    | Supabase data and authentication core                |
|   2 | C02    | Expo shell, shared UI and QR primitives              |
|   3 | C03    | eidStack contract, mock and live-client skeleton     |
|   4 | C04    | Delivery Admin issuer slice                          |
|   5 | C05    | Rider holder experience                              |
|   6 | C06    | Building Security verifier slice                     |
|   7 | C07    | Verify-then-issue temporary access                   |
|   8 | C08    | Dashboards, audit and technical status               |
|   9 | C09    | Security hardening and pre-hackathon release         |
|  10 | H01    | Live eidStack onboarding — external gate             |
|  11 | H02    | Live E2E integration and demo freeze — external gate |

## 3. Bundle Prompt Pattern

When asking Codex to execute a bundle, use a prompt like:

```text
Execute bundle C04 from Deligate_Hackathon_Task_Sheet.xlsx.
Read AGENTS.md, ARCH.md, MODULES.md, SECURITY.md and EIDSTACK.md first.
Work only within the bundle's authorized combined purpose.
Respect every included task's acceptance/validation criteria and LOC guardrail.
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
- exact remaining issue, if any
- whether the working tree is clean after the intended commit

## 5. Split Triggers

Split a bundle rather than broadening scope when:

- an eidStack behavior is undocumented,
- a security-critical behavior cannot be validated,
- a task requires external API/wallet access not yet available,
- the bundle starts changing unrelated modules,
- RLS/auth behavior is uncertain,
- a screen/service becomes monolithic and requires a structural refactor,
- a required dependency change risks Expo/NestJS compatibility.

## 6. H01 / H02 Rules

These bundles cannot be marked complete before authorized API access and a real compatible holder-wallet path exist.

Do not close them based on:

- mock responses
- screenshots of the eidStack dashboard
- manually edited Supabase status
- hard-coded IDs
- simulated QR results

A labeled simulation remains useful pre-hackathon evidence, but it is not live closure evidence.
