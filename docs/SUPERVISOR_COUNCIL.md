# Earth 2036 — Supervisor Council Operating Contract

## Mission

Earth 2036 uses multiple independent intelligence lanes because one generalist supervisor can miss a weak signal, over-trust a source, defend its own thesis, or become overloaded by the breadth of the 250-company universe plus unbounded discovery.

The council exists to increase accuracy, breadth, contradiction detection and resilience — not to manufacture consensus.

Permanent authority chain:

`MACHINE OBSERVATION → 6 SPECIALIST LANES → CHIEF EARTH RECONCILIATION → DETERMINISTIC GATE → QUALIFIED TICK`

Workers propose. The Chief interprets and promotes. The deterministic engine alone finalizes a qualified tick.

## Accuracy-first doctrine

Every material improvement is classified as:

- **IMPLEMENT** — measurable accuracy/integrity gain with acceptable operational cost.
- **DEBATE** — plausible accuracy gain with meaningful latency, cost, brittleness, false-positive risk or maintenance burden.
- **DEFER** — no meaningful decision-relevant accuracy or integrity gain.

Unknown stays unknown. Throughput never justifies weakening an evidence gate.

## Six required specialist lanes

### 1. Source & Integrity — `source-integrity`

Owns the input boundary: source capability, freshness, identity/tradability, provenance, event fingerprints, duplicate-origin collapse, evidence aging, missing data, source independence, capability coverage, evidence-review queue integrity, raw observations versus runtime state, Git persistence, CI evidence and Sheet parity.

Question: **Can Earth trust what entered the system?**

### 2. Company Underwriting — `company-underwriting`

Owns company-specific evidence: financial/operating momentum, contracts/backlog, customers, suppliers, balance sheet, management delivery, governance/power, capital allocation, dilution, concentration, rubric factors, thesis, key risks and catalysts.

Question: **What does primary evidence actually say about this company?**

### 3. Structural & Causal — `structural-causal`

Owns the world model: human need ↔ infrastructure ↔ technology ↔ resource/bottleneck ↔ company. Tracks bottlenecks, scarcity, substitution, constraint migration, premiumization, supply-chain fragility, cross-division leverage, second/third-order effects, regime shifts, counterfactual tests and falsifiers.

Question: **Why should this company matter in plausible 2036 worlds, and what breaks that relationship?**

### 4. Discovery & Weak Signals — `discovery-weak-signals`

Owns what Earth may be missing: newly public/filed/uplisted companies, patents, hiring clusters, research breakthroughs, procurement, regulatory language, facilities, emerging technologies, strategic resources, unusual silence/data absence, weak-signal convergence, anti-consensus observations and periodic “what are we not watching?” audits.

Question: **What is outside Earth’s present worldview?**

### 5. Adversarial Red Team — `adversarial-red-team`

Owns active falsification: contradictory evidence, source dependence, accounting/fraud patterns, dilution, management promotion, customer concentration, hidden leverage, substitute technologies, competitive responses, pre-mortems, historical failure analogs, causal overreach and confidence inflation.

Question: **How is Earth wrong?**

### 6. Expectations & Execution — `expectations-execution`

Owns the gap between business truth and investment opportunity: valuation, market-implied expectations, consensus divergence, Opportunity/Execution Scores, reward/risk, asymmetry, event/calendar risk, crowding, short-horizon forecasts and later calibration. It never silently contaminates long-horizon Earth Score with market behavior.

Question: **Even if the company thesis is right, is that outcome already priced or poorly timed?**

## Scheduled-task capacity workaround

Earth has six required logical supervisors but does not require six independent scheduled-task slots.

To preserve analytical breadth under finite task capacity, the six lanes are executed by two scheduled council runners:

- **Council Alpha** — `source-integrity`, `company-underwriting`, `structural-causal`
- **Council Beta** — `discovery-weak-signals`, `adversarial-red-team`, `expectations-execution`

A runner is only a scheduler/container. The lanes inside it remain analytically independent. Each lane must complete its own pass from canonical evidence before seeing or using another lane's conclusions. Cross-lane communication happens only after the independent pass through explicit peer requests and later Chief reconciliation.

This preserves six distinct ways Earth can be wrong while consuming three Earth automation slots total: Alpha, Beta and Chief.

The former standalone Weekly Top 10, Monthly Top 5 and Quarterly Top 3 scheduled jobs are absorbed into the Chief. The Chief checks calendar due-state every hourly run and executes each period decision exactly once when due. This frees task capacity without deleting the weekly/monthly/quarterly methodology.

## Chief Earth Supervisor — `chief-earth`

The existing intelligent supervisor becomes the Chief. It reads the six same-cycle reports, machine/runtime state, evidence queue, causal graph, baseline evidence, discovery pool, source health, Beast integrity, CI/persistence evidence and the Sheet mirror.

The Chief may not approve by averaging disagreement. It must identify why lanes disagree, request targeted evidence, resolve the conflict from source hierarchy, or block and carry the question forward.

The Chief is the only intelligent layer allowed to promote specialist proposals into canonical Earth state.

## Atomic cycle protocol

Earth 2036 is clocked to the top of every hour.

The normal hourly sequence is:

1. `:00` — deterministic machine observation/source scan/persistence begins.
2. `:15` — Council Alpha reviews the newest persisted machine cycle through its three independent lanes.
3. `:25` — Council Beta reviews the same cycle through its three independent lanes.
4. `:45` — Chief Earth reads all six same-cycle lane reports, reconciles conflicts, updates the Sheet mirror, promotes only defensible canonical changes and either signs or blocks the cycle.
5. At `:00` of the next hour, before the next observation pass proceeds, the tick finalizer validates the prior Chief attestation before any prior cycle may become a qualified tick.

The top-of-hour boundary is the official Earth cycle boundary. Historical cycle IDs, later trial ticks and periodic analytics should therefore align to the hour that began the machine observation, not to the later specialist or Chief timestamps.

If the machine cycle has not safely persisted by a runner's scheduled time, that runner must not guess or fall back to stale mixed-cycle evidence. It records/retains the prior cycle state and the Chief blocks approval until a coherent same-cycle council exists.

Every specialist report is immutable and stored under:

`data/runtime/supervisors/cycles/<cycleKey>/`

A lane report filename begins with its exact lane id and may include a timestamp/revision suffix. A revision is additive; earlier reports are never overwritten.

Each report must contain at least:

- `reportVersion: 1`
- `laneId`
- `cycleKey` matching the machine cycle reviewed
- `generatedAt`
- `status`: `complete`, `no_material_change`, `needs_research`, or `blocked`
- concise summary
- material findings with source URLs/IDs and event/origin fingerprints when available
- proposed canonical changes
- contradictions/disagreements
- unknowns
- peer requests
- accuracy-first debates
- blocking issues
- confidence

A lane must never claim `no_material_change` merely because it failed to obtain data.

## Reconciliation and immutable attestation

After reading all six reports, the Chief writes an immutable reconciliation record and updates `data/runtime/supervisor-council.json`.

An approved attestation must include all six lane paths and exact Git blob SHAs, the reviewed `cycleKey`, `managerId=chief-earth`, `disagreementsResolved=true`, `unknownsAcknowledged=true`, `sheetMirrorSynced=true`, zero unresolved blockers, and `requiresRecompute=false`.

If the Chief promotes any material canonical change that can affect a score, rank, source gate, causal edge, discovery decision or evidence queue, it must set:

- `canonicalChangesApplied=true`
- `requiresRecompute=true`
- `approved=false`

The next machine cycle recomputes first. This prevents a tick from using a ranking calculated before the new intelligence existed.

## Two-phase qualified ticks

Post-T0 ticks are intentionally delayed one machine cycle.

1. Machine cycle N observes and persists reality at the top of the hour.
2. Six specialist lanes independently review cycle N through Alpha/Beta.
3. Chief reconciles cycle N and signs it only if no material recompute is required.
4. At the start of machine cycle N+1, `finalize-qualified-tick.mjs` validates the prior machine gates, Chief approval, every required lane file, cycle identity, file path and Git blob SHA.
5. Only then may cycle N become a qualified immutable tick.
6. Machine cycle N+1 then observes the next state of the world.

This adds latency but prevents the tick counter from outrunning intelligent review.

## Disagreement is data

When two lanes disagree materially, the Chief creates a targeted research directive instead of averaging the numbers. Typical examples:

- underwriting sees strong pricing power while red team finds customer resistance;
- structural lane sees a durable bottleneck while discovery finds a substitute technology;
- execution sees extreme valuation while underwriting sees exceptional fundamentals.

The unresolved point lowers confidence or blocks approval until the evidence supports a defensible resolution.

## Autonomous problem solving

Specialists read current directives but write only their own lane outputs. The Chief owns the routing and closure of shared directives.

Default resolution sequence:

1. retry a transient source/tool failure;
2. seek the primary source or an independent corroborating source;
3. ask the lane best suited to resolve the conflict on the next cycle;
4. use conservative/unknown treatment while evidence is incomplete;
5. block the affected score/tick rather than invent a value;
6. escalate to the user only when owner authority is genuinely required.

The Chief can normally resolve taxonomy questions, source conflicts, research priority, stale evidence, duplicate evidence, candidate triage, score-evidence gaps, causal disputes and transient tooling problems without the user.

## User escalation policy

Escalate only for a genuine owner decision such as:

- a methodology/weighting change that would alter Earth 2036’s locked rules;
- paid credentials, provider contracts or access the system cannot lawfully obtain itself;
- a legal/ethical/privacy boundary;
- an irreversible capital-allocation action;
- a high-materiality disagreement that remains unresolved after repeated independent attempts;
- persistent infrastructure/permission corruption the council cannot repair;
- an ACCURACY-FIRST DEBATE whose expected accuracy gain is material but whose ongoing speed/cost/fragility tradeoff needs owner preference.

Routine failures, missing articles, single-source contradictions and ordinary research gaps are not user escalations.

## Periodic decision cadence

Weekly, monthly and quarterly selection remain part of Earth even though they no longer consume separate scheduled-task slots.

The Chief owns exactly-once due-state checks:

- Sunday at/after 19:00 America/New_York — Weekly Top 10 + Next 10 challengers from the prior seven days of qualified/reconciled history.
- First calendar day at/after 08:00 — Monthly Top 5 from the union of weekly finalists.
- Jan/Apr/Jul/Oct 1 at/after 09:00 — Quarterly Top 3 from monthly finalists.

These decisions remain immutable, calibrated later against outcomes, and keep Earth Score separate from Opportunity/Execution. If official T0 has not produced enough valid comparable history, the period output remains pending rather than being fabricated.

## Predicting the unpredictable

The council cannot promise to predict every black swan. It is designed to detect pressure and fragility before consensus by explicitly watching:

- weak-signal convergence across independent domains;
- regime shifts and relationship breakdowns;
- narrative-versus-primary-evidence divergence;
- constraint migration after a bottleneck is solved;
- second/third-order shock propagation;
- optionality and antifragility;
- data absence and management-language drift;
- temporal precursor sequences;
- failure-pattern analogs;
- cross-model disagreement;
- emerging domains with no current Earth node/company/source.

Surprise itself is evidence. When reality materially violates Earth’s expectation, the Chief records a surprise/miss, investigates why the system failed to anticipate it, and routes a methodology/source/process improvement through IMPLEMENT/DEBATE/DEFER rather than rewriting history.

## Non-negotiable integrity rules

- Seed order is never rank.
- Prototype values never become official by inheritance.
- Ten copies of one origin are one underlying event.
- Material contradictions remain visible until resolved.
- Primary evidence outranks narrative repetition.
- Earth retains its evidence-sovereignty rules.
- No specialist may directly increment trial ticks.
- No Chief approval may cover missing, stale or mismatched specialist reports.
- No material canonical change may be approved without a recompute.
- Failed/partial cycles remain history but never count as qualified ticks.
- Historical evidence, reports, reconciliations and ticks are immutable; corrections are additive.
