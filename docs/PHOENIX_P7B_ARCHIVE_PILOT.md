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
