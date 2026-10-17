# Earth 2036 — Project Phoenix: phased reliability rollout

Date: 2026-10-17. Authority: `JILLOnline/Earth-2036@main`.
Status: Phase 1 live pilot verified; Phase 2 continuity + incident history candidate on isolated PR branch. No authority migration, task restart, historical backfill or score change.

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

## Phase 4 — Chief authority coherence

Before any authority change, decide the canonical Chief approval contract and
reconcile `docs/WORKGRAPH_V2.md`, supervisor registry, task prompt and
`scripts/promote-chief-ready.mjs`. Default safety posture: require matching
immutable Chief approval proof for a `chief_ready` packet, with exact packet
fingerprint and source references. No stealth switch from sovereign adjudication to
automatic promotion.

**Go/no-go:** no promotion without the selected approval policy; Beast still
independently verifies score/causal/provenance; deliberately unsafe fixtures fail.

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
