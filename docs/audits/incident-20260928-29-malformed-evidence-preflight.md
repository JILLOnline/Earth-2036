# Earth 2036 incident follow-up — 28–29 September 2026 machine-cycle blackout

**Audit recorded:** October 9, 2026 UTC.  
**Evidence strength:** Confirmed for sampled GitHub Actions scheduler failures; full per-run root-cause coverage requires complete job-history analysis.  
**Canonical source:** `JILLOnline/Earth-2036@main`, with sampled immutable Actions records below.

## Previously unknown root cause

The 68.2-hour gap in `data/runtime/cycle-history.jsonl` was initially classified as **machine observation missing; cause unknown**. Subsequent GitHub Actions retrieval established a **specific persistent scheduler preflight failure** over September 28–29.

The scheduler run for September 28 at 21:40 UTC ([run 36487698010](https://github.com/JILLOnline/Earth-2036/actions/runs/36487698010), job `109148511988`) failed at **Install dependencies and run runtime invariants**. The subsequent **Run and persist coherent machine cycle** step was **skipped**. The Node test runner reported **59 passed, 1 failed**, and identified:

> `VRTX-20260927T211225Z-council-alpha.json: Expected ',' or '}' after property value in JSON at position 9951 (line 1 column 9952)`

The September 29 23:02 UTC run ([run 36643025182](https://github.com/JILLOnline/Earth-2036/actions/runs/36643025182), job `109659490382`) failed at the same preflight phase and reported the same test failure. Additional runs sampled on both dates—[36441013356](https://github.com/JILLOnline/Earth-2036/actions/runs/36441013356) and [36590646469](https://github.com/JILLOnline/Earth-2036/actions/runs/36590646469)—also failed during the preflight step.

The historical invariant test `every persisted Workgraph evidence artifact is valid JSON` evaluated the entire evidence directory before an observation could execute. Thus, a single malformed historical evidence artifact blocked otherwise independent hourly machine observations. Concurrent Workgraph reconciliation also failed frequently; worker/receipt commits continued during the same blackout.

## What is proved versus inferred

- **Proved:** Sampled scheduler runs failed before observation, not merely at publication or Pages deployment.
- **Proved:** The repeated test failure identified one malformed Alpha JSON artifact for VRTX.
- **Proved:** No official cycle-history observation was persisted for September 28 or 29, despite ongoing worker commits.
- **Proved:** The currently retrievable VRTX file parses as JSON, and current scheduler source no longer includes the dedicated entire-evidence JSON invariant in its bounded runtime preflight.
- **Not fully established:** Exact commit that repaired the artifact, all 15 historical scheduler attempts, and whether other failures contributed to the blackout.

## Permanent operating lessons

1. The observation scheduler must **not** block 250-company source collection solely because an unrelated historical worker evidence artifact is malformed. Ingest valid evidence, quarantine malformed artifacts for a separate hard CI/integrity alert, and retain their provenance.
2. Never accept *a worker commit* or *a green page deployment* as proof that the machine performed a full hourly observation.
3. Independent hourly receipts must record scheduler run ID, failed step, machine observation presence, and separate tick qualification.
4. A repeatable outage signature needs an explicit owner, a stable incident fingerprint, a changed-input recovery path, and failure budget—not endless retries without evidence change.
5. When a previous user-facing explanation was incomplete, add a dated supersession rather than silently changing the original report.

**Remediation in reliability PR #32:** independent as-of hourly audit receipts, watchdog backstop and post-T0 hourly observation history. These improvements do not retroactively create observations for September 28–29, nor change Methodology 1.0 or qualify ticks.
