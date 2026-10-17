# Phoenix P7B — CI drift diagnosis (no gate override)

The documentation-only initial PR #76 commit ran the engine invariants and failed nine P7A tests with `phoenix_p7a_source_or_historical_cutoff_unverified`. This is not a proof of compromised source bytes.

On PR branch snapshot: `fundamentals-bridge-index.json.asOf = 2026-10-17T19:20:35.999Z`, while `company-observations.json.capturedAt = 2026-10-17T20:22:48.824Z` and `system-state.json.lastCycleAt = 2026-10-17T20:22:48.824Z`. P7A requires **all three timestamps equal** (`health.asOf===index.asOf`, `observations.capturedAt===index.asOf`, `systemState.lastCycleAt===index.asOf`), so the machine advancing to a later normal cycle while the archive remained unchanged causes deterministic P7A fail-closed rejection. This is **source/observation cycle skew**, not proven SEC reference corruption. Do not pretend the source was refreshed or rewrite its as-of timestamp.

Correct follow-up should separate immutable source-descriptor integrity and issuer CIK matching from runtime observation freshness, recording `sourceCycle` and `runtimeCycle` distinctly. A later runtime cycle should become a noncanonical `source_stale_relative_to_runtime` status, **not** proof of fresh source or historical eligibility. Any actual CIK mismatch, descriptor hash failure, absent archive hash, missing accession/acceptance attestation or timeline contradiction still fails closed. A revision needs purpose-built asynchronous-cycle regression tests and a successful full CI before merging.

The P7B acceptance precheck is intentionally separate; it does not grant evidence admission, worker clearance, or Chief authority. No original archived bytes have been independently authenticated in this PR.
