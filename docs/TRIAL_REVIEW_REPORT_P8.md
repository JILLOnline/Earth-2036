# Trial review reporter — P8 isolated implementation

Execute `node scripts/report-trial-review.mjs` from the Earth-2036 checkout. It reads the committed baseline manifest, runtime state, and all `data/runtime/ticks/*.json` files, validates the complete tick sequence and prints a SHA-256-fingerprinted read-only assessment. The script does not mutate canonical state, publish rankings or qualify ticks. It exits nonzero for corrupt/mismatched history.

A trial review report declares `captureComplete` only after all 1,000 immutable tick receipts, matching counters, and the `trial_complete_awaiting_review` phase agree. Trajectory v1.2 currently contains **observation horizons 12, 24, 36, 60 months** and **modelsEnabled=false / forecastsEnabled=false**. Consequently the requested 24h/72h/7d/15d/21d/28d forecast performance is marked `not_available` and `evaluatedPredictions:0`, not fabricated. Even 1,000 captured hours do not establish mature future outcomes.

This is a first read-only review receipt, not production-ready automatic completion delivery or a substantive calibration engine. Separate P11 work must design verifiable forecast and observed outcomes with no look-ahead, and separate launch certification must prove the exact-head CI, safe finalizer crash replay, and watchdog behavior before merge.

## Disk-backed rehearsal (synthetic, never canonical)

`test/trial-on-disk-rehearsal.test.mjs` builds a temporary directory containing 1,000 correctly named hourly tick JSON files, each with 250 **synthetic** ranking rows, plus terminal runtime/manifest counters. It executes the exact audit and reporting CLIs using the explicit `--root <temp-directory>` option, and checks the integrity verdict, trial report, four observation-horizon totals, and zero fabricated forecast predictions.

Two negative disk tests simulate process interruption:
1. Immutable 1,000th tick exists but authoritative counters remain 999.
2. Both counters say 1,000 but the immutable 1,000th tick is missing.

In both cases the read-only audit rejects inconsistent persistence; in the first case the reporter also exits nonzero without declaring capture complete. Fixture data is deleted after the test. No GitHub source writes, actions dispatches, or primary-source attestations are performed.

**Boundary of the rehearsal:** this validates disk layout and process behavior inside the Node test runner; it does **not** simulate a full GitHub network interruption, actual compare-and-swap conflicts, SEC source recovery, a lawful T0 publication, or independent finance outcome maturity. Those remain gates before merging/production launch.
