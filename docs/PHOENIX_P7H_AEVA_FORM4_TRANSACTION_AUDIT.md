# Phoenix P7H — AEVA original Form 4 share-movement audit

**Research status:** transaction identification complete for the **five Forms 4** in the original SEC issuer-window inventory (July 30–September 12, 2026). **September 12 issuer shares outstanding still NOT authenticated.** Fixed historical T0 cutoff is `2026-09-12T23:59:59-04:00`.

## Independent machine evidence

The read-only [GitHub Actions run 39134091160](https://github.com/JILLOnline/Earth-2036/actions/runs/39134091160) retrieved original raw `ownership.xml` documents from official EDGAR accession directories and parsed issuer CIK, reporting-owner CIK, security, transaction date, share counts, acquisition/disposition direction, transaction code, and footnote text. The SEC company submissions feed references the XSL-rendered path `xslF345X06/ownership.xml`; the archive's original unstyled `ownership.xml` was fetched and SHA-256 pinned separately. The downloaded, machine-readable `aeva-original-form4.json` audit receipt records all original source hashes and original XML transaction detail.

The five source documents contained **14 non-derivative common-stock transactions, every one coded S (sale) and D (disposition), totaling 511,745 shares reported sold**. No Form 4 in this five-filing subset reports code M (exercise), A (award), F (tax withholding using delivered shares) or a derivative transaction. This classification is scoped to these filings only; it is not an assertion that no new AEVA shares were issued anywhere in the reporting period.

| Reporting person | SEC accession | Transaction dates | Code S rows | Reported shares sold | Verified SHA-256 of original XML |
| --- | --- | --- | ---: | ---: | --- |
| Rezk Mina | [0001193125-26-347439](https://www.sec.gov/Archives/edgar/data/1789029/000119312526347439/ownership.xml) | Aug 10 | 3 | 100,000 | `630550f28193a85ca7095e9186d073cc941adbec6f440e9bf0052cec2de330c7` |
| Soroush Salehian Dardashti | [0001193125-26-347443](https://www.sec.gov/Archives/edgar/data/1789029/000119312526347443/ownership.xml) | Aug 10–11 | 8 | 305,099 | `15e523f42e8959b9ce638bdfd12da9f2f97aa68da709ac0bc1f6b7731c48f521` |
| Katherine Motlagh | [0001193125-26-352272](https://www.sec.gov/Archives/edgar/data/1789029/000119312526352272/ownership.xml) | Aug 12 | 1 | 2,500 | `5384536320a695109a08d55dd74cf7882c48768b509ab7cf91c1604b8aa5b5da` |
| Saurabh Sinha | [0001193125-26-359631](https://www.sec.gov/Archives/edgar/data/1789029/000119312526359631/ownership.xml) | Aug 18 | 1 | 70,000 | `8fed58031bfcfc1a03ce1348da00477fe50a985c7e4c8c9c5b625ce5772a7411` |
| Saurabh Sinha | [0001193125-26-383903](https://www.sec.gov/Archives/edgar/data/1789029/000119312526383903/ownership.xml) | Sep 2 | 1 | 34,146 | `efabd3b407d3d0a1ee90e4bfe913f9e220e71e7ad495c1db5fba7d8597eec07f` |
| **Total** | **5 original SEC documents** | | **14** | **511,745** | **All 5 verified and pinned** |

## Original footnotes and capital-issuance significance

- Rezk Mina: automatic trades under a previously adopted Rule 10b5-1 trading plan, including price bands; reported insider **sales**.
- Soroush Salehian Dardashti: automatic 10b5-1 sales with multiple weighted-average price bands.
- Katherine Motlagh: 2,500 reported sold; no explanatory footnote appears in the original XML.
- Saurabh Sinha Aug 18: automatic 10b5-1 share sales.
- **Saurabh Sinha Sep 2: issuer footnote explicitly says the 34,146-share sale covered tax withholding obligations when time-based RSU awards vested.** This warrants direct review of the RSU award settlement and any freshly issued stock. The sales row does *not* disclose the gross number of shares vested, the remaining shares delivered, or the total company-wide share issuance.

**Critical accounting rule:** 511,745 reported insider shares sold do **not** imply 511,745 fewer issuer shares outstanding. A sale is normally secondary ownership transfer; it is not a share cancellation or company repurchase by itself. Selling shares to pay taxes related to a vesting event may coincide with new stock issuance, but without original award/transfer-agent records it is not possible to quantify the net company denominator movement. Reporting owners' post-transaction holdings are NOT an issuer's outstanding common shares.

## Code, automation and source integrity

- `scripts/phoenix-aeva-form4-audit.mjs` checks the five exact accession identities, issuer and reporting-owner CIKs, raw SEC XML document type, transaction codes/quantities, and footnotes, with bounded source retrieval.
- `test/phoenix-aeva-form4-audit.test.mjs` verifies code classification, non-issuance guarantees, rejection of malformed transactions, forged issuer identity, other source paths, altered historical cutoff and missing files.
- The five raw source SHA-256 hashes above are pinned in `PINNED_ORIGINAL_FORM4_HASHES`. Any changed source bytes or missing/extra transaction rows block the workflow. The GitHub read-only `.github/workflows/phoenix-aeva-capital-bridge.yml` asserts **5/5 original XML, 14 sale transactions and 511,745 total reported sale shares** before uploading the receipt.
- All outputs retain `outstandingSharesAtT0Authenticated:false`, `issuerShareIssuanceAuthenticated:false`, `historicalT0EvidenceAdmitted:0`, `marketValuationOpportunity:null`, `canonicalWriteAuthority:false`, and no promotion or worker restart authorization.

## Remaining underwriting source gap

Prioritize the **Sep 2 RSU vesting event**: obtain the original vesting/settlement schedule and company-level stock-issuance ledger; reconcile other known RSU, option, note and warrant capital events through Sep 12. Audit the two Form 144 notices for proposed sale-versus-completed sale implications, while ensuring any duplicated Form 4 sale is not counted twice. Independently authenticate Sep 11 Nasdaq closing price against exchange-native price data (the $15.52 candidate currently comes from secondary providers) and check corporate actions before a cutoff-aligned diluted-capitalization and valuation-opportunity calculation.

**No source was admitted, no score computed, no canonical state changed.**
