import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_CONTROL_FLOOR,
  EXTERNAL_PROVIDER_CAP,
  assessEvidenceBundle,
  assessProviderDependency,
  dedupeEvidence,
  detectOutlier,
  sourceHealthScore,
  applyCorrection,
} from '../engine/evidence-fusion.mjs';
import { auditScoreRecord, auditSourceMesh, auditSystem } from '../engine/beast-integrity.mjs';

const NOW = '2026-09-13T04:00:00Z';
const base = {
  ticker: 'TEST', category: 'contract', eventType: 'award', eventDate: '2026-09-13T03:00:00Z',
  observedAt: '2026-09-13T03:00:00Z', maxAgeHours: 48, magnitude: .8, confidence: .9, reliability: .95, direction: 1,
};
const primary = (id, extra={}) => ({...base, id, sourceId:id, providerId:id, authority:'primary', controlDomain:'public_primary', originId:id, sourceFamily:'official', ...extra});
const vendor = (providerId, originId, extra={}) => ({...base, id:`${providerId}-${originId}`, sourceId:providerId, providerId, authority:'vendor', controlDomain:'external_vendor', originId, sourceFamily:'vendor', ...extra});

test('51/49 sovereignty constants are locked',()=>{ assert.equal(EARTH_CONTROL_FLOOR,.51); assert.equal(EXTERNAL_PROVIDER_CAP,.49); });
test('syndicated duplicates count once',()=>{ const rows=Array.from({length:10},(_,i)=>vendor(`wire${i}`, 'same-origin')); assert.equal(dedupeEvidence(rows,new Date(NOW)).length,1); });
test('one vendor cannot dominate decision influence',()=>{ const rows=[primary('sec',{magnitude:1,confidence:1,reliability:1}), ...Array.from({length:12},(_,i)=>vendor('mega-vendor',`v${i}`,{magnitude:1,confidence:1,reliability:1}))]; const result=assessProviderDependency(rows,new Date(NOW)); assert.equal(result.passed,false); assert.ok(result.maxExternalProviderShare>.49); });
test('public primary plus Earth-controlled evidence can preserve 51 percent control',()=>{ const rows=[primary('sec-1',{magnitude:1}),primary('usaspending-1',{magnitude:1}),vendor('provider-a','a',{magnitude:.5,confidence:.7,reliability:.7})]; const result=assessEvidenceBundle(rows,{now:NOW,minIndependentOrigins:2}); assert.equal(result.passed,true); assert.ok(result.sovereignShare>=.51); });
test('stale evidence fails closed',()=>{ const rows=[primary('sec-old',{observedAt:'2026-08-01T00:00:00Z',maxAgeHours:24})]; const result=assessEvidenceBundle(rows,{now:NOW}); assert.equal(result.passed,false); assert.ok(result.reasons.includes('all_evidence_stale')); });
test('provider outage crushes health score',()=>{ const healthy=sourceHealthScore({status:'healthy',coverage:1,lastSuccess:'2026-09-13T03:55:00Z',freshnessSlaHours:1,historicalReliability:.98,disagreementRate:.01},new Date(NOW)); const failed=sourceHealthScore({status:'failed',coverage:0,lastSuccess:'2026-09-12T00:00:00Z',freshnessSlaHours:1,historicalReliability:.98,disagreementRate:.01},new Date(NOW)); assert.ok(healthy.score>.85); assert.ok(failed.score<.4); });
test('material contradiction stays visible',()=>{ const rows=[primary('sec-pos',{direction:1}), primary('reg-neg',{direction:-1,category:'regulatory'})]; const result=assessEvidenceBundle(rows,{now:NOW,maxContradictionRatio:.2}); assert.equal(result.passed,false); assert.ok(result.reasons.includes('unresolved_material_contradiction')); });
test('many recycled blogs cannot outvote one primary origin',()=>{ const blogs=Array.from({length:20},(_,i)=>vendor(`blog${i}`,'same-blog-origin',{direction:-1,confidence:.8,reliability:.6})); const rows=[primary('sec-pos',{direction:1,magnitude:1,confidence:1,reliability:1}),...blogs]; const deduped=dedupeEvidence(rows,new Date(NOW)); assert.equal(deduped.length,2); });
test('four sigma numeric jump is quarantinable',()=>{ const history=[100,101,99,100.5,100.2,99.8].map((numericValue,i)=>({numericValue,id:String(i)})); const result=detectOutlier({numericValue:180},history); assert.equal(result.outlier,true); });
test('late entrant has no artificial age penalty in fusion layer',()=>{ const row=primary('new-listing',{observedAt:'2026-09-13T03:59:00Z'}); const result=assessEvidenceBundle([row],{now:NOW}); assert.equal(result.passed,true); });
test('correction preserves history and supersedes old record',()=>{ const history=[{id:'old',active:true,value:1}]; const next=applyCorrection(history,{id:'new',supersedesId:'old',observedAt:NOW,value:2}); assert.equal(next.length,2); assert.equal(next[0].active,false); assert.equal(next[0].supersededBy,'new'); assert.equal(next[1].active,true); });
test('premium vendor is never required to hold sovereignty',()=>{ const rows=[primary('sec'),primary('doe')]; const result=assessProviderDependency(rows,new Date(NOW)); assert.equal(result.passed,true); assert.equal(result.externalShare,0); });
test('external-only evidence cannot qualify a decision bundle',()=>{ const rows=[vendor('a','1'),vendor('b','2'),vendor('c','3')]; const result=assessEvidenceBundle(rows,{now:NOW}); assert.equal(result.passed,false); assert.ok(result.reasons.includes('earth_control_below_51')); });
test('independent-origin minimum blocks citation volume theater',()=>{ const rows=[primary('sec',{originId:'same'}),vendor('vendor-a','same'),vendor('vendor-b','same')]; const result=assessEvidenceBundle(rows,{now:NOW,minIndependentOrigins:2}); assert.equal(result.passed,false); assert.ok(result.reasons.includes('insufficient_independent_origins')); });
test('single vendor stays below 49 when diversified evidence dominates',()=>{ const rows=[primary('sec1',{magnitude:1}),primary('sec2',{magnitude:1}),primary('doe',{magnitude:1}),vendor('vendor-a','a',{magnitude:.5}),vendor('vendor-b','b',{magnitude:.5})]; const result=assessProviderDependency(rows,new Date(NOW)); assert.equal(result.passed,true); assert.ok(result.maxExternalProviderShare<=.49); });

const goodGraph = { nodes:[{id:'company:TEST'}], edges:[{from:'company:TEST',to:'market:x',strength:80,confidence:80,sourceIds:['s1']}], structuralSignals:[{subjectNodeId:'market:x',affectedNodeIds:['company:TEST'],sourceIds:['s1'],falsifier:'Demand reverses materially.'}] };
const goodScore = {
  ticker:'TEST', updatedAt:'2026-09-13T03:00:00Z', causalMapped:true, evidenceTier:'Iron',
  primarySourceUrls:['https://www.sec.gov/Archives/test'], independentSourceUrls:['https://www.reuters.com/test'],
  factorEvidence:{ thesisQuality:{ a:{value:80,sourceIds:['s1'],note:'supported'} } },
  riskEvidence:{ risk:{value:20,sourceIds:['s1'],note:'supported'} },
  dataConfidenceEvidence:{ coverage:{value:90,sourceIds:['s1'],note:'supported'} },
};

test('causalMapped boolean cannot bypass missing graph proof',()=>{ const r=auditScoreRecord(goodScore,{nodes:[],edges:[]},{now:NOW}); assert.equal(r.passed,false); assert.ok(r.reasons.includes('causal_flag_without_graph_proof')); });
test('causal edge without source ids fails provenance',()=>{ const graph={nodes:[{id:'company:TEST'}],edges:[{from:'company:TEST',to:'market:x',strength:80,confidence:80,sourceIds:[]}]}; const r=auditScoreRecord(goodScore,graph,{now:NOW}); assert.equal(r.passed,false); assert.ok(r.reasons.includes('causal_edges_without_provenance')); });
test('factor leaf without source ids fails provenance',()=>{ const bad={...goodScore,factorEvidence:{thesisQuality:{a:{value:80,sourceIds:[],note:'x'}}}}; const r=auditScoreRecord(bad,goodGraph,{now:NOW}); assert.equal(r.passed,false); assert.ok(r.reasons.includes('incomplete_factor_provenance')); });
test('well-sourced record with graph proof passes integrity',()=>{ const r=auditScoreRecord(goodScore,goodGraph,{now:NOW}); assert.equal(r.passed,true); assert.ok(r.sovereignShare>=.51); });
test('stale required machine source fails source mesh',()=>{ const health={sources:[{id:'sec',requiredForTick:true,status:'healthy',coverage:1,cadence:'hourly',authority:'primary',lastSuccess:'2026-09-12T20:00:00Z'}]}; const r=auditSourceMesh(health,null,{now:NOW}); assert.equal(r.passed,false); });
test('fresh required machine source passes source mesh',()=>{ const health={sources:[{id:'sec',requiredForTick:true,status:'healthy',coverage:1,cadence:'hourly',authority:'primary',lastSuccess:'2026-09-13T03:55:00Z'}]}; const r=auditSourceMesh(health,{coverageRatio:1,sources:[{id:'fda',requiredForCoverage:true,status:'healthy'}]},{now:NOW}); assert.equal(r.passed,true); });
test('system audit combines score proof and source mesh',()=>{ const health={sources:[{id:'sec',requiredForTick:true,status:'healthy',coverage:1,cadence:'hourly',authority:'primary',lastSuccess:'2026-09-13T03:55:00Z'}]}; const r=auditSystem({scoreState:{candidates:{TEST:goodScore}},graph:goodGraph,sourceHealth:health,automatedSourceHealth:null,evidenceQueue:{unresolved:0}},{now:NOW}); assert.equal(r.passed,true); assert.equal(r.scoreRecordsPassed,1); });
test('Diamond requires independent corroboration',()=>{ const row={...goodScore,evidenceTier:'Diamond',independentSourceUrls:[],primarySourceUrls:['https://www.sec.gov/a','https://www.sec.gov/b','https://www.sec.gov/c','https://www.sec.gov/d']}; const r=auditScoreRecord(row,goodGraph,{now:NOW}); assert.equal(r.passed,false); assert.ok(r.reasons.includes('high_tier_without_independent_corroboration')); });
test('Diamond requires sourced structural signal with falsifier',()=>{ const row={...goodScore,evidenceTier:'Diamond',primarySourceUrls:['https://www.sec.gov/a','https://www.sec.gov/b','https://www.sec.gov/c','https://www.sec.gov/d'],independentSourceUrls:['https://www.reuters.com/x']}; const graph={nodes:goodGraph.nodes,edges:goodGraph.edges,structuralSignals:[]}; const r=auditScoreRecord(row,graph,{now:NOW}); assert.equal(r.passed,false); assert.ok(r.reasons.includes('high_tier_without_structural_signal')); });
