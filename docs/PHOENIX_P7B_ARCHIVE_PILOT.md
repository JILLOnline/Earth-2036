# Phoenix P7B / P7C — authenticated cached SEC sources and acceptance triage

**Operational status:** read-only, noncanonical. Archived source bytes and acceptance metadata verified; **T0 source admission and worker restart remain forbidden**. Original T0 cutoff is exactly `2026-09-12T23:59:59-04:00`.

## Verified release and source paths

Immutable release tag: `fundamentals-cache-20261017T050818Z-39004369528`.

- Compressed archive: 243,735,107 bytes, SHA-256 `6379596d013d554ca20264b5c3806bd528837934eeed492c6fff51f5705a5ae2`.
- Original release-time `bridge/cache-manifest.json` SHA-256 `636c181daac0ba08272fc2fe019610975fa0fe882f137f7fbada34b6ee79cf9a`.
- The manifest stores `companies[TICKER].archivePath` as `source/<CIK>/<full SEC Company Facts payload hash>.json`, **not** the live bridge's distinct `sourcePayloadHash`, which includes the PIT cutoff.
- Live bridge health recomputes its `archiveManifestSha256` when incrementally rebuilding the source cache, even if the release asset stays fixed. Comparing the immutable asset against the later mutable manifest hash caused a false mismatch; the pilot explicitly pins the release-time manifest digest instead.
- Original archived full source payload hashes and point-in-time bridge hashes are verified separately. Both AEVA and SWKS matched their live references at the inspection snapshot `2026-10-17T19:20:35.999Z`.

## Actual GitHub Actions evidence — October 18, 2026

Read-only archive run `39091220054`: compressed asset, release manifest, AEVA and SWKS original cached SEC Company Facts source payload hashes verified.

Read-only acceptance run `39091575815`: SEC `data.sec.gov/submissions/CIK*.json` (including historical submissions file pages) independently cross-checked all candidate accession IDs. **AEVA 31/31, SWKS 77/77** had precise SEC acceptance timestamps at or before the frozen historical T0 cutoff. Zero accession metadata mismatches or accepted-after-cutoff outcomes were observed.

Filing-date-filtered cached facts: AEVA **7,969** across 31 distinct accessions; SWKS **21,646** across 77; total **29,615** candidates across **108** accession records. These are not 29,615 authorized facts: the distinction between a date-filtered Company Facts source inventory and historical admissibility is essential.

The workflow retains the full archive and SEC-acceptance JSON reports as short-lived GitHub Actions artifacts. Its token is contents:read; it has no ability to write canonical files, scores, promotion receipts, or restart workforce tasks.

## Still unverified — keep the gate CLOSED

- Independently authenticate original EDGAR *primary filing bytes* and accession-level document identities, not just cached Company Facts or submissions metadata.
- Independently verify the original filings were **publicly available at or before** the cutoff. An SEC acceptance timestamp alone is insufficient to certify that.
- Review amendments, supersessions and any contradictory filing evidence as of T0.
- Map specific eligible original primary filings to the exact missing Methodology 1.0 source/financial leaves with an independent source-integrity perspective.
- Resolve worker availability/safety holds and stalled Alpha/Beta/Scout work by verified changed inputs. Never retry a rejected evidence payload or re-enable workers merely because source data exists.
- Keep `historicalT0EvidenceAdmitted=0`, `canonicalWriteAuthority=false`, and `workerRestartAuthorized=false` in both audit reports.

## Reproduce the read-only checks

```bash
gh release download fundamentals-cache-20261017T050818Z-39004369528 --repo JILLOnline/Earth-2036 --pattern bridge-cache.tar.gz --dir /tmp/phoenix-p7b
node scripts/phoenix-archive-pilot.mjs /tmp/phoenix-p7b/bridge-cache.tar.gz > /tmp/phoenix-p7b/archive-report.json
SEC_USER_AGENT="JILLOnline Earth2036 info@jillonlinestore.com" node scripts/phoenix-sec-acceptance-audit.mjs /tmp/phoenix-p7b/archive-report.json > /tmp/phoenix-p7b/sec-acceptance-report.json
```

The runnable GitHub Actions form is `.github/workflows/phoenix-p7b-sec-archive-pilot.yml`. It is deliberately read-only and isolated from T0 ranking/publication.

## Phoenix P7D — Six original EDGAR document pilot (2026-10-18)

GitHub Actions read-only run [39128255744](https://github.com/JILLOnline/Earth-2036/actions/runs/39128255744) successfully retrieved **six live EDGAR primary documents** (max three per ticker: latest pre-cutoff 10-Q, 10-K, 10-K/A), recorded SHA-256/size for the retrieved bytes, and attempted original SGML header acceptance-time comparison. The complete unmodified receipt is `original-primary-report.json` in the `phoenix-p7b-sec-source-archive-readonly` job artifact.

| Ticker | Accession | Form | SEC primary document | SHA256 of retrieved document | SGML header vs SEC submissions |
| --- | --- | --- | --- | --- | --- |
| AEVA | 0001193125-26-338179 | 10-Q | aeva-20260630.htm | 50a50d985259… | matches |
| AEVA | 0001193125-26-116518 | 10-K | aeva-20251231.htm | c49e88aac523… | matches |
| AEVA | 0001193125-22-123626 | 10-K/A | d335011d10ka.htm | f441b6695a7c… | matches |
| SWKS | 0000004127-26-000049 | 10-Q | swks-20260703.htm | 643d8f161c6d… | **timestamp discrepancy** |
| SWKS | 0000004127-25-000085 | 10-K | swks-20251003.htm | 2a1c47edd880… | **timestamp discrepancy** |
| SWKS | 0000004127-26-000003 | 10-K/A | swks-20251003.htm | 95d9da9e38a9… | **timestamp discrepancy** |

*The digests are abbreviated above for readability. The machine-readable artifact retains full 64-character digests and source URLs.*

For SWKS, the raw SGML header acceptance local values are **20260728164813**, **20251107160812**, and **20260130160648**. These are respectively **4, 5, and 5 hours earlier** than the Eastern-time wall-clock values computed from the SEC submissions API's `acceptedAt` ISO timestamps. This disagreement has not been reconciled. Do **not** silently apply a timezone offset or treat the reported SEC submissions time as an independent SGML attestation.

The SEC explicitly states there is *no timestamp recording when filing content first became available on sec.gov* (see SEC Webmaster FAQ and Accessing EDGAR Data). Thus successful retrieval in October 2026 is evidence of **availability now**, not independent proof of the historical first-public timestamp. The initial P7D pilot does not attest T0 public availability, review amendment supersession, underwrite companies, or promote source facts.

**Next lawful closure dependencies:** independently resolve SWKS header/API discrepancy and original-publication timeline; map AEVA's missing `marketValuationOpportunity` input to defensible source-addressed and date-eligible denominator/price/debt/cash evidence; review its material contradictory claims; fill SWKS missing factor/risk/causal/confidence evidence. Worker restarts are subject to the separately recorded rejected-write safety hold. Canonical T0 progress remains untouched.

## P7D dated SEC master-index provenance — reconciled 2026-10-18

**Verified run:** [39131088322](https://github.com/JILLOnline/Earth-2036/actions/runs/39131088322), source and exact-commit tests. The `daily-index-report.json` artifact was independently downloaded and examined. **Six out of six selected filings have exactly one independently matching row** in the dated SEC EDGAR daily master index. Each matching row corroborates the registrant CIK, SEC form, compact `YYYYMMDD` filing date, and original accession `.txt` archive path:

| Ticker | Form | Accession | Index filing date | Matching rows |
| --- | --- | --- | --- | --- |
| AEVA | 10-Q | 0001193125-26-338179 | 20260806 | 1 |
| AEVA | 10-K | 0001193125-26-116518 | 20260320 | 1 |
| AEVA | 10-K/A | 0001193125-22-123626 | 20220427 | 1 |
| SWKS | 10-Q | 0000004127-26-000049 | 20260728 | 1 |
| SWKS | 10-K | 0000004127-25-000085 | 20251107 | 1 |
| SWKS | 10-K/A | 0000004127-26-000003 | 20260130 | 1 |

**Bug fixed:** SEC master index uses the exact `YYYYMMDD` representation, whereas the SEC submissions ledger uses ISO `YYYY-MM-DD`; the initial parser rejected six otherwise correct records. The regression test now checks the compact source format and refuses mismatched dates/forms, duplicate rows, and unexpected paths. Index hashes and original matching row fields remain in the run artifact.

**Trust boundary:** a presently accessible, date-labeled SEC index corroborates historical filing placement, but cannot alone cryptographically attest the original publication instant. The three SWKS SGML-vs-submissions time discrepancies remain unmodified and unresolved. The six documents represent a bounded **pilot**, not a complete amendment/supersession review of 108 historical accessions. All reports retain `historicalT0EvidenceAdmitted=0`.

**Immediate underwriting targets:** AEVA remains short one source-addressable `marketValuationOpportunity` Methodology 1.0 factor, plus a source-integrity perspective and material contradiction resolution. Do not derive diluted enterprise valuation from an obsolete share count; it still needs an as-of-cutoff defensible price, current basic/fully diluted denominator, convertible/warrant effects and debt/cash reconciliation. SWKS lacks all twelve source-addressed factor values plus multiple missing specialist perspectives, and is not ready for scoreRecord or chief promotion. Historical research must be directly coupled to these exact failures rather than treating archive volume as progress.
