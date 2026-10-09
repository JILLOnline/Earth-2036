import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { determineTickFinalization } from "../scripts/lib/tick-authority.mjs";

const k="20261009T2300Z";
const args=(qualified=true)=>({
 cycleKey:k,qualified,state:{qualifiedTrialTicks:4,lastQualifiedCycleKey:"20261009T2200Z"},
 manifest:{qualifiedTrialTicksAfterBaseline:4},existingTick:null,
});
test("only qualified finalizer gets exactly one next tick number",()=>{
 assert.deepEqual(determineTickFinalization(args()),{action:"finalize",tickNumber:5});
 assert.deepEqual(determineTickFinalization(args(false)),{action:"not_qualified",tickNumber:4});
});
test("replay with complete immutable tick is idempotent",()=>{
 const a={...args(),state:{qualifiedTrialTicks:5,lastQualifiedCycleKey:k},manifest:{qualifiedTrialTicksAfterBaseline:5},existingTick:{cycleKey:k,tickNumber:5}};
 assert.deepEqual(determineTickFinalization(a),{action:"already_finalized",tickNumber:5});
});
test("never overwrite conflicting / corrupted ticks or honor count mismatch",()=>{
 const base=args();
 for(const value of [
  {...base,existingTick:{cycleKey:k,tickNumber:3}},
  {...base,existingTick:{cycleKey:"20261009T2200Z",tickNumber:5}},
  {...base,state:{qualifiedTrialTicks:5,lastQualifiedCycleKey:k}},
  {...base,manifest:{qualifiedTrialTicksAfterBaseline:8}},
  {...base,state:{qualifiedTrialTicks:-1,lastQualifiedCycleKey:null}},
  {...base,cycleKey:"bad"},
 ]) assert.throws(()=>determineTickFinalization(value));
});
test("machine has zero independent trial-tick writer or qualification path",async()=>{
 const engine=await readFile(new URL("../scripts/earth2036-engine.mjs",import.meta.url),"utf8");
 const finalizer=await readFile(new URL("../scripts/finalize-qualified-tick.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(engine,/\bqualifiesTick\s*\(/);
 assert.doesNotMatch(engine,/path\.join\(RUNTIME_DIR, "ticks",/);
 assert.doesNotMatch(engine,/qualifiedTrialTicks\s*\+=/);
 assert.doesNotMatch(engine,/lastQualifiedCycleKey\s*=\s*thisCycle/);
 assert.match(finalizer,/determineTickFinalization\(/);
 assert.match(finalizer,/corrupt_or_unreadable_immutable_tick/);
 assert.match(finalizer,/qualified_tick_authority_integrity/);
});
