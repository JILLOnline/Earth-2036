# Phoenix P7J — AEVA September 2026 issuer capitalization and RSU evidence boundary

**Status:** independent source-backed reconciliation **completed for dated Q2 balances and Sinha's reported holdings**. **September 12 fully diluted issuer capitalization remains unknown.** Historical cutoff `2026-09-12T23:59:59-04:00`, research-only and noncanonical.

## Original SEC source receipts

The read-only GitHub Actions [run 39135847207](https://github.com/JILLOnline/Earth-2036/actions/runs/39135847207) downloaded two official original issuer filings, independently recalculated their hashes, reconciled pre-cutoff owner Forms 4 already pinned in P7H, and wrote `aeva-rsu-capital-gap.json`, which was downloaded and examined.

| Source | Filing date | Original SEC document | SHA-256 |
| --- | --- | --- | --- |
| Q2 2026 Form 10-Q, accession `0001193125-26-338179` | Aug 6, 2026 | [Q2 financials and stockholders' equity](https://www.sec.gov/Archives/edgar/data/1789029/000119312526338179/aeva-20260630.htm) | `50a50d985259e53b3aa25eddcdc0fa1a654d724d8c079d7030261a43de7b0b35` |
| Form 8-K, accession `0001193125-26-335102` | Aug 5, 2026 | [CFO departure and interim appointment](https://www.sec.gov/Archives/edgar/data/1789029/000119312526335102/aeva-20260730.htm) | `b050086dad483b12be4c2bf5cccc7dafb70f3bb89a859d3236b92de7233708c0` |
| Form 4, accession `0001193125-26-359631` | Aug 20, 2026 | [Original XML sale / beneficial holdings](https://www.sec.gov/Archives/edgar/data/1789029/000119312526359631/ownership.xml) | `8fed58031bfcfc1a03ce1348da00477fe50a985c7e4c8c9c5b625ce5772a7411` |
| Form 4, accession `0001193125-26-383903` | Sep 4, 2026 | [Original XML RSU-tax sale / holdings](https://www.sec.gov/Archives/edgar/data/1789029/000119312526383903/ownership.xml) | `efabd3b407d3d0a1ee90e4bfe913f9e220e71e7ad495c1db5fba7d8597eec07f` |

All were published or SEC-accepted before the frozen historical T0 cutoff, but **first-public availability has not been independently timestamp-authenticated**. Retrievability today and accepted time are distinct claims.

## AEVA's exact issued-stock chronology, extracted from dated issuer statements

| Observation date | Reported shares outstanding | Source authority |
| --- | ---: | --- |
| Dec 31, 2025 | 61,580,151 | 2026 Q2 SEC stockholders' equity comparative |
| Mar 31, 2026 | 62,984,603 | Q1 SEC stockholders' equity balance |
| Jun 30, 2026 | **68,682,947** | Q2 SEC stockholders' equity balance |
| Jul 30, 2026 | **69,705,758** | 2026 Q2 issuer Form 10-Q cover |
| Sep 12, 2026 (T0 cutoff) | **unknown** | No issuer/transfer-agent source has established exact dated amount |

**Independent reconciliation:**
- Dec 31 to Mar 31: `+1,404,452` = **1,395,300 RSU-release shares** + **9,152 option-exercise shares**.
- Mar 31 to Jun 30: `+5,698,344` = **377,268 RSU-release shares** + **3,500 option-exercise shares** + **5,168,539 June offering shares** + **149,037 shares issued for convertible-note interest**.
- First-half RSU releases: **1,772,568**, exactly `1,395,300 + 377,268`. Do not use this to infer September RSU settlement.
- Jun 30 to Jul 30: **+1,022,811 shares** observed between two issuer-dated amounts; the Q2 statement does not allocate those later shares by issuance type.
- Jul 30 to Sep 12: **unknown change**. July figures must not be relabeled as September fully diluted or basic shares.

Previous sensitivity modeling stored a rounded June proxy of 68,683,000; the P7G input is corrected to the **exact original filing value 68,682,947**, with a cross-module regression test.

## RSU-tax sale and August CFO transition — related dates, not causality

Original SEC [August 5 Form 8-K Item 5.02](https://www.sec.gov/Archives/edgar/data/1789029/000119312526335102/aeva-20260730.htm) states Sinha **notified the company July 30** that he **planned to resign effective September 5, 2026**; it also disclosed interim CFO Rupesh Maheshwari's appointment effective that day. This authenticates the pre-cutoff *plan and appointment announcement*, not the actual completion of the departure or any vesting acceleration.

The original two SEC Form 4 statements show:

| Date | Reported sale | Direct beneficial shares after |
| --- | ---: | ---: |
| Aug 18 | 70,000 | 581,372 |
| Sep 2 | **34,146** | **547,226** |

The owner-level holdings difference `547,226 − 581,372 = −34,146` equals the September 2 reported sale amount. The September 2 footnote calls the sale nondiscretionary for tax withholding **upon settlement of time-based RSU awards**. This proves a dated sale and reported owner endpoint, **not** gross RSUs vested, issuer-issued shares, net shares newly issued, other intermediate beneficial-owner movements or the actual September common stock float. A causal inference that the CFO departure triggered RSU vesting is **unsupported** without the underlying award/separation terms and settlement ledger.

**Important distinction:** AEVA's 10-Q describes routine RSUs and PBRSUs with materially different conditions and June 30 balances. A Form 4 coded S is a sale, not stock-award vesting quantity; a Form 144 is a proposed notice and not an additional executed sale.

## Machine implementation and required closure evidence

- `scripts/phoenix-aeva-rsu-capital-gap.mjs` verifies both original issuer SEC documents and their SHA-256 receipts, independently reconciles the dated four issuer common-share balances, and requires exact two Sinha Form 4 source hashes, owner CIKs, reported post-transaction holdings and 34,146 reported September sale.
- `test/phoenix-aeva-rsu-capital-gap.test.mjs` fails for altered source leaves, changed owner transaction/hashes, altered access authority, inconsistent roll-forward inputs or a rounded June share count.
- Workflow `.github/workflows/phoenix-aeva-capital-bridge.yml` is contents:read only, publishes `aeva-rsu-capital-gap.json` alongside existing canonical-isolated research receipts, and **rejects any attempt to claim a September denominator or validated valuation score**.

**Still needed to close AEVA:** a source available on or before September 12, 2026 establishing actual basic shares and post-July 30 issuance/repurchases; dated RSU grants and settlement/transfer-agent records (especially September 2 gross and net releases); dated convertible and warrant exercise events; September 11 exchange-native Nasdaq NOCP/tape and corporate-action alignment; separate original economic valuation comparison; plus independent source-integrity and council contradiction dispositions.

No source evidence admitted, no `marketValuationOpportunity` score assigned, no canonical promotion, worker restart or trial activation. **T0 remains locked.**
