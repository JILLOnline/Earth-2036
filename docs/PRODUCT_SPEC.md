# Earth 2036 — Product Spec v1.0

## Mission

Build an auditable research engine that continuously compares a concentrated Championship group against a broad, adaptive universe of public companies and an uncapped external discovery pool through 2036.

The system is designed to learn from evidence, preserve its mistakes, detect structural change early and avoid narrative lock-in.

## Canonical hierarchy

- **#1–10 — Championship Board**
- **#11–250 — Contenders**
- **Outside #250 — Discovery Pool / Challengers**
- **Top 5 — Monthly finalists**
- **Top 3 — Quarterly finalists**
- **Annual 12 — Annual candidate set**

No rank is protected. A newcomer can challenge the active universe whenever comparable evidence supports it.

## Official baseline rule

The initial 250 names are seeds, not official ranks.

The first official T0 may be published only when:

1. all 250 identities and current tradability are validated;
2. every company is mapped to a division and functional lane;
3. required primary-source coverage is present or explicitly marked unavailable;
4. every published score uses methodology `1.0.0`;
5. every ranked company meets the minimum data-confidence threshold;
6. all 250 are scored within the same comparable baseline window;
7. the discovery scan is completed for that window;
8. no placeholder forecast, market-cap case, score or rank is used.

Prototype v0.1 snapshots remain immutable history but are excluded from the official trial.

## 1,000-tick trial

After official T0, Earth 2036 requires **1,000 qualified full-universe observation ticks** before methodology 1.0 is treated as seasoned.

A qualified tick requires:

- 250 companies expected;
- 250 companies observed;
- source-coverage ratio >= 95%;
- discovery scan completed;
- methodology version `1.0.0` across the entire run;
- immutable score and rank snapshots;
- source-run health recorded.

A failed or partial scan is retained but does not increment the qualified-trial count.

Company observation age is independent of system age. New entrants never inherit prior history.

## Earth Score 1.0

Earth Score is long-horizon ownership quality, not a short-term price target.

Canonical component weights:

| Component | Weight |
| --- | ---: |
| Thesis Quality | 12% |
| Financial / Operating Momentum | 12% |
| Market / Valuation Opportunity | 8% |
| Catalyst Score | 6% |
| Governance & Power | 7% |
| 2036 Alignment | 12% |
| Cross-Division Leverage | 8% |
| Bottleneck Control | 10% |
| Scenario Robustness | 8% |
| Substitution Resilience | 7% |
| Supply-Chain Resilience | 5% |
| Pricing Power | 5% |

Data Confidence gates the weighted score. Risk is a separate penalty. Exact formulas and constants are owned only by `engine/methodology.ts` and `engine/scoring.ts`.

### Structural factors

**2036 Alignment** — how directly the company serves a durable need on the path to 2036.

**Cross-Division Leverage** — how many genuinely independent demand engines require the company's capability.

**Bottleneck Control** — whether scaling is constrained by something the company owns, produces, enables or controls.

**Scenario Robustness** — how many materially different plausible futures still create value for the company.

**Substitution Resilience** — resistance to cheaper technological or material substitutes.

**Supply-Chain Resilience** — exposure to geographic concentration, export controls, single-source inputs, long lead times and fragile processing chains.

**Pricing Power** — ability to capture scarcity or differentiated value instead of merely passing volume through.

## Opportunity Score

Opportunity Score is a separate short-horizon measure using catalyst proximity, estimate-revision momentum, operating acceleration, technical pressure, event asymmetry, data confidence and near-term risk.

Earth Score and Opportunity Score must never be combined into one opaque number.

## Ranking rules

Only publishable methodology-1.0 scores can enter the official ladder.

Tie-break order:

1. higher Earth Score;
2. higher Data Confidence;
3. lower Risk;
4. ticker alphabetically for deterministic final ordering.

The #10/#11 and #250/outside boundaries are explicit competitive boundaries.

Outside challengers are compared using a confidence-adjusted boundary score. Observation age is displayed but is not an artificial barrier to promotion.

## Evidence hierarchy

- **WOOD** — discovery / noisy signal
- **HAY** — contextual or corroborating signal
- **IRON** — hard operating evidence
- **GOLD** — durable multi-source thesis confirmation
- **DIAMOND** — exceptional cross-domain alignment; intentionally rare

Evidence can be promoted or demoted.

Source independence is mandatory. Ten articles repeating one SEC filing remain one underlying evidence event.

## Source priority

Default priority is:

1. regulatory filings / audited reporting / official legal records;
2. government and regulator datasets;
3. exchange and market-structure notices;
4. government procurement and awards;
5. patents, standards and peer-reviewed technical evidence;
6. company investor relations and customer disclosures;
7. recognized industry bodies;
8. high-quality financial / technical press;
9. community or social sources for discovery only until independently verified.

## Adaptive Universe 250

The active universe is capped at 250 for depth and comparability. Discovery is uncapped.

A company outside the universe may move through:

`unknown → discovered → probation → active Top 250 → contender → Championship`

A company may also move backward through outscoring, acquisition, delisting, thesis failure or loss of strategic relevance.

No removed company is deleted from history.

## Causal graph

Earth 2036 maps:

`COMPANY ↔ TECHNOLOGY ↔ RESOURCE ↔ INFRASTRUCTURE ↔ HUMAN NEED`

Supported relationships include:

- depends on;
- enables;
- supplies;
- substitutes for;
- competes with;
- benefits from;
- is threatened by;
- is constrained by;
- serves a human need.

Every material causal edge carries strength, confidence, methodology version, validity dates and source URLs.

The graph is used to identify first-order winners, second-order beneficiaries, substitution risks, scarce resources, bottlenecks and likely losers.

## Divisions

Current coverage includes:

- AI Compute / Interconnect
- AI Platforms / Software
- Semiconductors
- Semiconductors / Equipment
- Compute Hardware / Photonics
- Robotics / Autonomy
- Robotics / Autonomy / Mobility
- Power / Grid / Nuclear
- Power / Grid / Utilities
- Nuclear / Fuel
- Data Centers
- Digital Infrastructure
- Space / Defense
- Quantum
- Enabling Technologies
- Strategic Materials / Processing
- Energy Storage / Clean Power
- Cyber / Identity / Trust
- Water / Thermal / Resilience
- Biotech / Health / Longevity
- Communications / Connectivity
- Advanced Manufacturing / Industrial
- Agriculture / Bio Systems
- Financial / Digital Infrastructure
- Energy / Gas Infrastructure
- Human Platforms / Experience

Divisions are taxonomy, not quotas. They may evolve when new functions or bottlenecks emerge.

## Candidate profile

Eventually display:

- Earth Score and all components;
- Opportunity Score;
- Risk;
- evidence maturity;
- data confidence;
- observation age;
- rank and rank history;
- concise thesis / biggest risk / next catalyst;
- evidence feed;
- People & Power;
- management promise ledger;
- causal dependencies and substitutes;
- cross-division leverage;
- bottleneck control;
- scenario robustness;
- source coverage;
- forecast history and calibration.

## Forecast policy

Supported horizons:

`24h · 72h · 7d · 15d · 21d · 28d`

Forecasts are issued only from sourced data and retain the original reference price, confidence and later realized outcome.

No UI-derived or score-derived placeholder forecast is permitted.

## Historical integrity

Research ticks, methodology versions, evidence, ranks, forecasts, membership changes and discovery events are immutable historical records.

Metadata corrections must preserve an audit trail.

The system must be able to answer not only "what do we believe now?" but also "what did we believe then, based on what evidence, and were we right?"

## Privacy

Private/authenticated during development. Any future public transparency surface must be read-only and sourced from the same canonical history.
