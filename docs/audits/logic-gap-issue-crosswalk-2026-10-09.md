# Earth 2036 — Historical logic gap crosswalk and issue reconciliation

**Audited:** 2026-10-09 (UTC). **Authority:** `JILLOnline/Earth-2036@main`.  
**Type:** evidence-backed postmortem addendum, **NOT a machine fix**.  
**See:** [historical 331/640-cycle reconstruction](hourly-continuity-and-claims-ledger-2026-10-09.md).

## Verified current state at last source read

- Machine cycle `20261009T2200Z` observed 250/250; 250 tradable; 176/250 publishable canonical; combined source coverage 70.8%; T0 unpublished; 0 qualified ticks.
- Workgraph Oct 9 22:29Z: 72 researching, one packet-ready, zero chief-ready, one observed, 176 canonical, 72 deferred/stalled in Closure Frontier.
- Learning layer records three active lessons and stall alerts but **0 canonical velocity** over 1h, 6h and 24h. Lesson storage is not proof of self-healing.
- Evidence ledger: 1,589 raw pending, 1,589 unreviewed, 0 reviewed dispositions. Workgraph's 1,588 `supporting` category is *scheduling*, not reviewed nonmateriality.
- Automation state: Scout and Beta disabled, Alpha/Resolver/Chief enabled. Causes of their newest disablements have not been established; previous Scout AEVA GitHub rejected write remains a hard safety hold.
- GitHub issue tracker before this audit: #34 and #37, no independent control-plane issue. This audit adds #38.

## Historical issue crosswalk

| Historical signal and source | Logical failure or missing assumption | Owning GitHub issue | Confidence |
|---|---|---|---|
| 331 recorded machine cycles / 640 UTC-hour slots; 68.2-hour persisted gap Sept27–30 ([forensic reconstruction](hourly-continuity-and-claims-ledger-2026-10-09.md)) | A successful machine-cycle history is not an independent ledger of every scheduled hour; no retrospective audit of all missing slots | [#38](https://github.com/JILLOnline/Earth-2036/issues/38) | Recorded gap confirmed; full failure causes not proven |
| [Sep29 scheduler failure](https://github.com/JILLOnline/Earth-2036/actions/runs/36643025182), [reconcile failure](https://github.com/JILLOnline/Earth-2036/actions/runs/36646778870) | Test failed on malformed `VRTX-20260927T211225Z-council-alpha.json`; preflight prevented subsequent observation, so invalid worker evidence contaminated machine availability | #38 coordination / #34 quarantine owner | GitHub job logs confirmed for Sep29 |
| `scripts/hourly-accountability.mjs` + hourly audit GitHub Actions | Only previous complete UTC hour audited; immutable as-of receipts can remain 'missing' after late successful commits; skips >1 past hour are not swept | #38 | Confirmed code limitation |
| `scripts/earth2036-engine.mjs` vs `scripts/finalize-qualified-tick.mjs` | Engine retains an alternate write+increment qualified-tick branch; engine's current `qualifiesTick` input omits required council/integrity/identity fields, so branch is presently dormant but duplicates the intended finalizer authority | #38 | Confirmed latent design hazard, **not an observed duplicate tick** |
| `scripts/lib/value-allocator.mjs`, `scripts/lib/assist-bus.mjs`, `data/runtime/company-observations.json` | SEC `filingFingerprint` changes do not enter adaptive input signatures; genuine new filings may not wake deferred work; naïve schema migration could wake old failed cases | [#34](https://github.com/JILLOnline/Earth-2036/issues/34) | Confirmed code gap |
| Worker task instructions vs `data/runtime/workgraph/learning-state.json` | Learning advertises Scout6/Alpha4/Beta4/Resolver3 batches; current tasks permit max ONE company/run, so theoretical throughput does not match actual capacity | #34 | Confirmed configuration mismatch |
| Oct9 task runs vs `data/runtime/workgraph/metrics.json` | Task execution is not reliably connected to GitHub role-run or progress metrics; latest ledger reports no role runs within 24h despite task executions | #34 | Confirmed different telemetry domains; write cause unknown |
| `data/baselines/earth2036-official-t0-2026-09-12/manifest.json` vs `evidence-review-queue.json` | Frozen T0 evidence-window end Sep12 and continuously expanding October queue have no explicit publication/trial temporal disposition policy | [#37](https://github.com/JILLOnline/Earth-2036/issues/37) and #38 for qualification authority | Confirmed governance gap; no silent gate change approved |
| `recentFilings()` in `scripts/earth2036-engine.mjs` | SEC submission ingestion scans only first 12 recent filings per issuer. More than 12 during downtime could result in unseen accessions; need cursors/history paging | #37 | Confirmed potential data-loss scenario; actual skipped item count unproven |
| `scripts/lib/evidence-qualification.mjs` | 64-char reviewer hash is syntax-only, no verification against original SEC document bytes; latest-only review fingerprint does not cover all historical reviewed payloads | #37 | Confirmed integrity design gap; not proof of forged reviews |
| Prior live deployment notes and old supervisor memo | Legacy references to Sheet mirrors and PR #4 publication/deploy can conflict with modern GitHub-only single-runtime governance; the current repo's PR #4 is a different historic JSON-integrity repair | #38 | Confirmed historical-document drift, avoid reinstating deprecated infrastructure |
| Open PRs [#1](https://github.com/JILLOnline/Earth-2036/pull/1), [#8](https://github.com/JILLOnline/Earth-2036/pull/8), [#10](https://github.com/JILLOnline/Earth-2036/pull/10) | Old watchdog/Workgraph/Fundamentals code may be duplicated, superseded or still useful; not yet categorized against current main | #38 | Open/old confirmed; integration decision pending |

## Issue ownership and acceptance

- **[#34 — workforce/adaptation](https://github.com/JILLOnline/Earth-2036/issues/34):** diagnose Scout + Beta individually; preserve rejected-write safety; correctly correlate worker run/receipt/progress; connect verified changed-filing evidence to both dormancy signatures without mass reactivation; reconcile batch targets; demonstrate one legitimate source-to-state transition.
- **[#37 — evidence/materiality](https://github.com/JILLOnline/Earth-2036/issues/37):** retrieve original SEC documents, archive real bytes/hash, paginate/accession-reconcile beyond twelve, define defensible temporal scope, issue source-authenticated materiality decisions, preserve all filing/review history, and measure review throughput versus arrivals.
- **[#38 — independent reliability/governance](https://github.com/JILLOnline/Earth-2036/issues/38):** reconcile missing/delayed audit slots, isolate invalid worker inputs while keeping observation plane truthful, enforce one official qualified-tick writer, align T0/trial clock contracts, review old PRs, and prove 72-hour unattended source-backed operation.

## Priority, ordered by dependency

1. Safety diagnosis of Scout/Beta, **without blind restarts**; independently confirm what write artifact, task state, and exception occurred.
2. Preflight fault isolation and hourly attempt reconciliation, because Sept29 demonstrates a single invalid evidence file can stop observation before other research matters.
3. Establish the **baseline as-of vs current/trial surveillance** decision contract before any blanket evidence queue relaxation.
4. Implement actual primary-source review throughput and changed-evidence adaptation without evasion of write safety.
5. Test SWKS (new active member), AEVA (adjudication/source deadlock), and MWA (packet-ready held) end-to-end; ensure no false promotion.
6. Verify full 72-slot endurance including delayed Actions, missing cron, corrupted worker JSON, failed source writes, controlled retries, stale Pages and zero synthetic ticks.

## What this audit does NOT conclude

- 331/640 logged cycles is **not** a 51.7% scheduler failure rate.
- The Sept29 VRTX failure is proven for sampled workflows, **not** the exhaustive root cause of every missing hour.
- Two disabled ChatGPT tasks are not, on their own, proof of a platform or GitHub error.
- A SHA-256 field in a review is **not** proof bytes were fetched or the review is materially correct.
- A successfully merged PR or green UI is **not** proof the adaptive workforce can progress T0.
- No scoring methodology, Beast/Council gate, worker definition, review disposition or official tick was changed by this document.

This document appends corrections to the Oct9 forensic log; it must not rewrite historic evidence or assert tests were run that were not.
