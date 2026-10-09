import test from "node:test";
import assert from "node:assert/strict";
import { buildAssistRequests } from "../scripts/lib/assist-bus.mjs";
import { buildRoutingQueues } from "../scripts/lib/workgraph-v2.mjs";

// These tests protect source acquisition without allowing an unsourced
// contradiction to be adjudicated, cleared, or promoted.
function context(contradictions) {
  const ticker = "FICT";
  return {
    graph: {companies: {[ticker]: {ticker, state:"researching", workId:"t0:"+ticker}}},
    packet: {
      ticker, workId:"t0:"+ticker, sourceState:"researching",
      evidencePaths:["data/runtime/workgraph/evidence/FICT-existing.json"],
      contradictions,
      preflight:{
        passed:false,
        failures:["unresolved_material_contradiction"],
        routing:[{failure:"unresolved_material_contradiction",owner:"deep-resolver"}]
      },
    },
  };
}
function sourceAssist(graph, packet) {
  return buildAssistRequests(graph, [packet], [], "2026-10-09T22:00:00.000Z", null, {
    lifecycleEnabled:true,
    frontierTickers:["FICT"],
    operationalStatusByTicker:{FICT:"needs_contradiction_resolution"},
  }).requests.filter(x=>x.helperRole==="earth-scout" && x.capability==="contradiction-source-support");
}
test("owner-only vague material issue routes to Scout for source evidence, never Resolver", ()=>{
  const {graph,packet}=context([{nextOwner:"deep-resolver",contradiction:"Opportunity might outpace commercialization",material:true}]);
  const assist=sourceAssist(graph,packet);
  assert.equal(assist.length,1);
  assert.equal(assist[0].rootOwner,"deep-resolver");
  assert.equal(assist[0].status,"active");
  assert.match(assist[0].exactQuestion,/claim\/source context/);
  const route=buildRoutingQueues(graph,[packet],"2026-10-09T22:00:00.000Z",{
    frontierFirst:true,frontierTickers:["FICT"],stalledTickers:[],
    operationalStatusByTicker:{FICT:"needs_contradiction_resolution"}
  });
  assert.equal(route["deep-resolver"].total,0);
  assert.equal(route["deep-resolver"].deferred,1);
});
test("already source-addressed claim pair can go to Resolver without duplicate Scout contradiction assist",()=>{
  const {graph,packet}=context([{
    nextOwner:"deep-resolver",
    claimA:"The company reported 100 units",claimB:"The same filing reported 80 units",
    sourceA:"issuer:FICT:q3",material:true
  }]);
  assert.equal(sourceAssist(graph,packet).length,0);
  const route=buildRoutingQueues(graph,[packet],"2026-10-09T22:00:00.000Z",{
    frontierFirst:true,frontierTickers:["FICT"],stalledTickers:[],
    operationalStatusByTicker:{FICT:"needs_contradiction_resolution"}
  });
  assert.equal(route["deep-resolver"].total,1);
  assert.equal(route["deep-resolver"].items[0].adjudicationPacket.actionable,true);
});
