# Earth 2036 — T0 → 1,000-Tick Autonomous Trial → Reassessment
Status: **PROPOSED OPERATING CONTRACT / NOT DEPLOYED**. Planning document only. Reviewed against `data/baselines/earth2036-official-t0-2026-09-12/manifest.json`, `data/runtime/system-state.json`, `scripts/earth2036-cycle.mjs`, `scripts/finalize-qualified-tick.mjs`, `scripts/lib/runtime-gates.mjs`, `data/runtime/workgraph/shadow/closure-frontier.json` on 2026-10-17.

## Non-negotiable invariants
- Historical T0 evidence cutoff stays `2026-09-12T23:59:59-04:00`; do not admit the later October 17 SEC bridge as T0 evidence without independent source-byte and public-availability checks.
- T0 publication requires the exact existing official gate: 250/250 identity and tradability, 250 publishable methodological scores, sufficient source coverage (currently 0.95 minimum), discovery complete, zero unresolved gating evidence, full council/Workgraph canonical approval, Beast/source-mesh integrity PASS, and a unique complete 1–250 ranking.
- Never bypass source-write holds, rejected evidence, worker execution guards, or amendment/contradiction checks. Reopen dormant work only on changed verified inputs.
- No alternate runtime authority; GitHub main is canonical. No paid cloud additions and no autonomous investment trades.
- Preserve original T0 ranking, methodology version, source snapshots, and immutable tick history. Corrections are versioned separately.
- Machine may continue observation when qualification is blocked; a nonqualified hour does not count as a tick.

## Readiness gates
1. **Close T0**: work the 74 outstanding company packets (AEVA/SWKS frontier first), independently reconstruct SEC source availability, close the 1,860 observed unresolved evidence items lawfully, bring combined source coverage above floor, validate council and source-mesh health. These are snapshot values, not independent totals to add.
2. **Ready for transition**: CI and invariants green, scheduler/watchdog actions verified enabled and nonoverlapping, GitHub main write/read and Pages publication tested, clean Workgraph projections, frozen methodology 1.0, baseline and ranking hash manifest, and full dry-run with fail-closed mutation tests.
3. **T0 transition**: exactly one atomic authority: write immutable T0 snapshot and its source/score/ranking/attestation hashes, publish official baseline once, phase -> trial; ensure observed source and score states reproduce ranking and no shadow data grants authority. Crash midway must resume idempotently rather than produce conflicting snapshots.
4. **Trial begins**: first post-T0 qualified hourly cycle is tick 1, not the T0 publication cycle. Persist independent observation each hour, validate primary sources and Workgraph, evaluate gate and qualify only after all checks pass.
5. **Tick finalization**: unique cycle key + trial epoch, sequence constrained to 1..1000, one immutable tick per cycle, atomic Git commit including tick body / manifest counter / hash chain / append-only ledger, duplicate and concurrent writer rejection, verify no holes or conflicting source hashes before increasing count.
6. **Trial completion**: when tick 1000 is durably committed and independently revalidated, transition to `trial_complete_awaiting_review`; disable *qualification*, not safe read-only monitoring; do not publish tick 1001. Produce frozen manifest, checksums, coverage/downtime/exceptions, 1000 tick inventory, prediction performance by 24h/72h/7d/15d/21d/28d maturity and sector/regime, missing outcomes, calibration and methodology limitations. No auto-approve next method/trial; user reassesses.
7. **Review**: compare objectives, source quality, failure rate, uptime, ranking turnover, forecast calibration and drift. Propose versioned next-stage changes with migration/replay tests. No retroactive edits to the trial.

## Operational state machine (target; build/verify before autonomous launch)
`t0_closure` -> `t0_ready` -> `t0_published` -> `trial_active` -> `trial_complete_awaiting_review`.
Exception states: `held_source_integrity`, `held_evidence`, `held_persistence`, `held_runtime_consistency`, `held_ci`, each with a unique stable reason and an automated resumption criterion. Do not silently auto-resume source-write violations or material contradictions.

## Scheduler and durability
- Existing hourly scheduler stays the only cycle orchestrator; review `.github/workflows/earth2036-scheduler.yml`, `earth2036-watchdog.yml`, reconcile, lock-sync and closure workflows before altering any schedule. Separate bounded worker duties from immutable finalization.
- Enforce repository-wide single-writer lock, concurrency group, per-cycle lease and expiration, append-only audit receipt, source-data snapshot references, and transactional commit / compare-and-swap retry for GitHub writes.
- Retrying same cycle is a NOOP once committed; losing a job before commit can replay from source snapshots, but never invent missing history or count the same hour twice.
- Maintain bounded resources, API throttling/backoff, fixed timeout and disk-size limits. Preserve existing five-active-task capacity principle rather than adding new scheduled tasks without a consolidation audit.

## Watchdog/health/alerts
- Monitor last cycle, last **qualified** tick, last observation, last canonical write, archive age, source mesh, quarantine, evidence backlog, worker queue progress, GitHub write/permissions, workflow failures, concurrent leases, UI projection freshness and accumulated storage.
- On transient fetch errors: continue read-only observation, mark tick unqualified, retry next cycle with bounded backoff.
- On source hash/CIK/cutoff/acceptance mismatch, malformed evidence, conflicting canonical commit or disputed authority: fail closed, freeze qualification, create an auditable reason, notify owner.
- Alert owner on no qualified ticks for 24 hours, repeated workflow failure (2 consecutive runs), permission/write blocker, data corruption, or irreversible gate issue. Suppress noisy repeated alerts with fingerprints, and send a daily concise operating summary.
- A watchdog may diagnose or safely restart idempotent read-only observation; never reactivate restricted workers or override source holds.

## Forecast validity
- Timestamp forecasts at creation; record target definition, instrument/corporate-action adjustments, applicable trading calendar, quote source, horizon-maturity time, confidence and model version. No look-ahead.
- Mark pending forecasts pending until a real observable outcome becomes available. 1000 qualified hourly ticks ≠ 1000 hours of evaluable 28-day outcomes. At trial completion distinguish capture completion from evaluation maturity.
- Report hit rate, calibration, error, coverage, abstention, turnover and sector/regime stratification, including null and disqualified cases. No investment-trade execution.

## Required tests / acceptance
- Green full CI on exact merge head; simulate T0 near-pass with every gate independently false; no early publication.
- Inject crash before/after each publication or tick persistence step; replay leaves exactly one valid T0 or tick.
- Parallel finalizers for same cycle; duplicate cycle, stale source, mismatched source hash, fake attestation, counter drift and missing tick all fail closed.
- Simulate ticks 998/999/1000/1001 and after completion; 1000 persists once, 1001 never qualifies, read-only observation continues.
- Timezone/DST UTC cycle-key tests; primary data unavailable; network rate limits; GitHub 403/409; lost permission; stale UI; cancellation and watchdog retries.
- Verify archive restores from immutable objects into an isolated worktree with matching hashes, no second authority or main branch overwrite.
- Dry-run full T0 -> tick 1 -> tick 1000 -> report + reassessment hold **without live source writes**. Only deploy after tests and owner review.
- Publish one status surface: T0 gate, qualified trial progress, last good cycle, blocked reasons, source/worker health and evidence links. No fabricated rankings.

## Known audit findings at plan creation
- Current official manifest: 176/250 scored and publishable; T0 unpublished; trialEligible=false; qualifiedTrialTicksAfterBaseline=0.
- Current system state: 1,860 unresolved evidence, combined source coverage 0.708, source-mesh publication gate not satisfied.
- The existing finalizer implements T0 -> trial and tick numbering but the inspected code did **not** establish an explicit 1000-tick terminal cutoff or trial_complete transition.
- Existing shadow fundamentals index may lag the machine runtime; it has no T0 admission authority; P7B #76 is separate and not merged.
- This document does not certify that scheduler concurrency, transactional Git persistence, watchdog or report maturity are already implemented. Each must be proved with code, workflow checks, and tests.

## Delivery breakdown
A. **P8 Lifecycle contract/test PR:** explicit max=1000, immutable phase transition and no tick 1001, state-machine tests.
B. **P9 Durable finalization PR:** atomic write and replay correctness, hash chain, parallel-run tests.
C. **P10 Operations PR:** scheduler/watchdog integrity, alerts, safe recovery, capacity/quotas, runbook.
D. **P11 Trial measurement PR:** forecast outcome ledger, maturity-aware scoring, completion/reassessment report.
E. **P12 Launch certification PR:** full staged simulation, evidence-backed checklist, green exact-head CI, rollback/restore, one-click readable dashboard.
Each is isolated; no merge without full CI and confirmation of existing canonical contract compatibility.
