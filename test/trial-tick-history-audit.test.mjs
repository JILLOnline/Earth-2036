import test from "node:test";
import assert from "node:assert/strict";
import {auditTrialTickHistory} from "../scripts/lib/trial-tick-history-audit.mjs";
const input=(n=2)=>({state:{qualifiedTrialTicks:n,lastQualifiedCycleKey:n?"20261009T2300Z":null,phase:"trial"},
manifest:{qualifiedTrialTicksAfterBaseline:n},
ticks:n?[{tickNumber:1,cycleKey:"20261009T2200Z"},{tickNumber:2,cycleKey:"20261009T2300Z"}].slice(0,n):[]});
test("clean two-tick history passes",()=>assert.equal(auditTrialTickHistory(input()).passed,true));
test("zero-tick T0 has no synthetic history",()=>assert.equal(auditTrialTickHistory(input(0)).passed,true));
test("crash after tick JSON but before count increments fails closed",()=>{
 const x=input(0);x.ticks=[{tickNumber:1,cycleKey:"20261009T2300Z"}];
 assert.ok(auditTrialTickHistory(x).errors.includes("immutable_tick_file_count_mismatch"));
});
test("crash after count increment but missing tick fails closed",()=>{
 const x=input();x.ticks.pop();
 assert.ok(auditTrialTickHistory(x).errors.includes("immutable_tick_file_count_mismatch"));
});
test("counter disagreement blocks",()=>{const x=input();x.manifest.qualifiedTrialTicksAfterBaseline=1;assert.equal(auditTrialTickHistory(x).passed,false)});
test("conflicting or duplicate cycles block",()=>{const x=input();x.ticks[1].cycleKey=x.ticks[0].cycleKey;assert.equal(auditTrialTickHistory(x).passed,false)});
test("terminal count must have matching phase and manifest",()=>{
 const x={state:{qualifiedTrialTicks:1000,lastQualifiedCycleKey:"20261009T2300Z",phase:"trial"},manifest:{qualifiedTrialTicksAfterBaseline:1000},ticks:[]};
 assert.ok(auditTrialTickHistory(x).errors.includes("trial_terminal_phase_inconsistent"));
});

test("trial receipts cannot pass with an explicitly unpublished T0",()=>{
 const x=input();
 x.manifest.published=false;
 assert.ok(auditTrialTickHistory(x).errors.includes("unpublished_baseline_has_qualified_ticks"));
});
test("qualified trial receipts cannot belong to baseline phase",()=>{
 const x=input();
 x.state.phase="official_t0_baseline";
 assert.ok(auditTrialTickHistory(x).errors.includes("qualified_ticks_while_still_in_baseline_phase"));
});
