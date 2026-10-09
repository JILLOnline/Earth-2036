import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { auditObservedFilingChanges } from "../scripts/lib/source-delta-observation-audit.mjs";

const asOf = "2026-10-09T23:30:00.000Z";
const filing = (id, form="8-K", date="2026-10-09") =>
  ({accessionNumber:id,form,filingDate:date,primaryDocument:"x.htm"});
const source = (filings, fingerprint, status="observed") => ({
  status,filingFingerprint:fingerprint,filings,sourceUrl:"https://data.sec.gov/submissions/CIK0000000001.json"
});
const fixture = (entries, date="2026-10-09T22:00:00Z") =>
  ({capturedAt:date,candidates:Object.fromEntries(entries)});

test("unchanged hourly refresh never manufactures a source delta",()=>{
  const old=fixture([["AEVA",source([filing("001")],"identical")]]);
  const newer=fixture([["AEVA",{...source([filing("001")],"identical"),observedAt:asOf}]],asOf);
  const out=auditObservedFilingChanges(old,newer,asOf);
  assert.equal(out.summary.unchanged,1);
  assert.deepEqual(out.changes,[]);
  assert.equal(out.authority.workerActivation,false);
});
test("newly visible accession is logged but does not authorize reactivation or materiality",()=>{
  const old=fixture([["AEVA",source([filing("001")],"before")]]);
  const newer=fixture([["AEVA",source([filing("002"),filing("001")],"after")]],asOf);
  const out=auditObservedFilingChanges(old,newer,asOf);
  assert.equal(out.summary.changedWithAddedAccessions,1);
  assert.equal(out.changes[0].addedAccessions[0].accessionNumber,"002");
  assert.equal(out.changes[0].actionableWithoutIndependentReview,false);
  assert.equal(out.authority.scoreWrites,false);
  assert.equal(out.authority.workerActivation,false);
});
test("rolling window drops alone are NOT misreported as newly filed accessions",()=>{
  const old=fixture([["RIO",source([filing("002"),filing("001")],"before")]]);
  const newer=fixture([["RIO",source([filing("002")],"after")]],asOf);
  const out=auditObservedFilingChanges(old,newer,asOf);
  assert.equal(out.summary.changedWithoutAddedAccessions,1);
  assert.deepEqual(out.changes[0].addedAccessions,[]);
  assert.deepEqual(out.changes[0].droppedFromWindow,["001"]);
});
test("failure and recovery do not claim a real SEC filing change",()=>{
  const old=fixture([["RIO",source([filing("001")],"before")]]);
  const failed=fixture([["RIO",{...source([filing("001")],"before","failed"),error:"temporarily unavailable"}]],asOf);
  let out=auditObservedFilingChanges(old,failed,asOf);
  assert.equal(out.summary.retrievalFailed,1);
  assert.equal(out.changes[0].addedAccessions.length,0);
  out=auditObservedFilingChanges(failed,old,asOf);
  assert.equal(out.summary.recoveredObservation,1);
});
test("new SWKS member is bootstrap—not artificially changed company evidence",()=>{
  const out=auditObservedFilingChanges(fixture([]),fixture([["SWKS",source([filing("001")],"fresh")]],asOf),asOf);
  assert.equal(out.summary.initialOrUntrustedBaseline,1);
  assert.equal(out.summary.changedWithAddedAccessions,0);
});
test("fingerprint unchanged when accessions differ flags scanner inconsistency",()=>{
  const out=auditObservedFilingChanges(
    fixture([["AAA",source([filing("001")],"same")]]),
    fixture([["AAA",source([filing("002")],"same")]],asOf),asOf);
  assert.equal(out.summary.fingerprintMismatch,1);
  assert.equal(out.summary.changedWithAddedAccessions,0);
});
test("source-delta audit is attached to observation engine but NOT authority paths",async()=>{
  const engine=await readFile(new URL("../scripts/earth2036-engine.mjs",import.meta.url),"utf8");
  const delta=await readFile(new URL("../scripts/lib/source-delta-observation-audit.mjs",import.meta.url),"utf8");
  assert.match(engine,/auditObservedFilingChanges\(previousObservations/);
  assert.match(engine,/adaptation", "source-change-audit\.json"/);
  assert.doesNotMatch(delta,/github.*write|promoteChief|writeScoreRecord/);
  assert.match(delta,/workerActivation: false/);
  assert.match(delta,/actionableWithoutIndependentReview: false/);
});
