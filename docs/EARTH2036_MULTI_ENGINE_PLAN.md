# Earth 2036 Multi-Engine Architecture & Rollout Plan

Status: implementation-active  
Canonical authority: Earth Core on `JILLOnline/Earth-2036@main`  
Doctrine: `config/earth-doctrine.json`  
Methodology authority: `config/methodology-1.0.json`

## 1. Mission

Earth 2036 collects data, interprets data and recommends evidence-backed paths. It does not coerce, demean, punish or manufacture certainty. The system optimizes for durable value: time saved, uncertainty reduced, risk prevented, knowledge created, resources conserved, resilience increased, credible opportunities discovered and better decisions enabled.

Representation quality is independent of ranking position.

## 2. Authority model

### Earth Core
Only Core may create canonical company evidence, scores, ranks, ticks, baseline state or methodology-authorized causal state.

### Earth Shadow
Shadow may calibrate, challenge, represent, prioritize, simulate and surface hypotheses. Shadow output is advisory and may never silently enter canonical state.

### Earth Lab
Lab is experimental. Promotion path is Lab -> Shadow validation -> explicit versioned Core methodology change -> CI/Beast validation.

## 3. Current engines

1. Reality/Evidence — active Core.
2. Calibration — active Shadow.
3. Ranking — active Core.
4. Causal Systems — active Core.
5. Temporal/Forecast — planned Shadow/Lab.
6. Company Evolution — scaffold Shadow.
7. Strategic Bridge — scaffold Shadow.
8. Human/Earth Value — scaffold Shadow.
9. Value Allocator — active Shadow.

## 4. Workforce

Exactly five intelligent supervisors remain:
- Earth Scout
- Council Alpha
- Council Beta
- Deep Resolver
- Chief Earth

They supervise virtual work; they are not one-company workers.

Rule: Own your lane. Help every other lane. Never steal its authority.

### Owned lanes
Scout: source acquisition, discovery, expectations/execution.  
Alpha: underwriting, source-addressed score construction, calibration application, company needs/capabilities.  
Beta: structural-causal analysis and adversarial red team.  
Resolver: genuine contradictions, ambiguity and dependency deadlocks.  
Chief: methodology, sovereign exceptions and operational governance.

## 5. Assist Bus

Each assist request contains:
- stable requestId
- inputSignature
- ticker/workId
- rootOwner
- helperRole
- exact requested capability
- exact question
- current failures
- packet/evidence lineage
- success condition
- prior attempt
- active/dormant state

Rules:
1. Root owner never changes.
2. Helper cannot replace root-owner perspective.
3. Unchanged failed input goes dormant.
4. Changed evidence/input creates a new input signature and may reactivate.
5. Circular role assistance is detected.
6. No assist may write canonical state directly.

## 6. Dependency/deadlock model

Role and work dependencies are derived from active Assist Bus requests.

Deadlock policy:
- detect role cycle;
- identify earliest unresolved evidence/methodology dependency;
- send one exact directive to Resolver;
- forbid circular re-routing;
- preserve dormant unchanged failures until input changes or Chief adjudicates.

## 7. Calibration

Methodology 1.0 remains the score authority.

The Calibration contract adds explicit bounded anchors for each existing component without changing weights or T0 publication gates.

Process:
1. collect source-addressed evidence;
2. identify defensible anchor band;
3. choose exact value only inside that band;
4. justify the value with source IDs and factual basis;
5. expose unknowns by reducing confidence rather than assuming favorable facts;
6. include calibrationVersion;
7. preserve append-only supersession.

Calibration Shadow audits existing canonical records but cannot alter them.

## 8. Digital Twin

Digital Twin Shadow represents each non-canonical company using:
- identity
- evidence coverage
- source lineage
- factors/capability signals
- risks
- unknowns
- contradictions
- gating issues
- causal context
- improvement questions
- bridge inputs

Digital Twins never turn weak evidence into facts. Candidate capabilities/needs remain candidates until validated.

## 9. Value Allocator

The allocator ranks operational attention, not companies.

Inputs include:
- Workgraph state/closure proximity
- failure burden
- evidence reuse
- specialist coverage
- retry cost
- active assistance
- material contradictions

Default capacity:
Balanced: 60% closure / 25% expansion / 15% future-learning.  
Frontier stall: 70% closure / 20% expansion / 10% future-learning.

No bucket may become zero solely because another bucket is difficult.

## 10. Mobility contract

An intelligent run is productive only when at least one occurs:
1. Workgraph state advances.
2. Material uncertainty decreases.
3. A blocker becomes materially more precise/actionable.

Browsing, artifacts and fresh timestamps alone do not count as progress.

## 11. Planned next engines

### Temporal Engine
- immutable forecast ledger
- horizon: 24h / 72h / 7d / 15d / 21d / 28d plus longer structural horizons
- strict as-of evidence boundary
- score forecasts against realized outcomes
- retain misses and calibration errors

### Company Evolution Engine
Model:
current state -> constraint -> root cause -> possible intervention -> evidence required -> observed result.

It recommends improvement paths, never score-gaming instructions.

### Strategic Bridge Engine
Requires structured Need/Capability tags before emitting a bridge.

A bridge hypothesis must include:
- participants
- unmet problem
- complementary capabilities
- possible structure
- mechanism
- dependencies
- alternatives
- economics where supportable
- human value
- Earth costs
- regulatory/competition concerns
- falsifiers
- confidence

No bridge is issued from vague semantic similarity alone.

### Human/Earth Engine
Keep human benefit and planetary cost as separate dimensions. Do not collapse into a single moral score.

Human dimensions: health, time, safety, energy, food, water, mobility, knowledge, trust, productivity, resilience, quality of life.

Earth dimensions: energy, water, critical minerals, land, waste, emissions/pollution, biodiversity, recyclability/substitution, geographic concentration and infrastructure strain.

## 12. Adversarial scenario matrix

### S1 — One company traps the workforce
Expected: closure increases but expansion/future floors remain non-zero.

### S2 — Alpha requests source evidence Scout already failed to obtain
Expected: identical input signature is dormant; no repeat until evidence changes.

### S3 — Alpha and Scout request each other's help
Expected: dependency cycle detected; Resolver breaks the earliest real dependency.

### S4 — Shadow algorithm produces a compelling new score
Expected: canonical state unchanged; explicit methodology promotion required.

### S5 — Company supplies favorable information
Expected: issuer provenance preserved; no independent-corroboration credit unless independently sourced.

### S6 — Ten articles repeat one press release
Expected: common origin collapses through source genealogy.

### S7 — Historical forecast uses later evidence
Expected: rejected as temporal leakage.

### S8 — Worker produces many artifacts but closes nothing
Expected: zero-closure health warning and strategy change.

### S9 — Current methodology cannot map a valid fact
Expected: exact methodology gap escalated; no invented value.

### S10 — Company pays for deeper analysis
Expected: representation/service depth may increase; rank, weights, confidence, suppression and canonical treatment cannot be purchased.

### S11 — Earth recommendation influences company behavior
Expected: intervention is marked so later outcome analysis does not treat it as an independent forecast.

### S12 — Human benefit creates large ecological cost
Expected: both dimensions remain visible; system searches for lower-cost configurations rather than hiding either side.

### S13 — Two algorithms disagree sharply
Expected: preserve disagreement and inspect causal evidence; never average automatically.

### S14 — GitHub receives an evidence burst
Expected: reconcile coalesces derived computation; no independent engine writer storm.

## 13. Hard invariants

- one canonical authority
- immutable evidence/history
- source lineage required
- shadow cannot promote
- doctrine cannot be overridden by issuer/commercial status
- no pay-to-rank or pay-to-suppress
- no hidden confidence inflation
- no repeated unchanged failed work
- no role ownership theft
- no circular assistance
- no temporal leakage
- no methodology change without versioning
- Beast remains fail-closed for canonical promotion
- T0 gates are not expanded by shadow engines during current T0

## 14. Rollout gates

### Gate A — Foundation
Central methodology + doctrine + engine/workforce registries + tests.

### Gate B — Shadow operations
Calibration, Assist, Dependency, Digital Twin and Value Allocation derived inside Workgraph reconcile.

### Gate C — Worker consumption
All five supervisors read doctrine/contracts; Scout consumes assists; Alpha consumes calibration; Resolver consumes dependencies; Chief monitors all shadow outputs.

### Gate D — Live validation
Require successful CI, scheduler and reconcile; no regression in canonical counts or Beast integrity.

### Gate E — T0 progress validation
Verify new Alpha calibration actually converts at least one legitimate frontier blocker or exposes a narrower blocker. Do not claim success merely because the architecture exists.

### Gate F — Future engines
Temporal/Evolution/Bridge/Human-Earth stay Shadow until schemas and historical validation exist.

### Gate G — Earth Shadow challenger
Introduce independent alternative reasoning only after Core is operationally stable. Same raw evidence, different analytical method, no canonical writes.

## 15. Success metrics

Operational:
- canonical delta
- packet_ready -> chief_ready conversion
- median frontier age
- zero-closure runs
- assist closure rate
- repeated blocker rate
- deadlock count
- duplicate-origin collapse rate
- evidence reuse across roles
- reconciliation retries/races

Intelligence:
- calibration disagreements
- forecast accuracy/calibration by horizon
- causal falsifier hit rate
- Digital Twin evidence coverage
- bridge survival through red team
- uncertainty reduction
- recommendation outcome tracking

Doctrine/value:
- recommendations with evidence + uncertainty + falsifier
- issuer influence disclosures
- representation completeness independent of rank
- measured time/resource/risk savings where outcome data exists

## 16. Rollback

Shadow systems are removable without touching canonical evidence, scores or history.

If a shadow module causes CI/runtime instability:
1. disable its generation inside Workgraph sync;
2. retain its historical outputs for diagnosis;
3. leave Core untouched;
4. repair in Shadow/Lab;
5. re-enable only after invariants pass.

Methodology registry changes require explicit version governance; never silently roll back canonical history.

## 17. Immediate operating objective

Finish T0 while the new architecture learns beside it.

The proof of this upgrade is not file count. It is whether the current frontier begins converting more reliably, workers stop repeating known failures, cross-role assistance reduces wait states, and every improvement preserves truth, agency and value.
