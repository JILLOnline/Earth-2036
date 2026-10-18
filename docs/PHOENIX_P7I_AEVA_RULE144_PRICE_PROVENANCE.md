# Phoenix P7I — AEVA original Form 144 / Form 4 overlap and price provenance

**Date reviewed:** October 18, 2026. **Operating mode:** READ-ONLY RESEARCH; no canonical evidence admission, score, worker restart or T0 promotion. Historical evidence cutoff: `2026-09-12T23:59:59-04:00`.

## SEC original ownership and proposed-sale documents

GitHub Actions read-only run [39134829782](https://github.com/JILLOnline/Earth-2036/actions/runs/39134829782) retrieved and parsed both SEC `primary_doc.xml` original Form 144 records, cross-referencing them against the previously verified and hashed five original Form 4 XML receipts. The complete machine-readable evidence is `aeva-rule144-overlap.json` in the GitHub Actions artifact, inspected separately after download.

| Filing | Reporting person | Form 144 approximate proposed sale | Original Form 4 executed sale | Original 144 SHA-256 |
| --- | --- | ---: | ---: | --- |
| [0001950047-26-007999](https://www.sec.gov/Archives/edgar/data/1789029/000195004726007999/primary_doc.xml) | Katherine Motlagh | 2,500 common shares, Aug 12 | [0001193125-26-352272](https://www.sec.gov/Archives/edgar/data/1789029/000119312526352272/ownership.xml), 2,500 common shares Aug 12 | `f7f70a111683ad0bdec2bae62bb2bcacae1bcf48589d96a9a8a697a9264fcb66` |
| [0001950047-26-008329](https://www.sec.gov/Archives/edgar/data/1789029/000195004726008329/primary_doc.xml) | Saurabh Sinha | 70,000 common shares, Aug 18 | [0001193125-26-359631](https://www.sec.gov/Archives/edgar/data/1789029/000119312526359631/ownership.xml), 70,000 common shares Aug 18 | `499091dec6f27e3da43eddcdbf5d056295c7fccd2cdb5a6d9874aaca9cf27e20` |

The original documents report *proposed* Rule 144 sales. Their matching original Form 4 transactions carry a concrete code `S`, direction `D`, same reporting-owner CIK, transaction date, and exact share amount. Therefore **72,500 proposed Rule 144 shares are overlapping disclosures of previously counted sales**; the Form 144 notices must **NOT** add 72,500 to the verified 511,745 common shares reported sold on the five Forms 4. No issuer share issuance, buyback, cancellation, market liquidity or forecast is inferred from this overlap.

Both filers separately reported **69,705,758 common shares outstanding**, the same denominator on the AEVA July 30 Form 10-Q cover. But Form 144 values are **reporting persons' source entries**, not a transfer-agent or issuer certification dated August 18, let alone September 12. The `filerReportedOutstandingSharesIssuerAuthenticated` and `shareCountAsOfCutoffAuthenticated` gates remain **false**.

### RSU ownership origin and September separation

- **Motlagh:** the August 12 notice identifies 2,500 restricted shares acquired from the issuer June 20, 2026. These were already issued or acquired before July 30; do not add them anew to the September denominator on the basis of their August sale.
- **Sinha August 18:** the Form 144 describes 70,000 shares acquired from the issuer as restricted-stock units, with vesting noted from March 12, 2025 through July 7, 2026. The notice separately recites three earlier July sales of **6,830**, **20,620**, and **11,212** common shares. Those past trades are informational and **must not** be double-counted as sales from the July 30–September 12 source window.
- **Sinha September 2:** a separate original Form 4 reports **34,146 shares sold to cover tax withholding upon settlement of time-based RSUs**. No Form 144 from the two selected notices establishes the gross number of shares vested on September 2, net newly issued shares, employee withholding accounting, or company-wide issued-share changes. Its relationship to the August notice cannot be inferred beyond shared beneficial ownership.

The operative open capital-denominator issue is the **gross RSU vesting / share issuance ledger** and other options, note conversion, warrants and transfers after the July 30 issuer share-count observation. No issuer transfer-agent ledger, later dated exact outstanding figure, or 2026-09-12 fully diluted capitalization is presently authenticated.

### Price provenance: contemporaneous corroboration, not exchange-native clearance

Several independent price-history datasets, including [Yahoo Finance](https://ca.finance.yahoo.com/quote/AEVA/history/), [Stock Analysis](https://stockanalysis.com/stocks/aeva/history/), and [ChartExchange](https://chartexchange.com/symbol/nasdaq-aeva/historical/), display **September 11, 2026 closing price $15.52**. A [GuruFocus market article posted September 11 at 18:18](https://www.gurufocus.com/news/9078337/a-look-at-aeva-technologies-inc-aeva-after-36-gain-gf-value-1627-vs-price-1552) likewise reported AEVA trading at $15.52 that day. This contemporaneous third-party article corroborates that the number was being reported on the date rather than solely calculated from later history; it still does **not** establish the precise exchange NOCP auction print, adjusted/unadjusted provenance, licensing, or reliable timestamp of ingestion.

Nasdaq publishes a [Historical NOCP page for AEVA](https://www.nasdaq.com/market-activity/stocks/aeva/historical-nocp), but its publicly rendered page currently reports no downloadable historical data; its [historical quote page](https://www.nasdaq.com/market-activity/stocks/aeva/historical) likewise did not expose price rows during this audit. AEVA's own [investor historical lookup](https://investors.aeva.com/stock-information/historical-price-lookup) displays LSEG-sourced adjusted closing prices for recent query defaults but did not establish the original September 11 tape or split-adjustment chain under our accessible public view.

**Decision:** the $15.52 price remains a *strong corroborated secondary-source historical quote candidate*, not a certified Nasdaq original closing-auction record. The P7G scenario bridge must keep `stockExchangePriceTapeAuthenticated:false`, `SeptemberCapitalizationAuthenticated:false` and `marketValuationOpportunity:null`.

## Machine and safeguards

- `scripts/phoenix-aeva-rule144-overlap.mjs` authenticates SEC issuer CIK `0001789029`, original filer CIKs `0001830952` and `0001849806`, both filing accessions, exact proposed dates and quantities, and original SHA-256 payloads before matching Form 4 owner IDs, code `S`, direction `D`, execution dates and quantities.
- Pinned original Form 144 SHA-256 digests are independently checked on retrieval; Form 4 original hashes are also checked when correlating.
- `test/phoenix-aeva-rule144-overlap.test.mjs` covers unique matches, wrong issuer, wrong share count, wrong owner identity, spoofed SEC XML, attempted bypasses of pinned source hashes and unverified canonical authority.
- Read-only `.github/workflows/phoenix-aeva-capital-bridge.yml` requires two original Form 144 files, two exact Form 4 matches, and **72,500 avoided duplicate shares**, while retaining `historicalT0EvidenceAdmitted=0`.

**Immediate next action for AEVA closure:** obtain issuer or transfer-agent outstanding-share/RSU-settlement disclosures effective as of September 12, confirm Nasdaq September 11 NOCP through an exchange-native data record, then have Council Alpha and independent source-integrity specialists review the valuation factor's verified terms and material contradictions. Without these, T0 stays locked.
