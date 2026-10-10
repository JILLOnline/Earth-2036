import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPersistedHourlyObservation as check} from '../scripts/check-hourly-observation.mjs';

const key='20261010T1800Z';
const row={cycleKey:key,lastCycleAt:'2026-10-10T18:18:28.539Z',cycleStatus:'completed',companiesObserved:250};

test('repeated eligible GitHub cron triggers never regenerate a committed observation',()=>{
 const s=check(JSON.stringify(row)+'\n',key);
 assert.equal(s.shouldRun,false);
 assert.equal(s.reason,'persisted_original_observation_exists');
 assert.equal(s.observation.status,'completed');
});
test('partial hourly record remains historical truth: do not forge its replacement',()=>{
 const s=check(JSON.stringify({...row,cycleStatus:'partial',companiesObserved:248})+'\n',key);
 assert.equal(s.shouldRun,false);
 assert.equal(s.observation.status,'partial');
});
test('fresh UTC hour is actionable without inventing old or neighboring hours',()=>{
 const s=check(JSON.stringify(row)+'\n','20261010T1900Z');
 assert.equal(s.shouldRun,true);
 assert.equal(s.observation,null);
});
test('rejects duplicate hourly records and corrupt history instead of running',()=>{
 assert.throws(()=>check(JSON.stringify(row)+'\n'+JSON.stringify(row)+'\n',key),/duplicate_immutable/);
 assert.throws(()=>check(JSON.stringify(row)+'\n{broken',key),/corrupt_cycle_history/);
});
test('invalid or nonexistent UTC hours fail closed',()=>{
 for(const candidate of ['20261010T2400Z','20260230T1300Z','20261010T1801Z', 'bad']){
  assert.throws(()=>check('',candidate),/invalid_/);
 }
});
