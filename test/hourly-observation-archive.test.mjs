import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHourlyObservationArchive} from '../scripts/archive-hourly-observation.mjs';

const state={
 phase:'trial',cycleKey:'20261009T1400Z',lastCycleAt:'2026-10-09T14:41:24Z',
 methodologyVersion:'1.0.0',universeVersion:'u1-250',
 companiesObserved:250,identityValidated:250,tradabilityValidated:250,
 scoredCompanies:250,publishableCompanies:250,
 unresolvedEvidence:3,machineSourceCoverageRatio:1,
 supervisorSourceCoverageRatio:0.92,combinedSourceCoverageRatio:0.92,
 discoveryScanCompleted:true,qualifiedTick:false,qualifiedTrialTicks:17
};
const observations={candidates:{
 RKLB:{ticker:'RKLB',status:'observed',observedAt:'2026-10-09T14:41:24Z',
  cik:'0001819994',filingFingerprint:'abc',filings:[{accessionNumber:'SEC-1',filingDate:'2026-10-02'}]},
 X:{ticker:'X',status:'unavailable',observedAt:'2026-10-09T14:41:24Z',
  cik:null,filingFingerprint:null,filings:[]}
}};
const health={sources:[{id:'sec-company-tickers',status:'healthy',coverage:1,requiredForTick:true}]};
const hashes={systemState:'a'.repeat(64),companyObservations:'b'.repeat(64),sourceHealth:'c'.repeat(64)};

test('No post-T0 history before baseline publication',()=>{
 assert.equal(buildHourlyObservationArchive({state:{...state,phase:'official_t0_baseline'},manifest:{published:false},observations,sourceHealth:health,rawHashes:hashes}),null);
 assert.equal(buildHourlyObservationArchive({state,manifest:{published:false},observations,sourceHealth:health,rawHashes:hashes}),null);
});
test('Unqualified trial hours still archive truthful observations and source hashes',()=>{
 const r=buildHourlyObservationArchive({state,manifest:{published:true},observations,sourceHealth:health,rawHashes:hashes});
 assert.equal(r.cycleKey,'20261009T1400Z');
 assert.equal(r.qualifiedTrialTick,false);
 assert.equal(r.qualifiedTrialCount,17);
 assert.equal(r.archiveCandidateCount,2);
 assert.equal(r.candidates.RKLB.filingFingerprint,'abc');
 assert.equal(r.candidates.RKLB.latestFilingAccession,'SEC-1');
 assert.equal(r.candidates.X.status,'unavailable');
 assert.equal(r.rawFileHashes.companyObservations,'b'.repeat(64));
 assert.equal(r.sourceHealth[0].requiredForTick,true);
 assert.equal(r.authority,'observation-only-nonqualifying-history');
});
test('Qualified-trial flag can be mirrored but does not increment tick state',()=>{
 const s={...state,qualifiedTick:true,qualifiedTrialTicks:18};
 const r=buildHourlyObservationArchive({state:s,manifest:{published:true},observations,sourceHealth:health,rawHashes:hashes});
 assert.equal(r.qualifiedTrialTick,true);
 assert.equal(r.qualifiedTrialCount,18);
 assert.equal(s.qualifiedTrialTicks,18);
});
test('Invalid slot rejects archival rather than inventing an observation',()=>{
 assert.throws(()=>buildHourlyObservationArchive({state:{...state,cycleKey:'bad'},manifest:{published:true},observations,sourceHealth:health,rawHashes:hashes}));
});
