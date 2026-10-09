import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { loadStructuredEvidence, holdPacketForEvidenceQuarantine } from "../scripts/lib/workgraph-v2.mjs";

test("malformed worker evidence is file-atomically quarantined while unrelated valid source records remain readable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "earth2036-quarantine-"));
  const dir = path.join(root, "data/runtime/workgraph/evidence");
  const bad = '{"ticker":"VRTX","role":"council-alpha", "components":';
  const valid = JSON.stringify({
    ticker:"SAFE",role:"earth-scout",perspective:"source-integrity",
    generatedAt:"2026-10-09T22:00:00Z",
    sources:[{sourceId:"sec:safe:filing",url:"https://www.sec.gov/Archives/edgar/data/123/filing",primary:true}],
  });
  try {
    await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,"VRTX-20260927T211225Z-council-alpha.json"),bad);
    await writeFile(path.join(dir,"SAFE-20261009T220000Z-earth-scout.json"),valid);
    const quarantine = [];
    const rows = await loadStructuredEvidence(root,quarantine);
    assert.equal(rows.length,1);
    assert.equal(rows[0].ticker,"SAFE");
    assert.equal(quarantine.length,1);
    assert.equal(quarantine[0].ticker,"VRTX");
    assert.equal(quarantine[0].reason,"worker_evidence_parse_or_normalization_failure");
    assert.equal(quarantine[0].sha256,createHash("sha256").update(bad).digest("hex"));
    assert.equal(await readFile(path.join(dir,"VRTX-20260927T211225Z-council-alpha.json"),"utf8"),bad);
    const packet = {ticker:"VRTX",preflight:{passed:true,failures:[],routing:[]}};
    const held = holdPacketForEvidenceQuarantine(packet,quarantine);
    assert.equal(held.preflight.passed,false);
    assert.deepEqual(held.preflight.failures,["invalid_worker_evidence_artifact"]);
    assert.equal(held.preflight.routing[0].owner,"machine");
    assert.equal(packet.preflight.passed,true); // Caller evidence is not silently rewritten
    const unaffected = holdPacketForEvidenceQuarantine({...packet,ticker:"SAFE"},quarantine);
    assert.equal(unaffected.preflight.passed,true);
  } finally {
    await rm(root,{recursive:true,force:true});
  }
});
test("unknown-ticker malformed worker evidence holds EVERY candidate until provenance is identified",()=>{
  const unknown=[{path:"data/runtime/workgraph/evidence/malformed.json",ticker:null}];
  assert.equal(holdPacketForEvidenceQuarantine({ticker:"SAFE",preflight:{passed:true,failures:[],routing:[]}},unknown).preflight.passed,false);
});
test("valid packet with existing failures receives exactly one quarantine failure, no false chief readiness",()=>{
  const corrupt=[{path:"bad.json",ticker:"VRTX"}];
  const original={ticker:"VRTX",preflight:{passed:false,failures:["missing_factor_evidence","invalid_worker_evidence_artifact"],routing:[]}};
  const result=holdPacketForEvidenceQuarantine(original,corrupt);
  assert.deepEqual(result.preflight.failures,["missing_factor_evidence","invalid_worker_evidence_artifact"]);
  assert.equal(result.preflight.passed,false);
  assert.equal(result.quarantinedEvidencePaths[0],"bad.json");
});
test("observation scheduler no longer makes strict artifact JSON validation an upstream machine prerequisite",async()=>{
  const scheduler=await readFile(new URL("../.github/workflows/earth2036-scheduler.yml",import.meta.url),"utf8");
  const strict=await readFile(new URL("../test/evidence-json-integrity.test.mjs",import.meta.url),"utf8");
  const finalizer=await readFile(new URL("../scripts/finalize-qualified-tick.mjs",import.meta.url),"utf8");
  const sync=await readFile(new URL("../scripts/workgraph-sync.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(scheduler,/node --test[^\n]*evidence-json-integrity\.test\.mjs/);
  assert.match(strict,/every persisted Workgraph evidence artifact is valid JSON/);
  assert.match(sync,/holdPacketForEvidenceQuarantine\(/);
  assert.match(sync,/evidence-quarantine\.json/);
  assert.match(finalizer,/quarantined_worker_evidence/);
  assert.match(finalizer,/no_t0_publication_or_trial_tick;machine_observation_can_persist/);
});
