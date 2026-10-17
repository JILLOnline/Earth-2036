import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {classifyPushChanges,decidePublication,isPublicInput} from "../scripts/lib/pages-publication-policy.mjs";

const old="a".repeat(40),current="b".repeat(40);
const manifest={sourceSha:old,sourceBranch:"main",authority:"JILLOnline/Earth-2036@main",host:"github-pages"};

test("operational-only commits never rebuild GitHub Pages",()=>{
  const result=classifyPushChanges(["data/operations/phoenix/events.jsonl","data/operations/hourly-audits/2026/10/17/x.json","docs/PHOENIX_ROLLOUT.md",".github/workflows/earth2036-hourly-accountability.yml","test/phoenix-pages-policy.test.mjs","scripts/phoenix-journal.mjs","scripts/lib/pages-publication-policy.mjs"]);
  assert.equal(result.needed,false);
});
test("every real source, app, data, config, baseline or Pages workflow change rebuilds",()=>{
  const paths=["app/page.tsx","lib/dashboard-runtime.ts","data/runtime/system-state.json","data/runtime/workgraph/metrics.json","data/baseline-evidence/ABC.json","engine/methodology.ts","config/closure-engine-v1.json","public/images/logo.svg","scripts/prepare-live-public.mjs","next.config.mjs","package.json",".github/workflows/earth2036-pages.yml"];
  for(const path of paths)assert.equal(isPublicInput(path),true,path);
});
test("unknown files fail open, but explicitly non-public files skip",()=>{
  assert.equal(isPublicInput("other/future-dependency.txt"),true);
  assert.equal(isPublicInput("data/operations/phoenix/current.json"),false);
  assert.equal(isPublicInput("data/runtime/workgraph/evidence/ABC.json"),true);
});
test("missing or invalid public manifest requires publishing",()=>{
  assert.equal(decidePublication({targetSha:current,manifest:null}).needed,true);
  assert.equal(decidePublication({targetSha:current,manifest:{...manifest,host:"not-github-pages"}}).needed,true);
});
test("same verified published SHA does not redeploy",()=>{
  assert.equal(decidePublication({targetSha:old,manifest}).needed,false);
});
test("valid published SHA with verified nonpublic diff skips despite different commit SHA",()=>{
  const outcome=decidePublication({targetSha:current,manifest,changedPaths:["data/operations/phoenix/events.jsonl","test/x.test.mjs"],diffVerified:true});
  assert.equal(outcome.needed,false);
  assert.equal(outcome.reason,"operational_only_commits");
});
test("actual Pages source change always publishes",()=>{
  const outcome=decidePublication({targetSha:current,manifest,changedPaths:["data/runtime/system-state.json","data/operations/phoenix/current.json"],diffVerified:true});
  assert.equal(outcome.needed,true);
  assert.deepEqual(outcome.relevantPaths,["data/runtime/system-state.json"]);
});
test("incomplete or failed diff fails open to publish",()=>{
  const outcome=decidePublication({targetSha:current,manifest,changedPaths:[],diffVerified:false});
  assert.equal(outcome.needed,true);
  assert.equal(outcome.reason,"source_diff_unverified");
});
test("unknown SHA cannot authorize a skip",()=>{
  assert.throws(()=>decidePublication({targetSha:"main",manifest}),/invalid_publication_target_sha/);
});
test("input compare fingerprint is repeatable without timestamps",()=>{
  const a=decidePublication({targetSha:current,manifest,changedPaths:["docs/x.md"],diffVerified:true});
  const b=decidePublication({targetSha:current,manifest,changedPaths:["docs/x.md"],diffVerified:true});
  assert.deepEqual(a,b);
});
test("CI, watchdog, and Workgraph use provenance guard rather than event HEAD",async()=>{
  const ci=await readFile(new URL("../.github/workflows/earth2036-ci.yml",import.meta.url),"utf8");
  const watcher=await readFile(new URL("../.github/workflows/earth2036-watchdog.yml",import.meta.url),"utf8");
  const graph=await readFile(new URL("../.github/workflows/earth2036-workgraph-reconcile.yml",import.meta.url),"utf8");
  assert.match(ci,/pages-publication-needed\.mjs --mode push/);
  assert.match(watcher,/pages-publication-needed\.mjs --mode live/);
  assert.match(graph,/pages-publication-needed\.mjs --mode live/);
  assert.doesNotMatch(watcher,/if \[ "\$pages_head" != "\$main_head" \]/);
});
