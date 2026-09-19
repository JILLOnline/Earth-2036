# Earth 2036 — Workgraph v2 Operating Contract

Status: implementation contract for T0 bootstrap and post-T0 scale.

This contract changes work routing, not Earth Score 1.0, T0 gates, the Decision Ladder, evidence sovereignty, immutable history, or the six required analytical perspectives.

## Objective

Scale Earth 2036 from the initial 250-company baseline to an unbounded discovery population without turning intelligent research into a serial conveyor belt.

The permanent architecture is event/queue driven:

`MACHINE OBSERVATION → DELTA/TRIAGE → SPECIALIST EVIDENCE → PACKET COMPILER → CHIEF ADJUDICATION → DETERMINISTIC GATE`

Clock times schedule opportunities to work. They never define which machine cycle a worker is allowed to read. Every worker consumes the newest complete eligible cycle/work item it has not already processed.

## Five intelligent roles

1. `earth-scout` — discovery + weak signals + expectations/execution. Broad external surveillance and triage. It may create research work but never canonical scores/ranks.
2. `council-alpha` — source integrity + company underwriting. Trust boundary and company-specific primary evidence.
3. `council-beta` — structural/causal + adversarial red team. World model, substitutions, bottlenecks, falsifiers and contradiction search.
4. `deep-resolver` — exception-only research. Receives exact unresolved gates; it does not perform routine full-company underwriting.
5. `chief-earth` — sovereign intelligent adjudicator. Reads preflight-passed promotion packets, resolves material disagreements, promotes defensible canonical changes, and owns periodic frozen decisions.

The deterministic GitHub machine plane owns observation, source health, queue/state validation, packet preflight, watchdog/recovery, recompute, tick finalization, persistence and deployment. A ChatGPT slot must not be spent merely babysitting deterministic machine freshness.

## Six perspectives remain mandatory

The original six perspectives are preserved:

- source-integrity
- company-underwriting
- structural-causal
- discovery-weak-signals
- adversarial-red-team
- expectations-execution

Workgraph v2 changes their scheduling containers only. It does not weaken analytical independence or evidence gates.

## Company/work-item state machine

Canonical coordination states are explicit:

`observed → triaged → researching → evidence_complete → packet_ready → chief_ready → canonical`

A work item may branch to `blocked` from any pre-canonical state. `blocked` must contain one exact gating question and the next lawful evidence path. Vague blockers such as "needs more research" are invalid.

Definitions:

- `observed`: machine has a current observation/identity state.
- `triaged`: intelligent or deterministic triage determined whether deeper work is required.
- `researching`: one or more specialist evidence requirements remain open.
- `evidence_complete`: required specialist evidence objects exist; ordinary browsing is finished.
- `packet_ready`: deterministic compiler assembled one promotion packet with factor/risk/causal/source lineage.
- `chief_ready`: deterministic preflight passed all required packet/gate checks. Chief should not need ordinary dossier assembly.
- `canonical`: Chief adjudicated and the deterministic engine persisted/recomputed the resulting canonical state as required.
- `blocked`: exact gating evidence is unavailable, contradictory, stale, or unresolved.

No item may be labeled `chief_ready` while Chief still needs to assemble routine factor, risk or source-lineage material.

## Structured specialist output

Specialists write immutable evidence objects rather than relying on prose handoff alone. Each company-level object should identify:

- ticker/entity id and cycle/work id;
- lane/perspective;
- evidence claims and concise notes;
- source ids/URLs and origin fingerprints;
- affected methodology factors;
- causal edges/falsifiers where applicable;
- risks;
- contradictions;
- unknowns;
- gating vs non-gating status;
- confidence;
- generatedAt and immutable lineage.

Prose summaries remain useful for humans but never replace structured evidence lineage.

## Promotion packet compiler

A deterministic compiler merges eligible specialist evidence into one immutable company promotion packet. The packet contains at minimum:

- identity/tradability state;
- evidence-window/methodology version;
- all Earth Score factor evidence;
- Risk and Data Confidence evidence;
- primary-source presence;
- causal mapping;
- source lineage and duplicate-origin collapse;
- contradictions and their dispositions;
- gating/non-gating unknowns;
- specialist coverage;
- preflight result and exact failures.

Only a preflight-passed packet becomes `chief_ready`.

## Chief contract

Chief is an adjudicator, not a routine research assembler.

Chief may:

- accept a `chief_ready` packet for canonical promotion;
- reject/return it with an exact gating defect;
- create a targeted Deep Resolver directive for a material unresolved conflict;
- require recompute after canonical changes;
- own Weekly/Monthly/Quarterly/Annual exactly-once decisions.

Chief should not perform broad discovery, routine filing retrieval, ordinary source hunting or reconstruction of a missing packet.

There is one sovereign Chief. If future measured throughput proves adjudication itself is the bottleneck, deputy adjudicators may prepare recommendations, but canonical intelligent authority remains singular.

## Deep Resolver contract

Deep Resolver consumes only precise exceptions. Every directive must contain:

- company/work id;
- exact gating question;
- why it matters;
- preferred primary-source path;
- fallback lawful source families;
- success condition;
- attempt count/last attempt.

It returns `resolved`, `unavailable`, or `still_conflicted` with evidence. It may not loop indefinitely on an unchanged blocker.

## Backpressure

Backpressure is based on downstream capacity, not an arbitrary permanent queue size.

- `chief_ready` target: approximately one Chief run of adjudication work.
- hard ceiling: approximately two Chief runs.
- above the target, Scout/Alpha/Beta prioritize closing existing packets over opening ordinary new research.
- above the hard ceiling, ordinary expansion pauses except for material risk, urgent filings/events, identity/tradability threats and high-priority challengers.

Measured Chief throughput should update operational batch sizes without changing methodology/evidence gates.

## T0 bootstrap

T0 is exceptional because all 250 seeds require first comparable baseline evidence. Workgraph v2 therefore allows broad bootstrap batching, but each company must still pass the explicit state machine and publication gates.

T0 progress is measured by state distribution and canonical promotions, not by raw report count.

The bootstrap queue should expose at minimum:

- observed/triaged/researching/evidence_complete/packet_ready/chief_ready/canonical/blocked counts;
- oldest item age per state;
- throughput per role;
- Chief adjudications per run;
- blocker retry counts;
- packet preflight failures by category.

## Post-T0 dirty set

After T0, the machine observes the entire active universe every qualified cycle, but intelligent workers focus on a dirty set rather than re-underwriting every company from scratch.

Dirty-set triggers include material filings, earnings, financing/dilution, contracts, executive/governance change, regulatory action, patents/standards, procurement, source-confidence decay, causal-graph changes, challenger pressure, scheduled evidence aging/refresh and unresolved contradictions.

Unchanged valid evidence carries forward with lineage and aging rules. Signal volume never substitutes for evidence quality.

## Scale model

The 250-company active universe remains the deep-comparison boundary under methodology 1.0 unless a future methodology version deliberately changes it. Discovery/monitoring may exceed 1,000 or many thousands of entities.

Broad population: machine observation + Scout triage.

Serious challengers / active 250: specialist evidence work.

Only material deltas and scheduled refreshes consume repeated deep intelligent capacity after T0.

## Timing and cycle identity

The old assumption that a worker must process "this hour's" theoretical cycle is retired.

Each worker selects the newest persisted complete machine cycle/work item that:

1. satisfies its input contract;
2. has not already been processed by that role;
3. preserves exact cycle/work lineage.

If the machine is delayed, workers do not guess, mix cycles or use stale data as current. They process eligible backlog or record no eligible work.

## Integrity rules

- No methodology/gate weakening for throughput.
- No second sovereign Chief.
- No score/rank from incomplete packets.
- No vague blocker.
- No clock-derived fake cycle identity.
- No duplicate-origin evidence inflation.
- No historical overwrite.
- No machine/UI/sheet mirror may override canonical Git-backed truth.
- Unknown remains unknown.
- Failed/partial work remains auditable and cannot count as qualified truth.

## Migration principle

Migrate incrementally. Preserve all existing immutable evidence/reports/history. Existing queue labels may be translated into v2 states, but historical records are not rewritten. The v2 coordination layer becomes authoritative only after validators confirm state invariants and current T0 work can be represented without loss.


## GitHub-native v2 control plane

The dedicated repository `JILLOnline/Earth-2036@main` is the sole live authority.

- Git runtime is canonical truth.
- GitHub Actions is the deterministic execution plane.
- GitHub Pages is a browser projection only and always publishes an explicit canonical SHA.
- Netlify, Vercel, spreadsheet mirrors and the legacy Supervisor Council attestation are not live authorities or fallbacks.
- Full CI validates code changes. It is not duplicated on every hourly observation cycle.
- The hourly Scheduler runs targeted runtime invariants, persists one coherent machine cycle and may publish that exact persisted SHA even when newer minion commits are already descendants on `main`.
- Evidence arrival triggers burst-safe Workgraph reconciliation. Pages is dispatched immediately only when canonical projection state changes.
- The Watchdog evaluates machine freshness, Workgraph health, latest relevant Scheduler/Reconcile/CI outcomes and Pages freshness.

## Worker liveness receipts

Each non-Chief intelligent worker writes one immutable role-run receipt for every scheduled run under:

`data/runtime/workgraph/role-runs/<role>-<UTC>.json`

Receipts use actual UTC ISO timestamps ending in `Z`. Materially future-dated timestamps are rejected by Workgraph telemetry. Liveness uses the freshest valid evidence timestamp or valid role-run receipt, preventing an older marker from making an active worker appear stale.

Historical malformed timestamps remain immutable evidence and are counted as telemetry debt; they never override current valid activity.


## Deterministic worker routing queues

Workgraph v2 materializes each intelligent worker's current closure-first queue under:

`data/runtime/workgraph/routing/<role>.json`

These files are derived from the same packet preflight routing that drives owner backlog metrics; they are not a second scheduler or second authority. Every queue item names the company/work id, current state, immutable packet path, exact failures owned by that role, other owners still required, and current evidence paths. Deep Resolver queue items also carry the unresolved gating issues, gating unknowns, and material contradictions from the compiled packet.

Workers must consume this queue before attempting ad-hoc target selection. Stable priority is: closest-to-closure state first, then fewer remaining owners, fewer total failures, more existing evidence, then ticker. This keeps Scout, Alpha and Beta converged on the same completion frontier.

## Safe intelligent-worker persistence

A single commit containing evidence plus its role-run receipt is preferred when a multi-path Git write is available. It is not a throughput dependency.

If only single-path writes are practical, use a conservative two-phase fallback: persist immutable evidence first, then persist the role-run receipt in a second commit referencing the evidence artifact paths and resulting Git head. Never write a success receipt before its evidence. If phase two fails, the repository contains real evidence with stale liveness rather than false liveness with missing evidence, so the failure remains fail-safe and auditable.

A single-path Contents API limitation is therefore never a lawful reason to discard defensible evidence or pause a productive worker.

## Reconcile fail-closed projection rule

Evidence reconciliation always persists truthful non-canonical Workgraph state, routing queues, liveness/health telemetry, and Beast integrity output even when the source mesh is red. A failed Beast/source-mesh audit remains a hard barrier to Chief fast-path promotion, canonical score/rank mutation, tick qualification, and publication. Projection may advance; truth gates may not.
