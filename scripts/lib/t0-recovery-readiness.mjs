// Read-only cross-plane T0 recovery classifier. Never authorizes scheduler dispatch,
// worker restart, evidence admission, canonical promotion, or qualified ticks.
export const T0_RECOVERY_AUDIT_CONTRACT = 'earth2036-t0-recovery-readiness-v1';
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const ratio = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const minutes = (time, now) => {
  const at = Date.parse(time || '');
  const end = Date.parse(now || '');
  return Number.isFinite(at) && Number.isFinite(end) ? Math.max(0, Math.round((end - at) / 60000)) : null;
};

export function assessT0Recovery({ system, manifest, metrics, sourceHealth, integrity, reconciliation, leases, now }) {
  const violations = [], blockers = [], warnings = [];
  const check = (condition, code) => { if (!condition) violations.push(code); };
  const need = (condition, code, owner, evidence) => { if (condition) blockers.push({ code, owner, evidence }); };
  const warn = (condition, code, evidence) => { if (condition) warnings.push({ code, evidence }); };
  const counts = metrics?.counts || {};
  const expected = system?.companiesExpected;
  const canonical = counts.canonical;
  const unfinished = Object.entries(counts).filter(([k]) => k !== 'canonical').reduce((n, [, v]) => n + (integer(v) ? v : 0), 0);
  const ages = { machineMinutes: minutes(system?.lastCycleAt, now), workgraphMinutes: minutes(metrics?.generatedAt, now), hourlyAuditMinutes: minutes(reconciliation?.checkedAt, now) };
  const coverage = sourceHealth?.combinedCoverageRatio;
  const reconciliationCounts = reconciliation?.counts || {};
  const leaseCounts = leases?.byStatus || {};
  const active = (metrics?.closureEngine?.selected || []).map(row => row.ticker).filter(Boolean);

  check(integer(expected) && expected === 250, 'unexpected_t0_universe');
  check(Object.values(counts).every(integer) && Object.values(counts).reduce((a,b) => a+b,0) === expected, 'workgraph_population_mismatch');
  check(integer(canonical) && canonical === system?.workgraphCanonicalCompanies && canonical === system?.publishableCompanies && canonical === manifest?.publishableCompanies, 'canonical_authority_mismatch');
  check(system?.qualifiedTrialTicks === manifest?.qualifiedTrialTicksAfterBaseline, 'qualified_tick_counter_mismatch');
  check(ratio(coverage) && ratio(sourceHealth?.machineCoverageRatio) && ratio(sourceHealth?.supervisorCoverageRatio), 'invalid_coverage_metric');
  check(integrity?.passed === true || integrity?.passed === false, 'integrity_result_missing');
  check(integer(reconciliationCounts.slots) && integer(reconciliationCounts.slotsWithoutObservation) && reconciliationCounts.slotsWithoutObservation <= reconciliationCounts.slots, 'invalid_hourly_observation_counts');
  check(integer(leases?.count) && Object.values(leaseCounts).every(integer), 'invalid_worker_lease_counts');
  check(!(manifest?.published === true && canonical < expected), 'premature_t0_publication');
  check(!(system?.qualifiedTrialTicks > 0 && manifest?.published !== true), 'trial_qualified_before_t0_publication');
  check(ages.machineMinutes !== null && ages.workgraphMinutes !== null, 'missing_runtime_timestamps');

  need(ages.machineMinutes === null || ages.machineMinutes > 90, 'machine_cycle_stale', 'github-scheduler', { ageMinutes: ages.machineMinutes, lastCycleAt: system?.lastCycleAt || null });
  warn(reconciliationCounts.slotsWithoutObservation > 0, 'historical_scheduler_nonarrival', { missing: reconciliationCounts.slotsWithoutObservation, slots: reconciliationCounts.slots, requiresOriginalObservations: true });
  warn(reconciliationCounts.missingAsOfReceipts > 0, 'missing_asof_receipts', { missing: reconciliationCounts.missingAsOfReceipts, noBackfill: true });
  need(ages.workgraphMinutes === null || ages.workgraphMinutes > 90, 'workgraph_reconciliation_stale', 'github-workgraph', { ageMinutes: ages.workgraphMinutes });
  need(integrity?.passed !== true, 'integrity_gate_closed', 'earth-core', { reasons: integrity?.reasons || [] });
  need(coverage !== 1, 'supervisor_source_coverage_incomplete', 'source-review', { machine: sourceHealth?.machineCoverageRatio, supervisor: sourceHealth?.supervisorCoverageRatio, combined: coverage });
  need((leaseCounts.blocked_rejected_write_needs_review || 0) > 0, 'rejected_evidence_write_hold', 'safety-review', { count: leaseCounts.blocked_rejected_write_needs_review, automaticRetryPermitted: false });
  need((leaseCounts.unacknowledged_overdue_needs_review || 0) > 0, 'unacknowledged_worker_obligations', 'worker-operator', { count: leaseCounts.unacknowledged_overdue_needs_review, taskEnablementProven: false });
  need((leaseCounts.blocked_deferred_source_dependency || 0) > 0, 'unverified_source_dependency', 'source-review', { count: leaseCounts.blocked_deferred_source_dependency });
  need(unfinished > 0 && (counts.chief_ready || 0) === 0, 'no_chief_ready_frontier', 'council-chief', { unfinished, packetReady: counts.packet_ready || 0, selected: active });
  warn((metrics?.closureEngine?.stalledCount || 0) > 0, 'deferred_unchanged_input', { stalled: metrics?.closureEngine?.stalledCount, noResetWithoutChangedInput: true });
  need(manifest?.published !== true, 't0_publication_not_authorized', 'earth-core', { canonical, expected });
  const observedTickCount = system?.qualifiedTrialTicks;

  return {
    contract: T0_RECOVERY_AUDIT_CONTRACT,
    generatedAt: now,
    authority: { writes: false, workerRestart: false, schedulerDispatch: false, canonicalPromotion: false, evidenceAdmission: false, tickQualification: false, historicalBackfill: false },
    baseline: { canonical, expected, unfinished, packetReady: counts.packet_ready || 0, chiefReady: counts.chief_ready || 0, qualifiedTicks: observedTickCount, published: manifest?.published === true },
    planes: {
      scheduler: { lastCycleAt: system?.lastCycleAt || null, ageMinutes: ages.machineMinutes, missingHistoricalHours: reconciliationCounts.slotsWithoutObservation ?? null, observedWindowHours: reconciliationCounts.slots ?? null },
      integrity: { passed: integrity?.passed, machineCoverage: sourceHealth?.machineCoverageRatio, supervisorCoverage: sourceHealth?.supervisorCoverageRatio, combinedCoverage: coverage },
      workforce: { persistedObligations: leases?.count, byStatus: leaseCounts, taskEnablement: 'unverified_from_github', recentTaskRunIsNotClosureProof: true },
      closure: { selected: active, deferred: metrics?.closureEngine?.stalledCount ?? null, canonicalVelocity24h: metrics?.canonicalVelocity?.h24 ?? null },
      trial: { published: manifest?.published === true, qualifiedTicks: observedTickCount, gateOpen: manifest?.runtimeGate?.passed === true },
    },
    violations, blockers, warnings, passedInvariants: violations.length === 0,
    readyForPublication: violations.length === 0 && blockers.length === 0 && canonical === expected && manifest?.runtimeGate?.passed === true,
  };
}
