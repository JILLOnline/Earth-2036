import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSourceDependencyHandoffs } from "../scripts/lib/source-dependency-handoff.mjs";

const time = "2026-10-09T23:40:00.000Z";
function candidate(ticker,state="packet_ready",sourcePath="Compare normalized margins in new quarterly primary results"){
  return {
    row: {ticker,state,workId:"t0:"+ticker},
    packet: {
      ticker,workId:"t0:"+ticker,evidencePaths:["data/runtime/workgraph/evidence/"+ticker+"-baseline.json"],
      gatingIssues:[{issue:"unresolved_material_contradiction",defect:"Margin durability remains unproven without normalization for temporary receipts.",nextLawfulEvidencePath:sourcePath}],
      unknowns:[{unknown:"Post-refund normalized margins and underlying price-mix and volumes remain unproven.",gating:true}],
      preflight:{passed:false,failures:["unresolved_material_contradiction","unresolved_gating_unknown"],routing:[{owner:"deep-resolver",failure:"unresolved_material_contradiction"}]}
    },
    resolver:{
      ticker,deferred:true,adjudicationPacket:{
        actionable:false,deferredItemCount:1,
        deferredItems:[{exactMissingFact:"Two attributable issuer claims about post-refund margins and physical-volume changes."}]
      }
    }
  };
}
function run(cs,limit=1){
 return buildSourceDependencyHandoffs(
  {companies:Object.fromEntries(cs.map(c=>[c.row.ticker,c.row]))},
  cs.map(c=>c.packet),
  {deferredItems:cs.map(c=>c.resolver)},
  time,{maxPilotCases:limit}
 );
}
test("one packet-ready MWA source dependency is selected before research-only AEVA",()=>{
 const j=run([candidate("AEVA","researching"),candidate("MWA")]);
 assert.equal(j.selected.length,1);
 assert.equal(j.selected[0].ticker,"MWA");
 assert.equal(j.deferred.length,1);
 assert.equal(j.deferred[0].ticker,"AEVA");
 assert.match(j.selected[0].nextLawfulSourcePaths[0],/Compare normalized margins/);
 assert.equal(j.selected[0].taskExecutionAuthorized,false);
 assert.equal(j.automaticWorkerActivation,false);
 assert.equal(j.canonicalWriteAuthority,false);
});
test("insufficient two-sided claims cannot become an actionable Resolver case or clearance",()=>{
 const j=run([candidate("MWA")]);
 assert.equal(j.selected[0].isActionableResolverContradiction,false);
 assert.equal(j.selected[0].sourceMaterialityVerified,false);
 assert.equal(j.selected[0].status,"awaiting_verified_source_and_worker_clearance");
 assert.equal(j.selected[0].noRepeatUntilChangedInput,true);
 assert.match(j.prohibition,/No automatic restart/);
});
test("no pending dependency when Resolver already has an independently sourced pair",()=>{
 const c=candidate("MWA");c.resolver.adjudicationPacket.actionable=true;
 assert.equal(run([c]).totalCandidates,0);
});
test("no unsafe dependency for canonical or blocked companies and missing material gate",()=>{
 const c=candidate("MWA"); c.row.state="canonical";
 assert.equal(run([c]).totalCandidates,0);
 c.row.state="packet_ready"; c.packet.preflight.failures=["missing_factor_evidence"];
 assert.equal(run([c]).totalCandidates,0);
});
test("unchanged packet evidence produces exactly stable dependency signature, without timestamps or mass wake",()=>{
 const a=run([candidate("MWA")]);
 const b=buildSourceDependencyHandoffs(
 {companies:{MWA:candidate("MWA").row}},[candidate("MWA").packet],
 {deferredItems:[candidate("MWA").resolver]},"2026-10-10T00:40:00Z",
 {maxPilotCases:1});
 assert.equal(a.selected[0].signature,b.selected[0].signature);
 const newer=candidate("MWA");newer.packet.evidencePaths.push("new-verified-source.json");
 assert.notEqual(run([newer]).selected[0].signature,a.selected[0].signature);
});
test("source dependency report is saved independently of source and worker authority",async()=>{
 const sync=await readFile(new URL("../scripts/workgraph-sync.mjs",import.meta.url),"utf8");
 assert.match(sync,/source-dependency-handoffs\.json/);
 assert.match(sync,/maxPilotCases: 1/);
 assert.match(sync,/taskExecutionAuthorized: x\.taskExecutionAuthorized/);
});
