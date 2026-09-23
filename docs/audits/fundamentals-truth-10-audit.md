# Fundamentals Truth #10 — Adversarial Audit

Audit target: merged Raw Fundamentals Truth Layer v1 (`d41cc955`).

## Final result

The original #10 implementation was directionally sound but the promised post-merge audit had not been completed before later Trajectory foundation work began. A first concurrent hardening pass landed on `main` as `5128c721`; this second pass re-audited that patch against the full requested matrix and closes the remaining gaps.

**Disposition: PASS — audited lab foundation merged to main as `fd22509b75d5b1ff200b03b323bfa42ede5584d6`. Fundamentals remains disconnected from Trajectory training.**

## Defects found and repaired

1. **Historical payload growth could change historical identity**
   - Original: full current Company Facts payload participated in the source/truth hash.
   - First pass: separated the retrieved payload hash from a point-in-time source hash.
   - Final: PIT source identity is CIK + cutoff + PIT taxonomy set + eligible raw-fact hash/count only. Future filings, entity renames, or current payload growth cannot rewrite historical truth identity.

2. **Human convenience projections participated in `truthHash`**
   - Original/first pass: `normalizedProjection` still lived inside the top-level truth core.
   - Final: raw PIT `truthHash`, `projectionHash`, raw context-view hash, and full `recordHash` are independent integrity planes. Changing the metric map cannot mutate raw truth identity.

3. **Untimestamped concept metadata leaked into learner-authoritative truth**
   - Original/first pass copied Company Facts concept `label` / `description` into every raw fact.
   - Final: learner raw facts contain only the point-in-time fields in the contract. Labels/descriptions are excluded because they do not carry their own filing-time version.

4. **Same-day accession ordering was unknowable**
   - Fixed in first pass and preserved: all facts from the latest eligible filing date remain current. Conflicting same-day facts become ambiguous; no lexical accession ordering is treated as time.

5. **Duplicate contexts could become false supersession**
   - Fixed in first pass and preserved: facts sharing the latest filing date remain current. Exact duplicates dedupe; duplicate-value contexts can resolve; conflicts remain ambiguous.

6. **6-K could silently substitute for periodic fundamentals**
   - Fixed in first pass and preserved: 6-K/6-K-A stay in raw truth but are excluded from normalized periodic fundamentals.

7. **Transition reports were not modeled explicitly**
   - Final: 10-KT/10-QT and amendments are accepted by the convenience projection but classified as `transition`, never silently annual or quarterly.

8. **CIK mismatch could mislabel another filer**
   - Fixed in first pass and preserved: requested vs SEC payload CIK mismatch fails closed.

9. **PIT taxonomy metadata could include future-only namespaces**
   - Final: `sourceTaxonomies` is derived only from eligible raw facts at the cutoff, not from the current full payload.

10. **Lab persistence overwrote history**
    - Original/first pass wrote `<ticker>.json`.
    - Final: snapshots are immutable and content-addressed as `ticker/asOf/truthHash.json`; an existing snapshot is reused, never overwritten.

## Audit matrix

| Area | Status | Enforcement |
| --- | --- | --- |
| Future leakage | PASS | future facts excluded; historical truth/hash invariant to future payload growth and metadata drift |
| Same-day availability | PASS | filed-date facts unavailable until UTC day end |
| Same-day conflicts | PASS | retain all latest-day versions; conflicting values = ambiguous |
| Amendments/restatements | PASS | strictly later filed dates supersede; all historical versions preserved |
| Duplicate contexts | PASS | deterministic dedupe + no false same-day supersession |
| Foreign issuers | PASS | IFRS/20-F fixture; ASML + NVO live canaries |
| 6-K behavior | PASS | raw preserved, normalized periodic substitution forbidden |
| Taxonomy gaps/drift | PASS | no restrictive allowlist; PIT-eligible non-custom namespaces preserved |
| Banking/insurance peculiarities | PASS | sector-specific facts remain raw even if convenience revenue metric is missing |
| REIT coverage | LIVE CANARY | AMT added |
| Weird fiscal calendars | PASS | 53-week annual fixture |
| Transition filings | PASS | 10-KT/10-QT separated into transition class |
| Units/currencies | PASS | no silent conversion; multi-unit latest period becomes ambiguous |
| Historical reconstruction | PASS | before/after amendment snapshots reconstruct from cutoff lawfully |
| CIK identity | PASS | mismatch fails closed |
| Raw hash tampering | PASS | raw hash, PIT source hash, truth hash and record hash independently checked |
| Projection tampering | PASS | projection/record invalidated without changing raw truth identity |
| Derived-view tampering | PASS | context-view/record invalidated without changing raw fact identity |
| Storage immutability | PASS | content-addressed write-once snapshots |
| Governance isolation | PASS | no Earth Score/rank/Workgraph authority; no Fundamentals→Trajectory training wiring |

## Validation surface

The dedicated fundamentals suite now contains **30 invariants**.

The live branch canary covers:
- ETN — industrial / US GAAP
- AAPL — non-calendar fiscal cadence
- ASML — foreign issuer / IFRS
- AMT — REIT
- NVO — foreign issuer / IFRS

It also rebuilds AAPL and ASML at a fixed `2025-12-31T23:59:59.999Z` cutoff from the current Company Facts payload to detect historical reconstruction drift.

## Explicit limitations

1. Company Facts is an entity-wide aggregation of facts from non-custom taxonomies. Issuer extension-only concepts are absent from this layer and therefore remain unknown.
2. Fact records expose filing date, not the exact acceptance timestamp used for intraday point-in-time ordering. This layer deliberately delays same-day facts until UTC day end. Exact intraday truth would require a separate accession-level acceptance-time source.
3. The named metric map remains intentionally incomplete for specialized sectors. That is acceptable because `learningAuthority:false`; raw eligible facts are the authority.
4. Storage scale/compaction is an engineering optimization, not permission to discard history. Any future compact representation must preserve reconstructability and hashes.
5. This audit does **not** authorize Fundamentals to train Trajectory, alter rankings, gate Workgraph promotion, or write canonical state.

## Sequence-control finding

Trajectory foundation work exists after #10 even though the original instruction was to stop before the audit. That sequencing rule was violated. The current Trajectory feature path is separate from Fundamentals Truth, so the #10 defects were not silently imported into Fundamentals-based training because that connection was never made. No new connection is introduced here.

## Exit gate — satisfied

Final validation before and after merge:

- dedicated 30-invariant Fundamentals Truth suite: **PASS**
- expanded live SEC current canary: **PASS, 5/5 companies, 0 validation failures**
  - ETN: 19,511 raw facts / 9,754 current-context facts / 8 named metrics observed
  - AAPL: 25,135 / 12,458 / 10
  - ASML: 11,381 / 5,804 / 10
  - AMT: 32,664 / 17,657 / 9
  - NVO: 4,216 / 1,998 / 7
- fixed-cutoff historical reconstruction canary at 2025-12-31: **PASS, AAPL + ASML, 0 validation failures**
- dependency audit: **PASS**
- typecheck: **PASS**
- full engine invariants: **PASS**
- production build: **PASS**
- autonomous engine dry-run: **PASS**
- post-merge main CI on `fd22509b`: **PASS**
- Pages dispatch from verified main push: **PASS**

#10 is complete as the audited raw regulatory truth foundation. A later Fundamentals→Trajectory connection remains a separate governed change and is not authorized by this audit.
