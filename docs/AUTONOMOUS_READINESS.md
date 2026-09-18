# Earth 2036 — Autonomous Operating Contract

## Objective

Earth 2036 must be able to run for extended periods without manual data entry, manual ranking, manual spreadsheet maintenance, or manual website updates.

The user should only need to inspect results, challenge assumptions, and make capital-allocation decisions.

## Canonical architecture

Earth 2036 uses a hybrid autonomous design:

1. **Machine runner** — a GitHub Actions job executes every hour after this branch reaches the default branch. It validates the 250-company universe against SEC/exchange sources, observes SEC filing activity, records source health, detects new listings, maintains the evidence-review queue, updates the runtime state, enforces publication/tick gates, and commits data changes immutably.
2. **Intelligent supervisor** — the Earth 2036 ChatGPT automation handles fuzzy research that should not be reduced to brittle scraping rules: source-family discovery, evidence interpretation, causal mapping, score-factor evidence, structural substitution/scarcity/premiumization analysis, and the human-facing Google Sheet mirror.
3. **Git-backed data plane** — runtime JSON and append-only tick/history records under `data/runtime/` are the deployable technical source of truth during the v1 trial. This avoids depending on an external database secret before the methodology is proven. `database/schema.sql` plus migrations preserve a future Postgres migration path.
4. **Google Sheet mirror** — the Weekly Candidate Ledger is the readable operating ledger. It mirrors current state and appends history; it is not allowed to override technical history.
5. **Vercel UI** — Git data commits trigger deployment, so the site updates from the same canonical runtime files. No hand-edited dashboard values are authoritative.

## Hard integrity rules

- Seed order is never rank.
- Prototype v0.1 scores never become methodology-1.0 scores by inheritance.
- A score factor requires source evidence.
- A publishable score requires all methodology components, Risk, Data Confidence >= 60, at least one primary source, and causal mapping.
- The baseline does not publish until all 250 companies pass every gate.
- A post-baseline hourly run does not count toward the 1,000-tick trial unless all 250 are observed, combined source coverage is at least 95%, discovery completes, all 250 official scores remain publishable, and there is no unresolved material evidence waiting for review.
- Machine coverage and intelligent-supervisor coverage are separate. The system uses the lower of the two so one healthy layer cannot hide failure in the other.
- New filings enter an evidence-review queue. A material unresolved filing blocks a qualified trial tick rather than allowing stale scores to masquerade as current analysis.
- Historical scores, rankings, forecasts, evidence and membership events are immutable. Corrections are new records.

## Hourly machine loop

`DISCOVER → VALIDATE → OBSERVE → QUEUE EVIDENCE → CHECK SOURCES → READ SCORES → RANK → QUALIFY → ARCHIVE → COMMIT → DEPLOY`

Machine sources in v1 include:

- SEC company ticker registry
- Nasdaq listed-symbol directory
- NYSE/NYSE American/Cboe/IEX symbols through the official Nasdaq Trader other-listed directory
- SEC company submissions for every resolvable active-universe CIK

The intelligent supervisor expands beyond those machine feeds through the complete registered source network in `lib/discovery-sources.ts`.

## Deterministic score inputs

`engine/rubric.ts` defines reproducible subfactors for every Earth Score component, Risk and Data Confidence. Every subfactor must carry one or more source IDs and a concise evidence note.

The purpose is to make questions such as “Why is Bottleneck Control 82?” answerable from stored facts rather than model memory.

The canonical ranking tie-break remains:

1. Earth Score descending
2. Data Confidence descending
3. Risk ascending
4. Ticker alphabetical

## Entity continuity

A company is a persistent entity, not merely a ticker. The runtime registry and future `candidate_aliases` database table preserve identity through symbol/name/exchange changes. CIK is the preferred U.S. regulatory identity anchor where available.

## Discovery

The active universe is capped at 250; discovery is unbounded.

The first official exchange snapshot establishes the machine baseline without flooding the discovery pool. Subsequent new symbols are captured automatically and enter outside-universe review. The intelligent supervisor separately watches pre-listing registrations, government awards, patents, regulators and strategic suppliers.

## Causal intelligence

The causal graph stores nodes and sourced relationships across:

`HUMAN NEED ↔ INFRASTRUCTURE ↔ TECHNOLOGY ↔ RESOURCE/BOTTLENECK ↔ COMPANY`

Supported relationships include dependencies, supply, enablement, substitution, competition, benefit, threat, constraint, bottleneck ownership, premiumization and commoditization.

Structural signals explicitly track abundance, scarcity, substitution, premiumization, dependency, displacement and changing human demand. Every signal needs a falsifier.

## Spreadsheet contract

The Google Sheet contains existing ranking/history tabs plus:

- Score Inputs
- Causal Graph
- Source Health
- Discovery Pool
- System Health
- Road to 2036

Current-state tabs may update in place. Historical tabs append. Evidence must be deduplicated by underlying factual event/source fingerprint.

## Runtime files

- `data/runtime/system-state.json` — current engine status
- `data/runtime/supervisor-state.json` — intelligent-research/source coverage status
- `data/runtime/entity-registry.json` — current 250 identities/tradability
- `data/runtime/company-observations.json` — latest SEC observation per company
- `data/runtime/source-health.json` — machine + supervisor coverage
- `data/runtime/evidence-review-queue.json` — unreviewed new filings/events
- `data/runtime/score-state.json` — official methodology score records
- `data/runtime/current-ranking.json` — latest comparable ranking
- `data/runtime/causal-graph.json` — graph/signals/milestones
- `data/runtime/discovery-pool.json` — outside challengers
- `data/runtime/cycle-history.jsonl` — append-only cycle summaries
- `data/runtime/ticks/*.json` — immutable qualified post-T0 ticks

## Failure behavior

Earth 2036 prefers an explicit failed/partial cycle to a falsely clean observation.

Source outage, unresolved identity, insufficient source coverage, pending material evidence, missing score records or discovery failure must block qualification but preserve diagnostics. The next run retries automatically.

## Definition of autonomous-ready

Earth 2036 is autonomous-ready when:

- the hourly machine workflow is active on the default branch;
- all 250 companies have persistent validated identities;
- the intelligent supervisor is updating source coverage/evidence/causal/score state;
- the spreadsheet mirror updates without manual entry;
- the website reads canonical runtime state;
- system/source failures are visible and block ticks rather than corrupt history;
- new exchange listings and outside challengers enter discovery automatically;
- official T0 passes the full publication gate;
- qualified post-T0 observations begin accumulating without manual intervention.
