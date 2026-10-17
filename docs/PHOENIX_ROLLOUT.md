# Earth 2036 — Project Phoenix: phased reliability rollout

Date: 2026-10-17. Authority: `JILLOnline/Earth-2036@main`.
Status: Phase 1 live; Phase 2A incident history and Phase 2B Pages provenance live. Phase 3A worker obligation shadow live; Phase 3B lease accounting live; Phase 3C original-rejection triage live (worker disable cause unresolved); Phase 4A Chief cryptographic promotion guard under isolated PR testing. No authority migration, task restart, historical backfill or score change.

## Non-negotiables

- GitHub main is the one repository authority; GitHub Pages is a projection.
- Methodology 1.0, Beast/source-mesh/provenance/causal preflight, T0 and 1,000 qualified ticks stay fail-closed.
- Missing source events, scheduled runs, immutable observation history and Chief decisions are NEVER reconstructed or fabricated.
- Historical safety-rejected worker writes remain blocked pending specific review. No alternate-route retry.
- No new paid infrastructure. GitHub Actions cron remains best-effort, not a guaranteed hourly service.

## Phase 1 — Flight Recorder (PILOT)

Deploy only pure diagnostic classification, read-only GitHub Actions job summary and fault-injection tests.
Files: `scripts/lib/phoenix-control-plane.mjs`, `scripts/phoenix-inspect.mjs`,
`test/phoenix-flight-recorder.test.mjs`, and an additive, non-blocking step in
`earth2036-closure-invariants.yml`.

The snapshot derives execution observations from the existing 72-slot reconciliation,
Workgraph research metrics from committed artifacts, and the source-integrity verdict
from current persisted data. It **cannot independently read ChatGPT automation states**;
those are explicitly marked unverified unless provided as authenticated external context.
Root-cause IDs stay constant when the clock or counters advance.

**Go/no-go:** Unit tests pass; no writes to `data/`; CI passes; actual post-merge
closure workflow summary shows separate execution, workforce, research and integrity
planes. Roll back only the additive reporting step if it fails repeatedly; do not
alter original audit history.

## Phase 2 — Continuity and deduplicated incident journal

Add a persistent journal outside canonical runtime, with append-only observations and
separate current incident projection. Never announce recovery merely because an incident
temporarily disappears. Compare actual `data/runtime/cycle-history.jsonl` hour keys,
GitHub Actions run attempts and as-of audit receipts with one classification contract.
Consolidate redundant Pages deploy requests based on public payload/durable deployed SHA,
not unrelated `main` commits. Recovery dispatch may occur only within an open hour with
no existing original observation and no live attempt, subject to authorization.

**Go/no-go:** simulated skipped cron, duplicate job, failed push, partial observation,
and all cron events absent are distinct. Run a 6-hour live coverage pilot. Accept that a
GitHub-only design cannot guarantee an exact hourly schedule without another trigger.

### Phase 2 implementation boundaries (October 17)

- Operational first-seen/open/clear/reopen facts: `data/operations/phoenix/events.jsonl` (append-only) and `current.json` (projection). Their Git commit is part of the EXISTING hourly accountability commit transaction; no new write-heavy scheduled job.
- A fresh absence in an audit is NOT proof of recovery. Two distinct verified windows are required to close an execution incident. Unauthenticated ChatGPT worker states cannot be closed by GitHub timestamps.
- A new `workflow_run` watchdog trigger listens to COMPLETED Closure Invariants and Hourly Accountability workflows, breaking exclusive dependence on cron. It never watches itself. Scheduler recovery is bounded to UTC minutes 20–45, only after confirming the immutable `cycle-history.jsonl` has no corresponding original record and GitHub has no current-hour attempt.
- Watchdog still ends in FAIL on actual critical Workgraph health; the operational reporter may not override a gate.
- A 6-hour live continuity pilot is required before declaring Phase 2 coverage improved. If GitHub creates no triggering event at all, recovery is impossible within a GitHub-only system. Do not claim fixed 24/24 coverage.
- Publication SHA/payload deduplication remains a separate Phase 2 follow-up, gated on existing build-provenance tests. Do not treat Pages workflow event commit SHA as proof of published `source_sha`.

### Phase 2B — GitHub Pages publication provenance pilot (October 17)

- Avoid using GitHub Actions `headSha` as the public deployment source: it is workflow-event provenance, not the `sourceSha` embedded in the already-published `earth2036-deploy.json`.
- `scripts/pages-publication-needed.mjs` compares the verified published source against the current Git commit tree. Exclude only explicitly-known operational-only paths (`data/operations/**`, tests, documentation, non-public Phoenix scripts and non-Pages workflows). Unknown source files and all `data/runtime/**` remain publication inputs.
- CI main-push dispatches Pages only when changed files include a public input AND its Git SHA still equals current main. Watchdog and Workgraph compare actual published source instead of their last workflow-event commit.
- If Pages metadata, published provenance, Git source commit or source-tree comparison cannot be verified, publication decisions fail **open**: request a deployment rather than claiming public freshness from uncertainty. This is a Pages-only behavior, never a source-integrity exception.
- Existing scheduler machine snapshots and lawful canonical promotions continue publishing normally.
- Do not classify this deployment optimization as a cure for missing hourly scheduler runs. Keep the six-hour actual-observation acceptance test open.

## Phase 3 — Verified workforce obligations

Persist a noncanonical `source_request` state contract:
`created → acknowledged → sourced_and_committed → validated → consumed`, or one of
`unavailable_safety_hold`, `unavailable_external`, `timed_out`,
`requires_owner_decision`. A handoff only becomes active if the correct role
accepts it; timed-out unacknowledged work is not `in_progress`.

Enforce source ownership: Scout acquires; Alpha underwrites numeric components;
Beta causal/adversarial; Resolver only source-addressed contradiction pairs.
Unknown-disabled tasks or previously rejected writes may NOT be restarted blindly.

**Go/no-go:** a paused Scout with an Alpha source dependency becomes a named owner
intervention, never a circular retry. No duplicate rejected evidence writes.

### Phase 3A — Non-executing worker obligation shadow (October 17)

- Compile compact, stable obligations from actual `worker-view/assist/*`, `worker-view/routing/*`, and the deferred `source-dependency-handoffs.json` selected pilot. Every obligation retains the exact request/input signature, ticker, source owner and packet path; no new worker authority is introduced.
- Unverified ChatGPT task availability is always labeled `executor_state_unverified`, never "running". A verified disabled worker is `requires_disable_reason_review`; a verified safety hold is `requires_safety_review`; an unsourced contradiction handoff is `awaiting_verified_source_and_worker_clearance`.
- No "acknowledged", "sourced", "validated", or "consumed" states can be claimed from routing alone. Those require a future exact receipt/evidence verification implementation plus independent enablement/safety review.
- Shadow output is read-only, appended to an EXISTING Closure Invariants job summary and has no new cron, repo write, task restart, rejected-evidence retry, canonical or tick side effects.
- First pilot must show the three real frontline roles (Scout, Alpha, Beta) with actionable requests requiring external executor verification while Resolver lacks a structured case; source-dependency handoffs remain non-actionable until independently sourced.

### Phase 3B — First-seen leases and strict acknowledgment compatibility (October 17)

- Preserve one first-observed timestamp for each exact `obligationId` + request/input signature in `data/operations/phoenix/worker-leases.json`; updated only with the **existing hourly audit Git commit**. This date is when Phoenix first saw a route, not when an agent originally started work.
- After 120 minutes without a matching receipt, report `unacknowledged_overdue_needs_review`; **never automatically reassign, re-enable, or retry**. Deleted/vanished routes remain historical `no_longer_routed_unverified`, not completed.
- Optional future receipt contract `earth2036-phoenix-worker-acknowledgment-v1`: exactly matched `obligationId`, `requestId`, `inputSignature`, `owner`, `ticker`, `acknowledgedAt`, and a disposition (`accepted_for_review`, `blocked_safety_hold`, `cannot_proceed`) in `data/operations/phoenix/worker-acks/*.json`. A Git-committed receipt is **self-declared**: without independent worker identity attestation it is *not proof* of an enabled task, successful research or approved write.
- Claimed evidence paths remain `evidence_claim_unvalidated` until primary source bytes, provenance, causal and Workgraph preflight are independently checked. A receipt cannot bypass a safety-rejected Git write, turn a deferred Resolver pair into actionable claims, or qualify a tick.
- No task prompt changes, automation updates or automatic recovery in P3B. Phase 3C must separately verify safety disablement reason and a genuine independent clearance mechanism before modifying the paused workforce. Existing Chief governance remains unresolved and must be reconciled in Phase 4.
- Fault injection: duplicate, stale, wrong-input, mismatched, unsigned/unverifiable receipt; fresh-to-overdue timeout; unchanged signature; disappeared work; safety hold; no unauthorized promotion. A successful CI proves compatibility, **not** restored research throughput.

### Phase 3C — Source-specific write holds and worker-disable review (October 17)

- A reviewed, exact-path index `config/phoenix-known-write-rejections.json` points to original persisted safety-rejection bytes. The source-hold classifier reopens and hashes those bytes; unverified or changed evidence fails closed.
- The Oct 8 Scout AEVA source-acquisition request contains a **specific rejected write**, status `evidence_write_blocked`, `evidenceCommit:not_committed`. The current exact request is held `blocked_rejected_write_needs_review`. This is not a claim that every Scout request shares that rejected payload or that unrelated requests have authorization.
- The Oct 6 Alpha RIO role-run documents a rejected GitHub write but has no exact request ID. Keep this as `historical_target_write_rejection_unattributed`: never translate it into blanket automatic permissions or a fabricated exact input signature.
- The only source for ChatGPT task enablement is the actual task control plane, not GitHub. Current independent review sees Scout, Alpha, Beta, Chief disabled with **unknown verified disable causes**, and Resolver enabled with no actionable cases. No worker has been restarted.
- The explicit resumption classifier returns `hold_disabled` for unknown causes, safety holds, operator pauses or missing authorized diagnostics. Even with independently verified benign interruption, it returns `eligible_for_control_plane_review` (not automatic execution). A receipt or timestamp alone never grants authorization.
- The hourly accountability workflow now has a bounded **push-on-audit-code-change bootstrap** in addition to its original schedule/dispatch, allowing first lease projection initialization from an actual production GitHub run. The normal immutable previous-hour audit and incident journal remain the single authority; no new recurring task is introduced.
- Required live checks: full CI, one closure audit showing scoped rejected requests, one hourly-accountability Git commit with `worker-leases.json`, and no mutation to T0, evidence, score or tick history. Workflow failure from a genuinely missed original observation may remain the expected alert even when operational audit persistence succeeded.
- **Not complete:** obtaining original ChatGPT task disable-event diagnostics and obtaining verified clearances. P3C cannot lawfully resume disabled workers while that evidence is absent. Do not substitute a repo issue statement for task-control-plane evidence.

## Phase 4 — Chief authority coherence

Before any authority change, decide the canonical Chief approval contract and
reconcile `docs/WORKGRAPH_V2.md`, supervisor registry, task prompt and
`scripts/promote-chief-ready.mjs`. Default safety posture: require matching
immutable Chief approval proof for a `chief_ready` packet, with exact packet
fingerprint and source references. No stealth switch from sovereign adjudication to
automatic promotion.

**Go/no-go:** no promotion without the selected approval policy; Beast still
independently verifies score/causal/provenance; deliberately unsafe fixtures fail.

### Phase 4A — Signed Chief adjudication (October 17)

- Root cause verified: `docs/WORKGRAPH_V2.md` calls `chief-earth` sovereign intelligent adjudicator, the actual Chief ChatGPT task is a paused workforce-liveness keeper, and the old `scripts/promote-chief-ready.mjs` could canonically promote a `chief_ready` packet after technical and Beast gates alone.
- New policy `chief-ready-plus-signed-chief-adjudication-v1` requires an affirmative **cryptographically verified Ed25519 Chief signature over the exact persisted packet SHA-256**, ticker, work ID, compiled timestamp and bounded decision window, before any canonical record materializes. A matching genuine `reject` cannot promote.
- `config/chief-adjudication-authority.json` ships **uncommissioned / disabled**; do not invent a signing key or commit a private key. No local repository claim or ChatGPT task timestamp authorizes signature issuance. All `chief_ready` packets therefore remain held by default, with precise reasons in the fast-path report.
- Independent operator commissioning of a sovereign decision authority is explicitly still required. The signed decision file path is `data/operations/chief-adjudications/<TICKER>.json`; a decision can pass only after authorized public key commissioning and separate private key custody. Production is intentionally fail-closed until then. **This is not restored Chief throughput.**
- Original Beast/score/causal/Methodology 1.0/T0 gates still apply **after** signed approval. No test-generated private key appears in production. A passing test of a generated-key fixture is not an actual Chief adjudication.
- The same GitHub main branch remains the one canonical authority. The current paused `Earth Chief Supervisor` task remains a liveness coordinator by configuration and cannot silently acquire adjudication powers.
- Acceptance: CI + full fault injection + live no-spurious-promotion audit. No successful Chief signoff will be claimed until a properly commissioned real one exists. Verify a future chief_ready case is **skipped** without a signed decision and has no canonical mutation.

## Phase 5 — Throughput restoration

Pilot two or three lawful frontier packets before reactivating the full queue.
Measured outcomes: fresh accepted source evidence, removed preflight failures,
fewer unresolved ownership loops, and canonical promotions backed by intact audits.
Optimize task batching only after true per-role closure rates exist.

**Go/no-go:** root-cause ownership is not ambiguous and at least one objectively
useful gate change is persisted; never count a new receipt by itself as progress.

## Phase 6 — Endurance

Run 6-hour, 24-hour, then 72-hour operational windows. Monitor actual observations,
worker acceptance/availability, evidence progress, integrity, and source/publication
consistency separately. Reset a passing continuity window when a genuine slot is
missing; do not insert a synthetic historical cycle. A full historical failure journal
remains visible. T0 trials begin only after 250/250 lawful T0 qualification.

## Known baseline (October 17 snapshot)

- 176/250 active canonical; 73 researching, one packet-ready, zero chief-ready.
- Last 72 completed hours: 23 persisted observations; 49 without a corresponding
  GitHub scheduler run. This is schedule nonarrival, not proof of failed Git pushes.
- Scout, Alpha, Beta and Chief were paused; only Deep Resolver was enabled and had
  no actionable routed work. The repository itself cannot authenticate this roster.
- Best-effort offsets at :07/:27/:47 and watchdog offsets still missed complete hours.
- The latest integrity audit passes; it does not establish operational readiness.
