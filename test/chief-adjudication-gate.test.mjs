import test from "node:test";
import assert from "node:assert/strict";
import {createHash,generateKeyPairSync,sign} from "node:crypto";
import {readFile} from "node:fs/promises";
import {
  authorizeChiefPromotion,chiefSignableFields,CHIEF_AUTHORITY_CONTRACT,
  CHIEF_DECISION_CONTRACT,CHIEF_SIGNING_POLICY
} from "../scripts/lib/chief-adjudication-gate.mjs";

const {publicKey,privateKey}=generateKeyPairSync("ed25519");
const publicKeyPem=publicKey.export({type:"spki",format:"pem"});
const authority=()=>({
  contract:CHIEF_AUTHORITY_CONTRACT,version:1,
  role:"chief-earth",policy:CHIEF_SIGNING_POLICY,enabled:true,
  keyId:"fixture-only-ed25519",publicKeyPem
});
const packet=()=>({ticker:"AEVA",workId:"t0:AEVA",
  generatedAt:"2026-10-17T12:00:00.000Z",preflight:{passed:true}});
const body=()=>JSON.stringify(packet(),null,2)+"\n";
const now="2026-10-17T16:00:00.000Z";
function signed(raw=body(),p=packet(),overrides={}){
  const decision={
    contract:CHIEF_DECISION_CONTRACT,version:1,keyId:authority().keyId,
    role:"chief-earth",action:"accept",ticker:p.ticker,workId:p.workId,
    packetSha256:createHash("sha256").update(raw).digest("hex"),
    packetGeneratedAt:p.generatedAt,approvedAt:"2026-10-17T14:00:00.000Z",
    expiresAt:"2026-10-18T14:00:00.000Z",...overrides
  };
  decision.signature=sign(null,Buffer.from(JSON.stringify(chiefSignableFields(decision))),privateKey).toString("base64");
  return decision;
}
const allow=(data={})=>authorizeChiefPromotion({
  packet:packet(),packetBytes:body(),authority:authority(),decision:signed(),now,...data,
});

test("signed exact preflight-passed packet can pass Chief gate in isolated fixture",()=>{
  const verdict=allow();
  assert.equal(verdict.approved,true);
  assert.equal(verdict.approvalProof.packetSha256,createHash("sha256").update(body()).digest("hex"));
  assert.equal(verdict.approvalProof.role,"chief-earth");
});
test("repository default authority is uncommissioned and cannot approve",async()=>{
  const config=JSON.parse(await readFile(new URL("../config/chief-adjudication-authority.json",import.meta.url),"utf8"));
  assert.equal(config.enabled,false);
  assert.equal(config.publicKeyPem,null);
  const result=allow({authority:config});
  assert.equal(result.approved,false);
  assert.equal(result.reason,"chief_signing_authority_not_commissioned");
});
test("missing signed record is a hard hold even if preflight passed",()=>{
  const v=allow({decision:null});
  assert.equal(v.approved,false);
  assert.equal(v.reason,"chief_signed_adjudication_missing");
});
test("uncommissioned authority denies even a valid-looking signed decision",()=>{
  const v=allow({authority:{...authority(),enabled:false}});
  assert.equal(v.approved,false);
});
test("unsigned JSON cannot become an approval by listing the Chief role",()=>{
  const d=signed();delete d.signature;
  const v=allow({decision:d});
  assert.equal(v.approved,false);
});
test("different packet source bytes invalidate formerly valid approval",()=>{
  const v=allow({packetBytes:body()+" "});
  assert.equal(v.reason,"chief_packet_digest_mismatch");
});
test("stale packet generation timestamp in record fails identity binding",()=>{
  const v=allow({decision:signed(body(),packet(),{packetGeneratedAt:"2026-10-16T12:00:00.000Z"})});
  assert.equal(v.reason,"chief_packet_digest_mismatch");
});
test("wrong ticker or work ID never authorizes unrelated companies",()=>{
  assert.equal(allow({decision:signed(body(),packet(),{ticker:"SWKS"})}).approved,false);
  assert.equal(allow({decision:signed(body(),packet(),{workId:"t0:SWKS"})}).approved,false);
});
test("wrong trusted key ID cannot authorize a Chief decision",()=>{
  assert.equal(allow({authority:{...authority(),keyId:"another-principal"}}).reason,"chief_decision_identity_or_action_mismatch");
});
test("signature from another Ed25519 key fails even with same claims",()=>{
  const d=signed();
  const alternate=generateKeyPairSync("ed25519");
  d.signature=sign(null,Buffer.from(JSON.stringify(chiefSignableFields(d))),alternate.privateKey).toString("base64");
  assert.equal(allow({decision:d}).reason,"chief_signature_verification_failed");
});
test("changing action after signature creation fails signature check",()=>{
  const d=signed();d.action="reject";
  assert.equal(allow({decision:d}).approved,false);
});
test("authentically signed rejection is still not promotion authority",()=>{
  const d=signed(body(),packet(),{action:"reject"});
  assert.equal(allow({decision:d}).reason,"chief_explicitly_rejected_packet");
});
test("expired, future and excessively long approval windows fail",()=>{
  assert.equal(allow({now:"2026-10-19T14:00:00Z"}).reason,"chief_decision_time_window_invalid");
  assert.equal(allow({decision:signed(body(),packet(),{approvedAt:"2026-10-18T15:00:00Z"})}).reason,"chief_decision_time_window_invalid");
  assert.equal(allow({decision:signed(body(),packet(),{expiresAt:"2026-10-28T14:00:00Z"})}).reason,"chief_decision_time_window_invalid");
});
test("decision predating exact packet is never accepted",()=>{
  assert.equal(allow({decision:signed(body(),packet(),{approvedAt:"2026-10-17T11:00:00.000Z"})}).reason,"chief_decision_time_window_invalid");
});
test("preflight failure cannot be approved even with a valid signature",()=>{
  assert.equal(allow({packet:{...packet(),preflight:{passed:false}}}).reason,"invalid_preflight_passed_packet");
});
test("non-Ed25519 signing keys cannot commission the authority",()=>{
  const rsa=generateKeyPairSync("rsa",{modulusLength:2048});
  const pub=rsa.publicKey.export({type:"spki",format:"pem"});
  assert.equal(allow({authority:{...authority(),publicKeyPem:pub}}).reason,"chief_signing_key_type_not_ed25519");
});
test("Chief gate runs before canonical writer while independent Beast audit remains",async()=>{
  const script=await readFile(new URL("../scripts/promote-chief-ready.mjs",import.meta.url),"utf8");
  const decision=script.indexOf("authorizeChiefPromotion({");
  const writer=script.indexOf("await writeJson(path.join(BASELINE,");
  const beast=script.indexOf("auditScoreRecord(record, causal.graph)");
  assert.ok(decision>0 && beast>decision && writer>beast);
  assert.match(script,/chief_adjudication_required_no_automatic_promotion/);
  assert.match(script,/chiefApproval:chiefGate.approvalProof/);
  assert.match(script,/const chiefAuthority=await readJson\(CHIEF_AUTHORITY,null\)/);
  const cycle=await readFile(new URL("../scripts/earth2036-cycle.mjs",import.meta.url),"utf8");
  assert.match(cycle,/scripts\/promote-chief-ready\.mjs/);
  const reconcile=await readFile(new URL("../.github/workflows/earth2036-workgraph-reconcile.yml",import.meta.url),"utf8");
  assert.match(reconcile,/node scripts\/promote-chief-ready\.mjs/);
});
