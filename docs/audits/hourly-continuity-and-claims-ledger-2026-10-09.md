# Earth 2036 — Hourly Continuity, Healthy-Period Review & Truthfulness Ledger

**Audit date:** 2026-10-09 (UTC unless otherwise stated)  
**Authority:** `JILLOnline/Earth-2036@main`  
**Type:** retrospective, evidence-backed; no change to Methodology 1.0, T0 gates, workers, or canonical evidence  
**Evidence cutoff:** recorded machine cycle `20261009T1400Z`, observed `2026-10-09T14:41:24.789Z`.  
**Status:** Initial historical reconstruction. Root causes and GitHub Actions outcomes that have not been independently verified are explicitly marked *unproven*.

## Contract — two clocks, two ledgers

1. **Hourly observation clock:** attempt one source-backed, as-of-timestamped machine observation every UTC hour, including post-T0, independent of whether qualification passes. A missed scheduled slot is an incident, never an invented observation.
2. **Attempt/operations ledger (to implement):** one append-only record per scheduled hourly slot, including run ID, due time, actual start, data cutoff, source retrieval, per-source failure/freshness, git write attempt/result, reconciliation, publication and failure/skip codes. Record failed jobs and abandoned/raced attempts, not merely committed successes.
3. **Qualified-trial ledger (existing finalizer; improve assurance):** after T0 is officially published, increment Tick 001/1000, etc. **only** for a real observation that satisfies every locked gate: active 250, identities, tradability, comparable evidence, >=95% combined source coverage, discovery, council attestation, integrity, no outstanding gating material evidence, immutable snapshot. Failed hours remain in the attempt ledger with **no** fabricated tick or backfill.
4. **Immutable temporal policy:** retain as-of source hash/lineage, scheduled UTC slot, actual captured timestamp and decision time separately. An hour observed later is not relabeled as if observed during a missed slot. Workers' evidence and web projection remain separate from qualified observations.
5. **Claims ledger:** for every human-facing assertion such as 'healthy', 'fixed', 'live', 'published', 'hourly', or 'autonomous', save the exact claim, claimed scope, independent source, observed outcome, confidence classification (verified/partial/unverified/contradicted), correction and follow-up.

## Sources inspected

- Machine records: [`data/runtime/cycle-history.jsonl`](https://github.com/JILLOnline/Earth-2036/blob/main/data/runtime/cycle-history.jsonl), 331 JSON lines, all parseable, unique cycle keys in this inspection.
- Control plane: [`earth2036-scheduler.yml`](https://github.com/JILLOnline/Earth-2036/blob/main/.github/workflows/earth2036-scheduler.yml), [`earth2036-watchdog.yml`](https://github.com/JILLOnline/Earth-2036/blob/main/.github/workflows/earth2036-watchdog.yml), [`earth2036-workgraph-reconcile.yml`](https://github.com/JILLOnline/Earth-2036/blob/main/.github/workflows/earth2036-workgraph-reconcile.yml).
- Qualification code: [`scripts/earth2036-engine.mjs`](https://github.com/JILLOnline/Earth-2036/blob/main/scripts/earth2036-engine.mjs), [`scripts/finalize-qualified-tick.mjs`](https://github.com/JILLOnline/Earth-2036/blob/main/scripts/finalize-qualified-tick.mjs), [`scripts/lib/runtime-gates.mjs`](https://github.com/JILLOnline/Earth-2036/blob/main/scripts/lib/runtime-gates.mjs).
- System and Workgraph state: [`system-state.json`](https://github.com/JILLOnline/Earth-2036/blob/main/data/runtime/system-state.json), [`workgraph/metrics.json`](https://github.com/JILLOnline/Earth-2036/blob/main/data/runtime/workgraph/metrics.json), [`command-summary.json`](https://github.com/JILLOnline/Earth-2036/blob/main/data/runtime/workgraph/worker-view/command-summary.json).
- Immutable historical code snapshots: [Sep 18](https://github.com/JILLOnline/Earth-2036/commit/bf9914ecf8eb37ee5fa0405fdee46dafe0097b1c), [Sep 20](https://github.com/JILLOnline/Earth-2036/commit/ac915a0b6d038683fc7888361b1219a1e19e6bcb), [Sep 25](https://github.com/JILLOnline/Earth-2036/commit/3bd4c2c7028c2d0cd88dd17aa44999b4687620d2), [Sep 26](https://github.com/JILLOnline/Earth-2036/commit/29bfbf8ad17184e9e65735ca0b5e3e2185f709cb), [Sep 27](https://github.com/JILLOnline/Earth-2036/commit/f88e1f1d3795d7bc21147801311371af6d49eda5), [Sep 30](https://github.com/JILLOnline/Earth-2036/commit/f0fda0ce0b712c10966a106d92ffacc220ab922f), [Oct 1](https://github.com/JILLOnline/Earth-2036/commit/391c4fbe95c75d5a063381602dc4c4e4e81a0a9a), [Oct 3](https://github.com/JILLOnline/Earth-2036/commit/e25efc48db7c15f2168ad589a3e00259c5be63ee), [Oct 7](https://github.com/JILLOnline/Earth-2036/commit/df4facc64eed2b7fe0b505d62d240aa13eca180f), [Oct 9](https://github.com/JILLOnline/Earth-2036/commit/2b6a1556dfe77800724cae496e1d67fbb8832c41).
- Contracts: [`AUTONOMOUS_READINESS.md`](https://github.com/JILLOnline/Earth-2036/blob/main/docs/AUTONOMOUS_READINESS.md), [`OFFICIAL_T0_BASELINE.md`](https://github.com/JILLOnline/Earth-2036/blob/main/docs/OFFICIAL_T0_BASELINE.md), [`WORKGRAPH_V2.md`](https://github.com/JILLOnline/Earth-2036/blob/main/docs/WORKGRAPH_V2.md).

## Measured historical results

- Coverage span: first retained cycle `2026-09-12T23:30:31.066Z` through last cycle `2026-10-09T14:41:24.789Z` (about 639.2 elapsed hours / 640 inclusive UTC-hour slots). **331 distinct recorded slots, ~51.7% of elapsed slots.** This is a retained-record coverage metric, **NOT** the GitHub Actions success rate; historical workforce-hour policies may have varied.
- Best consecutive calendar-day stretch: **Sep 25: 24/24 slots, Sep 26: 23/24, Sep 27: 22/24 — 69/72 (95.8%)**. This is observed ledger continuity, not proof all components were healthy.
- Largest gap **68.2 hours**: `2026-09-27T21:08:05.330Z` to `2026-09-30T17:22:35.250Z`. No records for Sep 28 or Sep 29 in the machine-cycle ledger. GitHub commit history shows worker/receipt/evidence activity both days, so absence of machine records must not be narrated as complete worker or repository inactivity. Cause of missing machine-cycle records remains unproven pending Actions log review.
- Recorded canonicals: Sep 18 EOD **12**; Sep 20 EOD **49**; Sep 23 near EOD **117** in machine ledger (later post-cycle snapshot **119**); Sep 25 **142** in cycle ledger (later snapshot **143**); Sep 26 **154**; Sep 27 **168**; Sep 30 **168**; Oct 1 **169**; Oct 3 **175**; Oct 7 **177**; Oct 9 **177**. Counts differ slightly when a Workgraph promotion occurs after the latest machine-cycle entry; always label the event-time and authority of a count.
- The 331 records show **zero qualified trial ticks** and T0 not published; this is correct under current incomplete baseline and is not evidence of trial progress.

## Healthy-period comparisons: what actually went right, and what did not

| Period | Verified positive | Verified limitation | Actionable lesson |
|---|---|---|---|
| Sep 18 | Snapshot Workgraph `healthy=true`, canonical 12, active promotion/reconcile activity | Combined source coverage 5.2%, discovery incomplete, T0 locked | 'Workgraph healthy' is a scoped status, never 'Earth 2036 entirely healthy' |
| Sep 20–23 | Canonical climbed 49 -> 119 in sampled snapshots; specialist output and promotion pipeline were converting evidence | Workgraph unhealthy on Sep 20 and Sep 23 (Scout zero-closure warning; Resolver stale backlog); observation frequency below one per hour | High promotion throughput does not prove full liveness or gate readiness; measure independently |
| Sep 25–27 | 69 of 72 UTC slots recorded, canonical advanced approximately 143 -> 168 by end of period | Workgraph health was **false** even as progress continued; alerts covered zero-yield Resolver and stalled/zero-yield owners | Replicate scheduler/commit cadence and evidence conversion; fix unhealthy specialists rather than label whole period green |
| Sep 28–30 | Worker receipt/evidence commits continued during Sep 28–29; machine records resumed Sep 30 | 68-hour machine-ledger gap and canonical 168 unchanged | Add independent scheduler-attempt logging and failure receipts; reconcile scheduler, worker, machine, publication separately |
| Oct 1–3 | Canonical eventually rose 168 -> 175; routing and score evidence still existed | Near-stall and material preflight/role-owner mismatches; Oct 1 had `chief_ready=1` with a stalled promotion alert | Trace packet -> preflight -> ownership -> reconciliation -> Beast -> canonical; avoid process metrics as completion proxies |
| Oct 7–9 | 177/177 canonical math records passed integrity at latest audit; machine still observed 250/250 | 249/250 tradability, 72 researching, one packet-ready, zero chief-ready, 71 Alpha cases deferred, zero recent canonical change | Finish membership consistency, and make dormancy recovery acquire changed evidence without duplicate spin or gate bypass |

## Incident and claim-correction ledger (append new dated entries, do not rewrite observations)

**INC-001 — Healthy label conflated subsystems (CONFIRMED mismatch).** Sep 18 Workgraph `healthy=true` with 12 canonical and 5.2% combined source coverage/discovery incomplete. **Correction:** report machine freshness, worker productivity, Workgraph health, source coverage, truth gates, UI deployment and T0 separately. No single green badge represents the whole system.

**INC-002 — Scheduled-hour visibility gap (CONFIRMED observation gap; root cause UNPROVEN).** 331/640 distinct recorded hour slots, including missing Sep 28–29 despite worker commits. **Next proof required:** actual scheduled/dispatch job outcomes, retries, timeout, concurrency, permission failures and persistence for each missing slot.

**INC-003 — 'Completed' vs 'qualified' ambiguity (CONFIRMED contract risk).** `cycleStatus` becomes completed when 250 companies are observed, not when source/council/integrity/T0 gates all pass. Engine appends successful cycle state; the finalizer owns official qualified tick publication. **Correction:** show `observation_completed`, `pipeline_committed`, `workgraph_healthy`, `source_gate_passed`, and `qualified_trial_tick` as different statuses.

**INC-004 — Success-path-only machine logging (CONFIRMED design gap).** Scheduler's `set -e` and Git commit/push path mean a failed run can leave no durable cycle-history line. **Correction:** append independent run/slot outcome telemetry even for failures; do not count an error as an observation. Verify delivery across Git write permission/outages.

**INC-005 — Stalled frontier despite fresh cycles (CONFIRMED).** Sep 30 through Oct 9 show repeated machine observations while canonicals slowly advanced 168 -> 177; Oct 9 Workgraph says 72 researching, 1 packet_ready, 0 chief_ready and persistent owner/frontier alerts. **Correction:** condition recovery on change in evidence/failure signatures and alternate actionable work, not on clock-based retry alone.

**INC-006 — Adjudication/dormancy dead-end (CONFIRMED).** Deep Resolver 54 raw cases but 0 actionable in current routing; Alpha has 72 raw cases but 1 actionable and 71 deferred. Structured source-addressed contradiction pairs required. **Correction:** distinguish an actual contradictory claim pair from an ordinary source uncertainty; require exact new-evidence acquisition triggers. Never demote a material issue solely to improve throughput.

**INC-007 — Worker autonomy and liveness gap (CONFIRMED state; cause UNPROVEN).** At Oct 9 automation inspection Scout and Chief Supervisor were disabled; Alpha/Beta/Resolver enabled. GitHub Watchdog can monitor scheduler/pages but does not independently reactivate ChatGPT tasks. **Correction:** implement self-healing where supported, explicit intentional-pause protection, and a truthful alert requiring operator action where cross-system restart is unavailable. Audit why each task stopped before re-enabling.

**INC-008 — Membership leakage (CONFIRMED).** Oct 9 tradability still 249/250. [PR #31](https://github.com/JILLOnline/Earth-2036/pull/31) proposes retiring QRVO and onboarding SWKS while retaining identity history. **Correction:** test and approve replacement through existing governance, no silent seed or history rewrite.

**INC-009 — Runtime vs UI projection claims (HISTORICAL REPORTED issue, full historic recheck needed).** Initial Netlify deployment was a verified static snapshot but did not automatically track the active canonical branch. Previous 'ready/live' descriptions were overbroad. **Correction:** future claims require actual source SHA, deployed SHA, route/assets/live runtime payload and deployment timestamp. GitHub Pages is currently only a projection of `main`.

**INC-010 — Model/assistant success claims (PROCESS CORRECTION).** A statement such as 'fixed', 'green', 'all set' or 'hourly' must be tagged **verified**, **partial**, **unverified** or **contradicted** with both source and time. Never imply that a prompt edit, a commit, a receipt, or a passed CI job is end-to-end production recovery without checking the downstream result.

## What to build without compromising the beast

### P0 — Continuous truthful logging (new code required)

- Preserve `cycle-history.jsonl` as historical observations; do not silently synthesize omitted past hours.
- Add append-only `run-attempts` records, including failed/aborted/missing slots reconciled with GitHub Actions. Distinguish 'scheduled but not dispatched' from 'ran and failed', 'ran but could not commit', and 'worker ran without machine cycle'.
- Every slot: UTC `hourKey`, schedule deadline, workflow run ID/attempt, Git SHA parent/persisted, started/completed time, observedAt, source freshness/coverage, `companiesObserved`, `scored`, `publishable`, Workgraph `canonical`, packet_ready/chief_ready, unresolved material evidence, integrity results, T0/trial gate and exact failed checks.
- Deduplicate attempts by `(hourKey, githubRunId, runAttempt)`; reconcile multiple retries as distinct attempts under the same hour. A single qualified tick per actual eligible cycle key. Never replay a missed slot as if contemporary.
- Create a separate append-only **claim-verification ledger** with `claimedAt`, exact claim text, claimed scope, actual source pointers, verdict, correctionAt, and impact.

### P1 — Hourly execution assurance

- A deterministic watchdog computes lag since the last **persisted successful observation**, since the last **attempt**, and since the last **qualified tick**, separately; GitHub Actions cron timing is best-effort, so missing/delayed jobs must be visible and safely dispatched when possible.
- Verify source snapshots, machine status, scores, Workgraph preflight, Chief/Beast gates, qualified tick finalization and Pages SHA as a chain; a failure in one stage does not turn upstream work into false progress.
- Retain complete hourly post-T0 observations as raw history even when qualification fails; report the exact reason no tick qualified.

### P2 — Honest unattended acceptance test

- Compare historical healthy-window throughput with a new **72-hour uninterrupted observation trial**. For every expected hourly slot, there must be an explicit observable outcome and diagnostics, preferably a successful contemporaneous observation. No silent empty windows.
- Simulate Source outage, disabled worker, failed evidence write, stale supervisor coverage, red integrity gate, overlapping reconciliation, and stale Pages. Verify safe recovery or explicit escalation, preserving T0 and methodology.
- Measure **recorded-hour coverage, qualified-hour coverage after T0, canonical velocity, backlog age, useful material evidence, assists changed/closed, write failure rate, and recovery time**; never substitute a fresh commit count.

## Scope/limits

- GitHub Actions run-history GET calls were unavailable in this inspection. Therefore absence of a cycle record is **not proof** a job never executed; actual job logs/dispatch outcomes remain to be retrieved through an authorized interface.
- Task activation reasons were not established; paused workers are not automatically evidence of platform failure. No workers or gate code were modified in this audit.
- Historical source data was sampled from frozen GitHub commits and the entire retained cycle ledger; this is not yet a full per-run inspection of every workflow job and receipt.
- This document is a first auditable baseline for continued corrections. **Do not overwrite past verdicts without an appended supersession entry.**

## Outcome at cutoff

**T0 remains locked: 177/250 canonical, 249/250 tradability, combined coverage 71.2%, 0/1000 qualified post-T0 ticks.** Our next success criterion is sustained truthful hourly observation logging and lawful closed-loop recovery—not merely a green dashboard.
