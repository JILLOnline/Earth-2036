# Phoenix P7E — historical annual amendment lineage and issuer-stated scope

**Review date:** 2026-10-18. **Authority:** research-only, no canonical admission, scores, worker restarts, tick qualification, or early T0 publication. Fixed T0 cutoff: `2026-09-12T23:59:59-04:00`.

## Verified machine receipts

[Read-only Actions run 39131772346](https://github.com/JILLOnline/Earth-2036/actions/runs/39131772346) downloaded the immutable SEC source archive, reconstructed the historical candidate list, and inspected all **nine** pre-cutoff Form 10-K/A filings plus their original Form 10-K counterparts. Each of nine amendment families matched **exactly one** prior original 10-K with the **same SEC report period**. All **nine amendments and nine originals** were retrievable from official EDGAR primary-document URLs, with independently captured SHA-256 digests. Unmatched or multiple same-period originals fail closed in the corresponding test suite. The full, machine-readable 18-document fingerprints are in `amendment-family-report.json` in the named run artifact.

## Issuer-stated amendment scope, separately reviewed against original SEC notes

| Ticker | Period | Amendment accession | Original 10-K accession | Scope stated in primary SEC explanatory note |
| --- | --- | --- | --- | --- |
| AEVA | 2020-12-31 | [0001193125-21-179186](https://www.sec.gov/Archives/edgar/data/1789029/000119312521179186/d101883d10ka.htm) | 0001213900-21-014857 | **Historical financial statement restatement** — predecessor InterPrivate SPAC private warrants reclassified as derivative liabilities, with corresponding fair-value accounting effects; disclosure and control items also amended |
| AEVA | 2021-12-31 | [0001193125-22-123626](https://www.sec.gov/Archives/edgar/data/1789029/000119312522123626/d335011d10ka.htm) | 0000950170-22-002379 | Added Part III disclosures, revised Part IV Item 15 exhibits and new officer certifications; issuer states no other changes |
| SWKS | 2019-09-27 | [0000004127-20-000009](https://www.sec.gov/Archives/edgar/data/4127/000000412720000009/fy1910-kajanuary242020.htm) | 0000004127-19-000049 | Part III annual meeting/proxy disclosures only, per issuer |
| SWKS | 2020-10-02 | [0000004127-21-000015](https://www.sec.gov/Archives/edgar/data/4127/000000412721000015/swks-20201002.htm) | 0000004127-20-000058 | Part III disclosures only, per issuer |
| SWKS | 2021-10-01 | [0000004127-22-000002](https://www.sec.gov/Archives/edgar/data/4127/000000412722000002/swks-20211001.htm) | 0000004127-21-000058 | Part III disclosures only, per issuer |
| SWKS | 2022-09-30 | [0000004127-23-000005](https://www.sec.gov/Archives/edgar/data/4127/000000412723000005/swks-20220930.htm) | 0000004127-22-000038 | Part III disclosures only, per issuer |
| SWKS | 2023-09-29 | [0000004127-24-000002](https://www.sec.gov/Archives/edgar/data/4127/000000412724000002/swks-20230929.htm) | 0000004127-23-000030 | Part III disclosures only, per issuer |
| SWKS | 2024-09-27 | [0000004127-25-000006](https://www.sec.gov/Archives/edgar/data/4127/000000412725000006/swks-20240927.htm) | 0000004127-24-000131 | Part III disclosures only, per issuer |
| SWKS | 2025-10-03 | [0000004127-26-000003](https://www.sec.gov/Archives/edgar/data/4127/000000412726000003/swks-20251003.htm) | 0000004127-25-000085 | Part III disclosures only, per issuer |

The 2020 AEVA amendment is material to the **2020 predecessor-SPAC accounting record**, including 2020 quarterly disclosures the company expressly says it supersedes. **It does not by itself determine September 2026 market valuation, current diluted share count, or new production award economics.** Those require separate as-of-cutoff primary evidence.

SWKS's seven issuer explanations expressly identify Part III governance/annual-meeting disclosures as the reason for amendment and state they do not amend the remaining original information. This is a grounded **issuer-stated scope review**, not an independently quantified line-by-line financial restatement reconciliation; retain the original 10-Ks as source records, and read the paired Part III disclosures for governance factors.

## Reproducibility and noncanonical safety

The read-only source report `earth2036-phoenix-p7e-amendment-family-v1` records original and amendment full SHA-256 hashes, exact SEC report periods, accepted-at fields, and coarse text signals. **Keyword flags are not adjudication.** They remain explicitly `amendmentContentReviewComplete:false`, `supersessionDisposition:not_reviewed`, and `historicalT0EvidenceAdmitted:0` until a separate, authenticated source-integrity reviewer assesses and signs the affected statements and source lineage.

The SEC does not expose a reliable precise timestamp for **first publication of filing content**; EDGAR dated master indexes, SGML accepted times and original current retrievability do not individually prove historical first-public time. The separate SWKS submissions-JSON acceptance timestamp discrepancies also remain preserved; never silently mutate the original timestamps.

## Remaining pathway to a real company closure

1. Review AEVA's 2020 accounting restatement against the earlier periods' superseded facts; prevent the predecessor SPAC warrants from being conflated with its September 2026 active common-stock denominator.
2. AEVA Alpha must source a defensible **cutoff-dated price × diluted-capitalization denominator**, warrants/convertible treatment, net cash/debt and valuation comparison for `marketValuationOpportunity`. Its source-integrity perspective and material contradictions remain open.
3. SWKS Alpha and Beta must source-address missing Methodology 1.0 financial, risk, causal, confidence and specialist factors; seven Part III amendments provide governance evidence, not a substitute for full-company underwriting.
4. Preserve closed worker safety gates and rejected-write receipts until clearance is verified. No canonical company promotion, trial tick or worker restart is authorized by this report.
