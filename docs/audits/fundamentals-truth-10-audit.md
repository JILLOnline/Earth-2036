# Fundamentals Truth #10 — Adversarial Audit

Audit target: merged Raw Fundamentals Truth Layer v1 (`d41cc955`).

## Result

The original implementation was directionally sound but not yet safe to promote into Trajectory training. The audit found correctness issues in historical reconstruction and version resolution that required hardening.

## Findings fixed

1. **Historical source-hash future leakage / drift**
   - Before: `sourcePayloadHash` hashed the complete Company Facts payload retrieved today, including facts filed after the requested historical `asOf`.
   - Impact: rebuilding the same historical snapshot after a later filing could change `truthHash` even when the eligible historical fact set was identical.
   - Fix: `sourcePayloadHash` now hashes only filer identity, `asOf`, and the eligible point-in-time raw fact set. `retrievedPayloadHash` remains provenance-only and may change as SEC payloads grow.

2. **Same-day accession ordering was not knowable**
   - Before: same-context versions tied on filing date were broken by accession-number lexical order.
   - Impact: a same-day competing fact could be silently declared current/superseded without an acceptance timestamp.
   - Fix: all facts from the latest eligible filing date remain current. If they conflict, normalization becomes ambiguous/unknown.

3. **Duplicate facts in the same accession could be mislabeled as superseded**
   - Before: only one exact context winner survived, so frame/no-frame duplicates from one accession could be marked as historical supersession.
   - Fix: all facts from the latest filing date stay current; identical duplicates resolve mechanically, conflicting duplicates stay ambiguous.

4. **Foreign issuer 6-K normalization**
   - Before: 6-K/6-K-A were permitted in the normalized periodic form set.
   - Impact: event/current-report facts could silently stand in for periodic 20-F/40-F fundamentals.
   - Fix: 6-K remains fully available in raw truth but is excluded from normalized periodic fundamentals.

5. **Filer identity mismatch**
   - Before: a registry CIK could disagree with the SEC payload CIK without failing closed.
   - Fix: mismatched CIKs now throw before truth construction.

6. **Independent point-in-time source-hash validation**
   - The validator now recomputes the point-in-time source hash from the stored eligible facts and detects tampering separately from the overall truth hash.

## Added adversarial invariants

- same-day competing accessions remain ambiguous
- same-accession duplicate contexts are not false supersession
- historical truth hash is stable after future filings appear
- 6-K raw preservation without normalized substitution
- CIK mismatch fail-closed
- point-in-time source-hash tampering detection

## Governance

Trajectory remains disconnected. This audit does **not** grant canonical write authority, ranking authority, Workgraph authority, or training authority. Promotion remains a separate decision after CI and live canary validation.

## Still intentionally unknown / deferred

- Company Facts does not provide exact EDGAR acceptance timestamps in each fact record; same-day facts remain conservatively unavailable until UTC day end in this layer.
- Extension-only issuer concepts remain absent from Company Facts and therefore unknown here.
- Storage compaction is not part of this correctness patch. Raw truth remains authoritative; any future compaction must preserve immutable facts and hashes.
- Bank/insurer-specific convenience metrics are not added here; raw standardized facts are still preserved for later discovery.
