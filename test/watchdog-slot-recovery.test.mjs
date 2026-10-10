import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Pure eligibility used to demonstrate the watchdog's three stop conditions.
// The workflow makes its decision using real GitHub runs and committed state.
function shouldDispatch({minute,stale,observed,created,active}) {
  if (minute < 20 && !stale) return false;
  if (observed || active || created) return false;
  return true;
}
test("missing scheduler after twenty minutes is eligible for one recovery",()=>{
  assert.equal(shouldDispatch({minute:22,stale:false,observed:false,active:false,created:false}),true);
  assert.equal(shouldDispatch({minute:42,stale:true,observed:false,active:false,created:false}),true);
});
test("no duplicate if source observation, queued action or current-hour attempt exists",()=>{
  assert.equal(shouldDispatch({minute:22,stale:false,observed:true,active:false,created:false}),false);
  assert.equal(shouldDispatch({minute:22,stale:false,observed:false,active:true,created:false}),false);
  assert.equal(shouldDispatch({minute:42,stale:true,observed:false,active:false,created:true}),false);
  assert.equal(shouldDispatch({minute:10,stale:false,observed:false,active:false,created:false}),false);
});
test("real workflow checks GitHub run list, canonical cycle key and retains fail-closed alerts",async()=>{
  const yaml=await readFile(new URL("../.github/workflows/earth2036-watchdog.yml",import.meta.url),"utf8");
  assert.match(yaml,/current_hour="\$\(date -u/);
  assert.match(yaml,/observed_hour="\$\(jq -r '\.cycleKey/);
  assert.match(yaml,/created_in_hour="\$\(jq -r --arg floor/);
  assert.match(yaml,/if \[ "\$active" != "0" \]/);
  assert.match(yaml,/Fail closed on unhealthy GitHub-native plane/);
  assert.match(yaml,/WORKGRAPH_CRITICAL/);
  assert.match(yaml,/gh workflow run earth2036-scheduler\.yml/);
});
