# Earth 2036

Auditable research system for finding U.S.-tradable companies positioned to matter through 2036.

## System v1.0

Earth 2036 maintains a **250-company active universe** plus an **unbounded external discovery pool**.

- #1–10 — Championship Board
- #11–250 — Contenders
- Outside #250 — Discovery pool / challengers
- Top 5 — monthly finalists
- Top 3 — quarterly finalists
- Annual 12 — locked annual candidate set

The first Top 250 is seeded, not ranked. Official rank begins only after every active company passes the same baseline methodology and minimum evidence-confidence standard.

## Trial

The methodology must survive **1,000 qualified full-universe ticks** before it is considered seasoned.

A qualified tick requires:

- all 250 active companies observed;
- at least 95% required source coverage;
- the external discovery scan completed;
- one locked methodology version across the full run;
- immutable storage of scores, ranks, evidence and source health.

Late entrants start with their own observation age. They do not inherit the system's history, but age alone never blocks a high-confidence challenger from competing.

## Earth Score 1.0

The long-horizon score combines:

- thesis quality;
- financial / operating momentum;
- market / valuation opportunity;
- catalyst score;
- governance & power;
- 2036 alignment;
- cross-division leverage;
- bottleneck control;
- scenario robustness;
- substitution resilience;
- supply-chain resilience;
- pricing power;
- data confidence;
- risk.

Short-horizon **Opportunity Score** remains separate from Earth Score.

The canonical weights and qualification rules live in `engine/methodology.ts`. Scoring lives in `engine/scoring.ts`. Ranking, maturity and boundary replacement logic live in `engine/ranking.ts`.

## Evidence maturity

`WOOD → HAY → IRON → GOLD → DIAMOND`

Signal volume never substitutes for evidence quality. Repeated articles that originate from one filing, press release or government notice count as one underlying factual event unless they provide genuinely independent evidence.

## Discovery

The discovery pool is never capped. Earth 2036 watches public-market entry paths and primary evidence sources including SEC filings, exchange listing feeds, FINRA/OTC activity, government procurement, patents, regulators, sector agencies and scientific/clinical sources.

A company can move:

`unknown → discovered → probation → Top 250 → contender → Championship`

or in the opposite direction. No company is protected by reputation or prior rank.

## Causal graph

Earth 2036 connects:

`COMPANY ↔ TECHNOLOGY ↔ RESOURCE ↔ INFRASTRUCTURE ↔ HUMAN NEED`

The database stores causal nodes and sourced edges so the system can model dependencies, substitutes, bottlenecks, second-order beneficiaries and likely losers as technology and human demand change.

## Forecasts

Supported horizons are:

`24h · 72h · 7d · 15d · 21d · 28d`

Forecasts are issued only from sourced data. Every forecast is timestamped and retained with the later actual outcome for calibration. Placeholder forecasts are prohibited.

## Repository ownership

- `app/` — dashboard and universe views only; presentation never owns scoring logic
- `engine/` — methodology, scoring, ranking and system rules
- `lib/` — universe seed data, discovery-source registry and UI-facing read models
- `data/` — immutable research snapshots / imports
- `database/` — canonical schema
- `docs/` — product, universe and discovery specifications

## Non-negotiables

1. Lawfully public information only.
2. Preserve historical evidence, scores, ranks, forecasts, membership changes and methodology versions.
3. Never rewrite an old prediction after observing the result.
4. Never publish an official score/rank from placeholder or non-comparable data.
5. Important claims require primary evidence and independent corroboration when reasonably available.
6. Notes stay short, clear and decision-useful.
7. Earth Score and Opportunity Score stay separate.
8. Diamond is rare and can be lost.
9. Universe membership is competitive and replaceable.
10. Discovery remains broader than the active universe.

## Current status

**System v1.0 locked. Universe 250 seeded. Official T0 baseline pending.**

The preserved 10-company v0.1 snapshots are prototype history only and do not count toward the 1,000-tick trial.

Public source repository for the Earth 2036 research laboratory. Not investment advice and not an investment product.
