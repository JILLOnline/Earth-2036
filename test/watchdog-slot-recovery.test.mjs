import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Phase 6B: recovery is eligible only within the live hour, after enough
// time for normal schedule delivery, leaving at least 10 minutes before rollover.
function shouldDispatch({minute, observed, created, active}) {
  if (minute < 20 || minute > 50) return false;
  if (observed || active || created) return false;
  return true;
}
test("missing scheduler at 20..50 UTC minutes is eligible for one bounded current-hour recovery",()=>{
  assert.equal(shouldDispatch({minute:22,observed:false,active:false,created:false}),true);
  assert.equal(shouldDispatch({minute:42,observed:false,active:false,created:false}),true);
  assert.equal(shouldDispatch({minute:45,observed:false,active:false,created:false}),true);
  assert.equal(shouldDispatch({minute:50,observed:false,active:false,created:false}),true);
});
test("no duplicate if immutable source observation, queued job or current-hour attempt exists",()=>{
  assert.equal(shouldDispatch({minute:22,observed:true,active:false,created:false}),false);
  assert.equal(shouldDispatch({minute:22,observed:false,active:true,created:false}),false);
  assert.equal(shouldDispatch({minute:42,observed:false,active:false,created:true}),false);
});
test("early and late dispatches cannot misattribute a real UTC observation",()=>{
  for(const minute of [0,7,10,19,51,55,59])
    assert.equal(shouldDispatch({minute,observed:false,active:false,created:false}),false);
});
test("watchdog checks original immutable history, real run attempts and retains fail-closed alerts",async()=>{
  const yaml=await readFile(new URL("../.github/workflows/earth2036-watchdog.yml",import.meta.url),"utf8");
  assert.match(yaml,/current_hour="\$\(date -u/);
  assert.match(yaml,/cycle_history="\$\(gh api/);
  assert.match(yaml,/contents\/data\/runtime\/cycle-history\.jsonl/);
  assert.match(yaml,/observed_count="\$\(jq -s/);
  assert.match(yaml,/Duplicate immutable observations/);
  assert.match(yaml,/created_in_hour="\$\(jq -r --arg floor/);
  assert.match(yaml,/if \[ "\$active" != "0" \]/);
  assert.match(yaml,/Fail closed on unhealthy GitHub-native plane/);
  assert.match(yaml,/WORKGRAPH_CRITICAL/);
  assert.match(yaml,/gh workflow run earth2036-scheduler\.yml/);
});
test("independent completed workflows can invoke watchdog without creating a self-loop",async()=>{
  const yaml=await readFile(new URL("../.github/workflows/earth2036-watchdog.yml",import.meta.url),"utf8");
  assert.match(yaml,/workflow_run:\n\s+workflows:\n\s+- "Earth 2036 Closure Invariants"\n\s+- "Earth 2036 Hourly Accountability"/);
  assert.match(yaml,/types: \[completed\]/);
  assert.doesNotMatch(yaml,/\s+- "Earth 2036 Scheduler Watchdog"/);
});

test("independent CI and Workgraph completions add opportunities without Pages or self-trigger loops",async()=>{
  const yaml=await readFile(new URL("../.github/workflows/earth2036-watchdog.yml",import.meta.url),"utf8");
  const portion=yaml.slice(yaml.indexOf("  workflow_run:"),yaml.indexOf("  push:"));
  for(const upstream of [
    "Earth 2036 CI",
    "Earth 2036 Workgraph Reconcile",
    "Fundamentals Trajectory Bridge Live Bootstrap"
  ])assert.ok(portion.includes('- "'+upstream+'"'),upstream);
  assert.doesNotMatch(portion,/Earth 2036 Scheduler Watchdog/);
  assert.doesNotMatch(portion,/Earth 2036 GitHub Pages/);
  assert.match(portion,/types: \[completed\]/);
  assert.match(portion,/branches: \[main\]/);
});
test("recovery is attempted before optional Pages/Workgraph dependencies",async()=>{
  const yaml=await readFile(new URL("../.github/workflows/earth2036-watchdog.yml",import.meta.url),"utf8");
  const recovered=yaml.indexOf("- name: Recover a missing current-hour scheduler slot when idle");
  const published=yaml.indexOf("- name: Compare actual published Pages provenance");
  const freshness=yaml.indexOf("- name: Read machine and Workgraph freshness");
  assert.ok(recovered>0 && published>recovered && freshness>recovered);
  const block=yaml.slice(recovered,published);
  assert.match(block,/if: success\(\)/);
  assert.match(block,/minute\" -gt 50/);
  assert.match(block,/gh api "repos\/\$\{\{ github.repository \}\}\/contents\/data\/runtime\/cycle-history.jsonl\?ref=main"/);
  assert.match(block,/observed_count/);
  assert.match(block,/created_in_hour/);
  assert.match(block,/gh workflow run earth2036-scheduler\.yml/);
  assert.doesNotMatch(block,/steps\.freshness\.outputs/);
});
test("duplicate prevention includes original run attempts even if conclusion is failure",()=>{
  assert.equal(shouldDispatch({minute:49,observed:false,active:false,created:true}),false);
  assert.equal(shouldDispatch({minute:49,observed:true,active:false,created:false}),false);
  assert.equal(shouldDispatch({minute:49,observed:false,active:true,created:false}),false);
});
