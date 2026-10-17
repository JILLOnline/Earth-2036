# Trial review reporter — P8 isolated implementation

Execute `node scripts/report-trial-review.mjs` from the Earth-2036 checkout. It reads the committed baseline manifest, runtime state, and all `data/runtime/ticks/*.json` files, validates the complete tick sequence and prints a SHA-256-fingerprinted read-only assessment. The script does not mutate canonical state, publish rankings or qualify ticks. It exits nonzero for corrupt/mismatched history.

A trial review report declares `captureComplete` only after all 1,000 immutable tick receipts, matching counters, and the `trial_complete_awaiting_review` phase agree. Trajectory v1.2 currently contains **observation horizons 12, 24, 36, 60 months** and **modelsEnabled=false / forecastsEnabled=false**. Consequently the requested 24h/72h/7d/15d/21d/28d forecast performance is marked `not_available` and `evaluatedPredictions:0`, not fabricated. Even 1,000 captured hours do not establish mature future outcomes.

This is a first read-only review receipt, not production-ready automatic completion delivery or a substantive calibration engine. Separate P11 work must design verifiable forecast and observed outcomes with no look-ahead, and separate launch certification must prove the exact-head CI, safe finalizer crash replay, and watchdog behavior before merge.
