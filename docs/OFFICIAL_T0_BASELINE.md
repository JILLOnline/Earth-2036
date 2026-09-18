# Earth 2036 — Official T0 Baseline

Baseline ID: `earth2036-official-t0-2026-09-12`

Methodology: `1.0.0`

Universe target: `250`

## Objective

Produce the first official, directly comparable #1–#250 Earth 2036 ranking from sourced data. This is the permanent starting point for the 1,000-qualified-tick trial.

## Execution order

### 1. Identity and tradability

For every seed, verify:

- canonical company name;
- current ticker;
- current exchange / U.S.-tradable venue;
- SEC CIK when applicable;
- operating-company status;
- not acquired, delisted or stale under the seeded identity.

Primary identity sources are SEC and exchange/FINRA records. An invalid seed is not silently repaired; it is marked rejected and replaced through the discovery pool with an immutable reason.

### 2. Functional mapping

Confirm the company's current division and functional lane. Record material cross-division exposure separately rather than forcing multiple primary divisions.

### 3. Evidence bundle

Gather the strongest available current evidence for:

- financial / operating trajectory;
- valuation and market opportunity;
- management and governance;
- catalysts;
- 2036 alignment;
- cross-division leverage;
- bottleneck control;
- scenario robustness;
- substitution resilience;
- supply-chain resilience;
- pricing power;
- risk;
- data confidence.

Prefer filings, audited reporting, regulators, government datasets, procurement, standards and direct technical evidence. Duplicate media repetition is deduplicated to the underlying event.

### 4. Causal graph

For every company, identify material relationships to technologies, resources, infrastructure and human needs. Store sourced edges for dependencies, suppliers, substitutes, competitors, beneficiaries, threats and constraints.

### 5. Scoring

Apply methodology `1.0.0` exactly as defined in `engine/methodology.ts` and `engine/scoring.ts`.

No discretionary hidden adjustment is allowed after the formula. If the formula needs to change, create a new methodology version rather than changing historical v1.0 results.

### 6. Publication gate

T0 publishes only when all conditions are true:

- 250 active companies are present;
- 250 identities are verified;
- 250 tradability records are verified;
- 250 companies have complete component scores;
- every ranked company has Data Confidence >= 60;
- every company has at least one primary source;
- no duplicate tickers exist;
- the external discovery scan for the baseline window is complete;
- no placeholder score, rank, forecast or market-cap case exists;
- the same evidence-window end and methodology version are used across the run.

If any condition fails, T0 remains `in_progress`.

## Trial transition

Official T0 is baseline sequence zero. It does not count as one of the 1,000 subsequent qualified observation ticks.

After T0 publishes, a future observation increments the trial only when `qualifiesAsFullUniverseTick()` passes.

## Historical rule

The old 10-company v0.1 T0/T1 records remain preserved as prototype history. They cannot be relabeled, rescored or counted as official v1.0 observations.
