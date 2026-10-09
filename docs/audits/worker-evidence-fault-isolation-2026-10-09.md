# Earth 2036 — Worker Evidence Fault Isolation v1

**Release intent:** preserve hourly source observations when one worker evidence JSON file is malformed; reject that file from all research packets, keep fail-closed score/council/T0 decisions and provide an auditable repair target. Methodology 1.0 remains unchanged.

## Historical failure and existing controls

The September 29, 2026 [machine scheduler](https://github.com/JILLOnline/Earth-2036/actions/runs/36643025182) and [Workgraph reconcile](https://github.com/JILLOnline/Earth-2036/actions/runs/36646778870) both failed invariants on `VRTX-20260927T211225Z-council-alpha.json`. Prior repairs moved the strict all-evidence JSON check to CI and made `loadStructuredEvidence` skip malformed files. The new patch **does not remove those safeguards**; it makes the exclusion explicit, auditable and disqualifying.

## Quarantine mechanics

- Workgraph loads each evidence file atomically. A parse/normalization failure contributes **zero** packet rows from that file. A filesystem access failure is still fatal.
- The source Git file is retained unchanged; no delete, rename, auto-rewrite, or silent substitute occurs. The diagnostic report is noncanonical: `data/runtime/workgraph/evidence-quarantine.json` with source path, filename-derived ticker when known, SHA-256 of rejected raw bytes, and error class. Raw contents are not copied.
- If a quarantined artifact identifies an active, noncanonical company, its packet gets `invalid_worker_evidence_artifact`, `preflight.passed=false`, and a machine-owned integrity route. If filename provenance is ambiguous, all unfinished packets are held.
- All quarantine incidents raise Workgraph health attention. The command summary links the diagnosis and lists any *already-canonical* companies touched by rejected files.
- The deterministic finalizer requires a fresh matching quarantine inventory from the same cycle. If any file is quarantined, it skips official T0 publication and trial tick creation, with an explicit `HELD` result. The machine retains its real source observation and appends the historical observation normally.
- Full repository CI continues to run `test/evidence-json-integrity.test.mjs` and remains red for malformed source artifacts. The scheduler's smaller preflight does not require that strict all-worker-artifacts test before performing observations.

## Recovery process

1. Diagnose the exact invalid original Git file; keep its contents and hash as historical evidence.
2. Produce a separately reviewed and appropriately sourced correction or superseding record through authorized GitHub workflows. Do not bypass a rejected write, fake source lineage, or relax score integrity.
3. Reconcile Workgraph and inspect `evidence-quarantine.json` and each affected packet; re-run full CI and Beast validation.
4. Permit lawful promotion only after the quarantine is empty and all ordinary preflight gates pass.

**Important limitation:** This release isolates malformed on-disk worker evidence; it does not restore or diagnose ChatGPT task automations. Scout and Beta were disabled at this audit; causes require independent proof. Historical availability failures also include other sources of outages and are not all explained by the VRTX incident.

## Proof requirements

- Corrupted historical-style VRTX fixture excluded; SAFE company data continues loading.
- File remains intact with source hash in quarantine.
- VRTX packet cannot pass preflight even when other evidence is available.
- Unknown provenance holds candidate packets; canonical qualification never runs with nonempty quarantine.
- Full CI and autonomous engine dry-run pass with current valid data; a later injected bad file would keep full CI red while source observation lane remains independent.
