import test from 'node:test';
import assert from 'node:assert/strict';
import { assessT0Recovery } from '../scripts/lib/t0-recovery-readiness.mjs';

const fixture = () => ({
  now: '2026-10-18T17:00:00Z',
  system: { companiesExpected:250, workgraphCanonicalCompanies:176, publishableCompanies:176, qualifiedTrialTicks:0, lastCycleAt:'2026-10-18T14:34:04Z' },
  manifest: {publishableCompanies:176, qualifiedTrialTicksAfterBaseline:0, published:false, runtimeGate:{passed:false}},
  metrics: {generatedAt:'2026-10-18T14:47:34Z',counts:{researching:73,packet_ready:1,canonical:176},closureEngine:{stalledCount:72,selected:[{ticker:'AEVA'},{ticker:'SWKS'}]},canonicalVelocity:{h24:0}},
  sourceHealth: {machineCoverageRatio:1, supervisorCoverageRatio:0.708, combinedCoverageRatio:0.708},
  integrity:{passed:true,reasons:[]},
  reconciliation:{checkedAt:'2026-10-18T16:00:00Z',counts:{slots:72,slotsWithoutObservation:44,missingAsOfReceipts:35}},
  leases:{count:9,byStatus:{unacknowledged_overdue_needs_review:7,blocked_rejected_write_needs_review:1,blocked_deferred_source_dependency:1}}
});
const has = (arr, code) => arr.some(x => x.code === code);
test('honest T0 baseline without declaring false healthy', () => {
  const r=assessT0Recovery(fixture());
  assert.equal(r.passedInvariants,true);
  assert.equal(r.baseline.canonical,176);
  assert.equal(r.baseline.unfinished,74);
  assert.equal(r.readyForPublication,false);
  assert.equal(r.planes.workforce.taskEnablement,'unverified_from_github');
  assert.ok(has(r.blockers,'machine_cycle_stale'));
  assert.ok(has(r.blockers,'rejected_evidence_write_hold'));
  assert.ok(has(r.warnings,'historical_scheduler_nonarrival'));
});
test('fails on population mismatch rather than inventing unassigned companies',()=>{const f=fixture();f.metrics.counts.researching=72;const r=assessT0Recovery(f);assert.ok(r.violations.includes('workgraph_population_mismatch'));});
test('fails on divergent canonical counts',()=>{const f=fixture();f.manifest.publishableCompanies=177;assert.ok(assessT0Recovery(f).violations.includes('canonical_authority_mismatch'));});
test('fails on qualified tick counter mismatch',()=>{const f=fixture();f.system.qualifiedTrialTicks=1;assert.ok(assessT0Recovery(f).violations.includes('qualified_tick_counter_mismatch'));});
test('rejects publishing an incomplete baseline',()=>{const f=fixture();f.manifest.published=true;assert.ok(assessT0Recovery(f).violations.includes('premature_t0_publication'));});
test('rejects early trial ticks',()=>{const f=fixture();f.system.qualifiedTrialTicks=1;f.manifest.qualifiedTrialTicksAfterBaseline=1;assert.ok(assessT0Recovery(f).violations.includes('trial_qualified_before_t0_publication'));});
test('never turns repaired source coverage into worker restart permission',()=>{const f=fixture();f.sourceHealth.supervisorCoverageRatio=1;f.sourceHealth.combinedCoverageRatio=1;const r=assessT0Recovery(f);assert.equal(r.authority.workerRestart,false);assert.ok(has(r.blockers,'rejected_evidence_write_hold'));});
test('does not confuse verified integrity with source coverage',()=>{const r=assessT0Recovery(fixture());assert.equal(r.planes.integrity.passed,true);assert.ok(has(r.blockers,'supervisor_source_coverage_incomplete'));});
test('historical missing slots are warnings, never backfilled',()=>{const r=assessT0Recovery(fixture());assert.equal(r.authority.historicalBackfill,false);assert.ok(has(r.warnings,'missing_asof_receipts'));});
test('source integrity failure remains a hard blocker',()=>{const f=fixture();f.integrity={passed:false,reasons:['source_mesh']};assert.ok(has(assessT0Recovery(f).blockers,'integrity_gate_closed'));});
