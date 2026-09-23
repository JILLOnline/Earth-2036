# #11 — Fundamentals → Trajectory Truth Bridge v1

## Status and governance

Implementation on the #11 feature branch. **Audit/freeze is not complete until GitHub CI and live SEC canaries actually pass.** This document is an engineering contract, not a claim that an unexecuted canary passed.

- #10: audited point-in-time SEC raw fundamentals, source/record/projection hashes.
- #11: optional validated shadow compact refs, reconstruction and health only.
- Trajectory: feature schema 1.2.0; the existing SEC filing-state channel remains intact.
- **STOP:** no #12 model training, #13 forecasting, score/rank modification, Workgraph mutation, T0/T1000 gate modification or canonical writes.

The versioned #11 JSON configuration is the authority wall. An index is acceptable only at the exact Trajectory asOf and if its index hash, descriptor hashes, ticker, CIK, cutoff and reconstruction metadata pass validation. Absent indexes or missing SEC Company Facts remain unknown; corrupt index entries become invalid; the tick keeps running. No Earth score, rank, subjective label or metric projection is substituted for raw truth.

## Reference and preservation

The Trajectory row stores a compact truthState.fundamentals descriptor: ticker, CIK, asOf, status, truthHash, rawFactsHash, sourcePayloadHash, count, taxonomy list, projectionHash, #10 recordHash, context counts, reconstruction contract and descriptor hash. Raw fact arrays are never embedded in tick JSON. fundamentalsAuditProjection is distinct and explicitly non-learner-authoritative. learningEligibility is per channel: SEC filing state can be eligible even when fundamentals are unknown.

A cryptographic digest alone cannot prove historical availability: the local sidecar keeps immutable, content-addressed SEC source archives and #10 snapshots on raw fact-state changes. Indexes are compact PIT state manifests. If a later SEC payload fails reconstruction of an already-committed historical index, mark historical_truth_unrecoverable and exclude it; do not overwrite original historical hashes. A newly generated historical replay is validation evidence, not a T1000 tick.

## Running the isolated sidecar

Current canary without writes:

    npm run truth:bridge -- --tickers AAPL,ETN,ASML,NVO,AMT,PL,EOSE,BKSY --external JPM:0000019617,BRK.B:0001067983 --limit 10 --no-write --strict

Local production-shadow feed after #11 audit approval (not yet automatically scheduled):

    npm run truth:bridge -- --limit 250 --as-of EXACT_CURRENT_TRAJECTORY_ASOF --publish-health

For initial scale, provide a locally downloaded official SEC Company Facts bulk ZIP:

    npm run truth:bridge -- --limit 250 --as-of EXACT_ASOF --bulk-zip /path/to/companyfacts.zip --publish-health

If the SEC filing fingerprint has not changed, the sidecar reuses an integrity-checked, content-addressed source archive and rebuilds PIT refs for the new asOf without another HTTP request. A changed fingerprint refreshes the company. The --force-refresh option performs an independent drift check; it is intentionally slower and separate. These mechanisms reduce network calls; they do not guarantee that a mutable SEC API will forever reconstruct every historical response.

Historical five-date rehearsal:

    npm run truth:bridge -- --tickers AAPL,ASML --limit 2 --historical --strict --no-write --walk-forward 2021-12-31T23:59:59.999Z,2022-12-31T23:59:59.999Z,2023-12-31T23:59:59.999Z,2024-12-31T23:59:59.999Z,2025-12-31T23:59:59.999Z

Use a truthful SEC User-Agent. Never commit raw local SEC archives or the content-addressed cache to the public repository.

## Failure handling and non-blocking production

The new index lives at data/lab/bridge/current-index.json and is intentionally not checked into Git. Finalizer and Workgraph Shadow read it optionally and never use it in qualification, core scoring or promotion. Exact asOf matching is required: yesterday's index cannot silently enter today's tick. Without a matching audited index, each row receives an explicit unknown reference, not an inferred metric.

System displays separately published health from data/runtime/workgraph/shadow/fundamentals-bridge-health.json. Its initial state says audit pending, not fabricated counts. The sidecar --publish-health flag generates non-ranking per-company hashes, fact counts, taxonomies, cutoff, latest SEC filing metadata and reconstruction state. Until the health artifact is published into the app's GitHub build, the UI shows the last published audit status.

## Audit exit gate

1. Run 61 #11 adversarial unit/integration/storage invariants and all #10 + Trajectory tests.
2. Run ten-company live canary: AAPL, ETN, ASML, NVO, AMT, JPM, BRK.B, PL, EOSE and BKSY. External issuers never enter the production universe/index.
3. Run AAPL/ASML five-date historical PIT rehearsal at 2021–2025 year-ends with independent hash reconstruction; do not count trial ticks.
4. Run full Earth tests, typecheck, production build and autonomous dry run in separate canary CI. Failure affects only #11 PR, not production scheduler.
5. Verify 250 × 1,000 descriptor storage, no repeated raw arrays and no opportunistic 250-per-hour SEC refresh.
6. Inspect actual finalizer/dry-run output and baseline diffs for zero canonical, rank, Workgraph or tick-qualification influence.

**Freeze only after these steps are observed to pass on GitHub, plus a reviewed live source-cache bootstrap and repeated drift canary.** #12 may begin only after explicit #11 freeze.

## Source drift, scale and audit evidence

The first independent #11 GitHub canary run passed all 54 original bridge tests, all 10 live sector canaries, 10/10 AAPL/ASML fixed-cutoff historical reconstructions, 192 full Earth tests, the production build and the non-writing engine dry run: https://github.com/JILLOnline/Earth-2036/actions/runs/35862258880 . The original 10 fixed-cutoff PIT truth hashes are pinned in config/fundamentals-bridge-historical-baseline-v1.json. The weekly independent shadow workflow rebuilds these histories and fails closed on any historical raw hash or fact count drift. It does not rewrite its baseline, change Earth state or count historical rehearsals toward T1000. A separately versioned audit is required to accept any future baseline replacement.

Additional hardening adds actual serialize/parse of 250,000 compact reference rows, offline source cache integrity/persistence/reuse tests, source-cache corruption fail-closed testing, separately tracked projection drift, immutable content-addressed PIT index archives, and regression tests for pinned historical hashes. The **61-test expanded gate** must pass GitHub CI after these changes before declaring #11 frozen. The initial System health artifact continues to declare audit pending until separately published audited health is available. Ingestion is intentionally an isolated optional sidecar, not an unreviewed production schedule; a production durable source-archive bootstrap and live publication remain separate activation steps.

## Post-merge coverage hardening

A subsequent audit exposed a health-denominator issue: the sidecar originally indexed only valid issuers, while failed fetches and invalid source hashes appeared in per-run diagnostics but were omitted from the persisted compact index and System health denominator. The coverage fix keeps **all requested issuers** in each compact index, labels unavailable source data `unknown` and corrupt hashes/CIK identity `invalid`, and preserves the full population count without fake zero fundamentals. The additional two adversarial tests exercise both the real CLI's offline missing/corrupt behavior and mixed status aggregates; #11 now has **61 invariants**. No Workgraph/score/rank/canonical/tick behavior changes.
