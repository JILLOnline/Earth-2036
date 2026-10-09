import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hourKeyFromDate, previousHourKey, hourStart, parseCycleHistory, assessHour, auditReceiptPath
} from '../scripts/hourly-accountability.mjs';

const hourKey='20261009T1400Z';
const when='2026-10-09T15:12:00.000Z';
const observation={
 cycleKey:hourKey,lastCycleAt:'2026-10-09T14:41:24.789Z',cycleStatus:'completed',
 companiesExpected:250,companiesObserved:250,identityValidated:250,tradabilityValidated:249,
 scoredCompanies:177,publishableCompanies:177,combinedSourceCoverageRatio:0.712,
 discoveryScanCompleted:true,unresolvedEvidence:1548,phase:'official_t0_baseline',
 qualifiedTick:false,qualifiedTrialTicks:0
};
const run={id:37945999631,path:'.github/workflows/earth2036-scheduler.yml',
 created_at:'2026-10-09T14:40:58Z',run_started_at:'2026-10-09T14:40:58Z',
 updated_at:'2026-10-09T14:41:40Z',event:'workflow_dispatch',
 status:'completed',conclusion:'success',run_attempt:1,
 head_sha:'360bd096cff7803c9e99350f268b714414a3101a',
 html_url:'https://github.com/JILLOnline/Earth-2036/actions/runs/37945999631'};

test('hour identity is UTC, not a locale-dependent time',()=>{
 assert.equal(hourKeyFromDate(new Date('2026-10-09T14:41:24.789Z')),hourKey);
 assert.equal(previousHourKey(new Date('2026-10-09T15:12:00.000Z')),hourKey);
 assert.equal(hourStart(hourKey).toISOString(),'2026-10-09T14:00:00.000Z');
 assert.throws(()=>hourStart('20261309T1400Z'));
 assert.throws(()=>hourStart('20261009T1430Z'));
 assert.match(auditReceiptPath(hourKey),/2026[/\\]10[/\\]09[/\\]20261009T1400Z\.json$/);
});
test('successful scheduler and machine observation never fabricate qualified T0 tick',()=>{
 const rows=parseCycleHistory(JSON.stringify(observation)+'\n');
 const r=assessHour({hourKey,cycleHistory:rows,workflowRuns:[run],checkedAt:when});
 assert.equal(r.observationStatus,'persisted');
 assert.equal(r.observation.qualifiedTrialTick,false);
 assert.equal(r.observation.tradabilityValidated,249);
 assert.equal(r.schedulerRunsCreatedInHour.length,1);
 assert.deepEqual(r.issues,[]);
 assert.equal(r.observation.sourceLineSha256.length,64);
});
test('missing hour is recorded as missing, not reconstructed',()=>{
 const r=assessHour({hourKey,cycleHistory:[],workflowRuns:[run],checkedAt:when});
 assert.equal(r.observationStatus,'missing_as_of_audit');
 assert.equal(r.observation,null);
 assert.ok(r.issues.includes('no_persisted_observation_for_hour_as_of_audit'));
 assert.ok(!r.issues.includes('no_scheduler_run_created_in_slot'));
});
test('scheduler failure is visible separately from persisted evidence',()=>{
 const r=assessHour({hourKey,cycleHistory:[],workflowRuns:[{...run,conclusion:'failure'}],checkedAt:when});
 assert.ok(r.issues.includes('scheduler_failed_or_timed_out'));
 assert.ok(r.issues.includes('no_persisted_observation_for_hour_as_of_audit'));
});
test('unavailable actions API must not be misrepresented as no runs',()=>{
 const r=assessHour({hourKey,cycleHistory:[],workflowRuns:[],checkedAt:when,runLookupError:'403'});
 assert.ok(r.issues.includes('scheduler_run_lookup_unavailable'));
 assert.ok(!r.issues.includes('no_scheduler_run_created_in_slot'));
 assert.equal(r.schedulerLookup.status,'unavailable');
});
test('duplicate history and partial observations surface explicit errors',()=>{
 const line=JSON.stringify({...observation,cycleStatus:'partial',phase:'trial'})+'\n';
 const r=assessHour({hourKey,cycleHistory:parseCycleHistory(line+line),workflowRuns:[],checkedAt:when});
 assert.ok(r.issues.includes('duplicate_cycle_history_hour_key'));
 assert.ok(r.issues.includes('partial_machine_observation'));
 assert.ok(r.issues.includes('trial_hour_not_qualified'));
});
test('future or current incomplete hour cannot be attested',()=>{
 assert.throws(()=>assessHour({hourKey,cycleHistory:[],workflowRuns:[],checkedAt:'2026-10-09T14:58:00Z'}));
 assert.throws(()=>parseCycleHistory('not-json'));
});
test('no unrelated workflow is confused with the scheduler',()=>{
 const r=assessHour({hourKey,cycleHistory:[],workflowRuns:[{...run,path:'.github/workflows/earth2036-pages.yml'}],checkedAt:when});
 assert.ok(r.issues.includes('no_scheduler_run_created_in_slot'));
});
