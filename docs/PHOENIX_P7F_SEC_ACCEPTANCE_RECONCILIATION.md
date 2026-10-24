# Phoenix P7F — SEC acceptance-time reconciliation, primary sources vs submissions

**Date:** 2026-10-18. **Mode:** evidence-only, fail-closed; no source admission, scores, T0 publication or worker restart. Historical cutoff `2026-09-12T23:59:59-04:00`.

## Independently verified result

The read-only [Actions run 39132331295](https://github.com/JILLOnline/Earth-2036/actions/runs/39132331295) produced `sec-acceptance-reconciliation.json` after independently retrieving the official SEC filing-detail pages and comparing their displayed acceptance time with the separate original SGML header already captured by the P7D primary-filing pilot. Its entire SHA-256-backed artifact was downloaded and examined.

**6/6 official SEC filing-detail pages exactly match their corresponding original SGML header acceptance clocks.** All were accepted well before the fixed 2026-09-12 cutoff. **3/6 submissions-JSON acceptedAt strings disagree when interpreted as UTC; all three disagreements belong to SWKS.**

| Issuer / SEC accession | SGML acceptance clock (SEC local Eastern) | SEC filing-detail display | Raw SEC submissions ISO value | Outcome |
| --- | --- | --- | --- | --- |
| AEVA [0001193125-26-338179](https://www.sec.gov/Archives/edgar/data/1789029/000119312526338179/0001193125-26-338179-index.html) | 2026-08-06 16:27:05 | Same | 2026-08-06T20:27:05.000Z | Primary agreement; feed agrees |
| AEVA [0001193125-26-116518](https://www.sec.gov/Archives/edgar/data/1789029/000119312526116518/0001193125-26-116518-index.html) | 2026-03-19 21:55:26 | Same | 2026-03-20T01:55:26.000Z | Primary agreement; feed agrees |
| AEVA [0001193125-22-123626](https://www.sec.gov/Archives/edgar/data/1789029/000119312522123626/0001193125-22-123626-index.html) | 2022-04-27 16:13:18 | Same | 2022-04-27T20:13:18.000Z | Primary agreement; feed agrees |
| SWKS [0000004127-26-000049](https://www.sec.gov/Archives/edgar/data/4127/000000412726000049/0000004127-26-000049-index.html) | 2026-07-28 16:48:13 | Same | 2026-07-29T00:48:13.000Z | Primary agreement; submissions drift |
| SWKS [0000004127-25-000085](https://www.sec.gov/Archives/edgar/data/4127/000000412725000085/0000004127-25-000085-index.html) | 2025-11-07 16:08:12 | Same | 2025-11-08T02:08:12.000Z | Primary agreement; submissions drift |
| SWKS [0000004127-26-000003](https://www.sec.gov/Archives/edgar/data/4127/000000412726000003/0000004127-26-000003-index.html) | 2026-01-30 16:06:48 | Same | 2026-01-31T02:06:48.000Z | Primary agreement; submissions drift |

**Method:** Parse official SEC detail `Accepted` clock as printed; separately parse original SEC SGML `<ACCEPTANCE-DATETIME>`; compare raw local SEC clocks. Interpret the submissions `Z` timestamp via `America/New_York` solely to detect inconsistency. Do **not** patch, round or reinterpret the original submissions JSON or infer a universal fixed offset. The SEC Webmaster FAQ identifies original SGML acceptance date/time and explicitly states that no exact first-publication timestamp is available on sec.gov.

Full index-page SHA-256 digests for reproduction (in issuer / accession order above):

```text
AEVA 0001193125-26-338179 de246b24d84c5c0674165a4d56e9b895dfc70e490dd8cbe0054e6c3fb1e53270
AEVA 0001193125-26-116518 0e714610bf27cf54ea887b12fa0cc2df38f962799ee54c9b933ae5ceaf3ff2a3
AEVA 0001193125-22-123626 35afd304616e60a3738b5238e0531f209940bc42e325c77ff16b3780879acffe
SWKS 0000004127-26-000049 12408b95d58a47b32426edc941351ef7f66c39fb607ee9d638d97d283e8ca825
SWKS 0000004127-25-000085 324e993e76eaa46cfd96e9a517666a7fa1df9a610e428b80c637eb60a3a7e755
SWKS 0000004127-26-000003 2a37eb3f6de9cfb4e88a722e561be74b879a3a5a4f4e4264207db5c1c57d3978
```

## What this does and does NOT permit

The original SEC header and independently retrieved filing detail now **corroborate acceptance time** for all six filings. The three SWKS raw feed timestamps are identified as *conflicting metadata* rather than blindly used for precise trading-close tests. This is supported by publicly reported investigations into `data.sec.gov` `acceptanceDateTime` timezone inconsistencies, but our own diagnosis rests on the **two primary SEC surfaces**.

**Unresolved:** exact first-publication instant, full amendments' effects on source fact lineage, T0 specialist signoff and the AEVA/SWKS factor evidence gates. The derived acceptance evidence is **not a first-public availability attestation**. The machine receipt strictly retains `originalFirstPublicAvailabilityAuthenticated:false` and `historicalT0EvidenceAdmitted:0`.

Read-only workflow script: `scripts/phoenix-sec-acceptance-reconcile.mjs`, with explicit SWKS/AEVA regression tests. No canonical runtime files altered.
