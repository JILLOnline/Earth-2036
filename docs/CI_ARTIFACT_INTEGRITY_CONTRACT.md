# Earth 2036 — Machine CI & Council Artifact Integrity Contract

## Purpose

Earth 2036 separates deterministic machine execution from post-machine intelligent review. Both must be integrity-protected, but they are not the same boundary.

A machine cycle is code/runtime execution. Specialist and Chief outputs are append-only intelligence artifacts created after that machine cycle. Requiring a new explicit workflow-dispatch CI run after every append-only report commit would create a circular coordination problem because each report commit advances the branch again.

This contract defines the two proofs without weakening either one.

## 1. Machine execution proof

For every deterministic machine cycle that may contribute to T0 or a qualified trial tick:

- identify the exact commit SHA on which that machine cycle executed/persisted;
- require a real Earth 2036 CI verification for that exact machine-cycle SHA;
- for GitHub bot persistence, an empty `pull_request` run with `action_required` and zero jobs is neither a pass nor a failure;
- require the real verification job to pass install, security audit, typecheck, engine invariants, production build, autonomous-engine dry run and unresolved-entity reporting;
- Beast integrity and sourceMesh must pass for the cycle's persisted machine/runtime state.

The machine-cycle SHA is the execution boundary. A later append-only supervisor report commit does not retroactively change what code or canonical machine state executed in that cycle.

## 2. Council artifact proof

Specialist reports and Chief reconciliation occur after machine persistence. Their integrity is proven independently through content addressing and deterministic validation:

- every specialist report is immutable and cycle-scoped under `data/runtime/supervisors/cycles/<cycleKey>/`;
- revisions append; they never overwrite earlier reports;
- Chief attestation must name the exact report path and exact Git blob SHA used;
- the deterministic finalizer re-reads every required report, recomputes the Git blob SHA, validates lane identity, cycle identity, schema, acquisition state, status and blockers, and rejects mismatches;
- reconciliation records are append-only;
- prior-cycle specialist evidence may not be substituted for a missing same-cycle lane.

A normal PR CI pass on a supervisor-only append commit is useful extra evidence, but a new explicit workflow-dispatch CI run is not required merely because an immutable report file advanced the branch.

## 3. What invalidates the reviewed machine cycle

After the machine-cycle CI boundary, the reviewed cycle MUST NOT be approved if a later change modifies anything that can alter deterministic results or canonical decision state before recomputation, including:

- executable engine/scripts/workflows used by Earth;
- methodology, rubric, scoring or ranking logic;
- source-role/gating logic or source scanner behavior;
- active-universe membership or identity/tradability canonical state;
- baseline evidence, score inputs, evidence interpretation/resolution, causal graph or discovery state in a way that can alter score/rank/gates;
- any other material canonical change identified by Chief.

In those cases Chief sets `canonicalChangesApplied=true`, `requiresRecompute=true`, `approved=false`. The next machine cycle recomputes under the changed state and establishes a new machine execution/CI boundary.

## 4. Allowed post-machine append-only state

The following may legitimately be created after machine execution without invalidating the machine-cycle CI proof, provided they do not themselves alter the prior deterministic result and all normal validation rules are met:

- immutable specialist lane reports;
- immutable Chief reconciliation records;
- council attestation metadata;
- current-cycle supervisor review state;
- research directives and peer-routing metadata;
- Sheet-mirror status/notes;
- append-only audit/history records.

If any such artifact contains or causes a material canonical scoring/gating change, the recompute rule above takes precedence.

## 5. Timestamp rule

`cycleKey`, persisted machine state and exact blob identity are authoritative. Human/LLM-generated `generatedAt` timestamps are metadata, not an execution proof.

For qualification:

- timestamps must parse;
- a lane report must belong to the exact reviewed cycle;
- a report must not predate the reviewed machine cycle;
- Chief must not attest to a report whose declared generation time is after Chief approval;
- obvious clock anomalies are recorded by Source & Integrity rather than silently treated as evidence of freshness.

## 6. Fail-closed rule

If Earth cannot establish both:

1. verified deterministic machine execution for the reviewed machine-cycle SHA, and
2. exact immutable council artifact identity for all six same-cycle lanes,

then the cycle is not fully verified and cannot qualify.

This distinction is permanent unless explicitly superseded by a later versioned integrity contract.
