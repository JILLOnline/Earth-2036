# Phoenix P7G — AEVA settlement scenario and valuation-source reconciliation

**State:** read-only, noncanonical, no `marketValuationOpportunity` factor, no Earth Score, no chief or canonical promotion. Original T0 source cutoff `2026-09-12T23:59:59-04:00`.

## Verified source anchors and code

- Original issuer [June 2026 Form 10-Q](https://www.sec.gov/Archives/edgar/data/1789029/000119312526338179/aeva-20260630.htm), accession `0001193125-26-338179`, filed Aug 6, 2026; primary-document SHA-256 from read-only EDGAR verification: `50a50d985259e53b3aa25eddcdc0fa1a654d724d8c079d7030261a43de7b0b35`.
- Common stock issued and outstanding **69,705,758 on July 30, 2026** (10-Q cover); June 30 basic common count **68.683 million, reported in thousands**. These observations are not September 12 fully diluted share counts.
- June 30 cash and cash equivalents **$43.235m**; marketable securities **$134.654m**; liquidity subtotal **$177.889m**. Conversion should not be approximated by treating all invested securities as unrestricted cash without reconciliation.
- Convertible notes June 30 **$100m principal**, **$96.896m net accounting carrying value**, **$192.843m disclosed fair value**; **6,303,480** shares appear in the EPS-excluded potential-common-share table. These are alternative debt/equity measurements—not additive liabilities.
- Series A warrants **3,000,000 at $5 exercise**; **$73.961m** fair-value warrant liability on June 30. Hypothetical full exercise yields **$15m new cash** and 3m new shares, while actual liability settlement and outstanding status at September 12 remain unverified.
- Other EPS-excluded potential shares: **2,303,765 stock options**, **7,286,827 RSUs**, **1,695,156 performance RSUs**. Together with note and warrant shares, these reconcile exactly to **20,589,228** excluded potential shares. This aggregate is **not** a ready-to-use diluted equity denominator.
- Last regular market session before the Saturday cutoff was September 11. Historical secondary-market sources ([Stock Analysis](https://stockanalysis.com/stocks/aeva/history/) and [Yahoo Finance](https://ca.finance.yahoo.com/quote/AEVA/history/)) both report **$15.52 close**. No immutable primary Nasdaq close, split adjustment or timestamped exchange-tape receipt has been authenticated; keep quote unadmitted.

## Alternative paths with settlement accounting coupled

The following values are **mixed-date, conditional reference cases**, not issuer capital market values, fair values, T0-eligible enterprise valuations, buy recommendations or a Methodology 1.0 score. Price is held constant at a SECONDARY quote candidate $15.52; both hypothetical fully-converted note and fully-exercised warrant cases are assumed without evidence they were exercised or economic at that price.

| Convertible note | Series A warrants | Assumed shares | Static share × candidate price | Principal retained | Assumed warrant cash proceeds | Unadjusted mixed-date EV-like bridge |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| $100m principal outstanding | Unexercised | 69,705,758 | $1,081,833,364.16 | $100m | $0 | $1,003,944,364.16 |
| $100m principal outstanding | Hypothetically exercised | 72,705,758 | $1,128,393,364.16 | $100m | $15m | $1,035,504,364.16 |
| Hypothetically converted in full | Unexercised | 76,009,238 | $1,179,663,373.76 | $0 | $0 | $1,001,774,373.76 |
| Hypothetically converted in full | Hypothetically exercised | 79,009,238 | $1,226,223,373.76 | $0 | $15m | $1,033,334,373.76 |

Formula: `candidate price × assumed common shares + retained note principal − (June 30 liquidity + hypothetical warrant cash)`. Do **not** add the $96.896m carrying debt, $192.843m note fair value, and $73.961m warrant fair value again to these figures. The EV-like bridge also omits non-note debts/lease liabilities, current cash burn, stock-based award exercise proceeds, and any unrelated capitalization events. Therefore all four numeric bridge figures are **ineligible as a validated September enterprise value**.

### Reproducible audit

- Logic: `scripts/lib/phoenix-aeva-valuation-bridge.mjs`.
- Read-only reporter: `node scripts/phoenix-aeva-valuation-reference.mjs`.
- Unit tests: `test/phoenix-aeva-valuation-bridge.test.mjs` enforce fixed historical cutoff, exact input snapshot and secondary quote identities, four non-overlapping settlement paths, cash proceeds, note-principal removal, EPS dilution decomposition and no qualification/promotion.
- GitHub workflow: `.github/workflows/phoenix-aeva-capital-bridge.yml`. Isolated research only, `contents:read`, outputs `aeva-valuation-reference.json` for review; **no SEC original-source files or canonical state modified**.

## Remaining gating gaps to close AEVA

1. Authenticate the last regular-session September 11 primary Nasdaq exchange tape and precise share-class/corporate-action identity.
2. Build a **dated August 1–September 12 original SEC filings and transfer-agent/issuer capital events reconciliation**, including RSU vesting, notes settled in stock, shares issued/exercised and remaining in-the-money warrants. Insider Forms 4 can show holder transactions, but must not automatically be classified as newly issued shares.
3. Authenticate September 12 note and warrant contract terms, settlement mechanics and liabilities; check 2025 convertible issue terms against a price lower than the stated June quarter model input; never treat hypothetical conversion as economically certain.
4. Obtain cutoff-aligned liquid assets and debt; no extrapolation from $57.015m six-month historical operating cash burn without source-supported reconciliation.
5. Identify an original, time-eligible forward economic valuation benchmark to score `marketValuationOpportunity` defensibly; current issuer disclosures lack contracted volume, margin and timing sufficient for fabricated EV/revenue or discounted cash flow output.
6. Require Council Alpha source-integrity signoff, independent Deep Resolver material contradiction dispositions, and a complete source-addressed Methodology 1.0 scoring record.

**Stop condition:** the research bridge may never mark `historicalT0EvidenceAdmitted`, `methodologyFactorSatisfied`, `chiefReadyAuthorized`, `canonicalPromotionAuthorized`, or `workerRestartAuthorized` true. The real Workgraph remains unmodified.
