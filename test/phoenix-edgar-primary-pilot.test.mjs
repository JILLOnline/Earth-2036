import test from "node:test";
import assert from "node:assert/strict";
import {selectPilotFilings,buildEdgarUrls,compareHeaderAcceptance} from "../scripts/phoenix-edgar-primary-pilot.mjs";
const row=(accessionNumber,form,acceptedAt,primaryDocument="form10q.htm")=>({
 accessionNumber,form,acceptedAt,primaryDocument,filingDate:acceptedAt.slice(0,10),
 acceptanceDisposition:"accepted_by_historical_cutoff"
});
const acceptance=()=>({
 contract:"earth2036-phoenix-sec-acceptance-triage-v1",
 cutoff:"2026-09-12T23:59:59-04:00",
 historicalT0EvidenceAdmitted:0,originalFilingBytesAuthenticated:false,
 publicAvailabilityAuthenticated:false,canonicalWriteAuthority:false,
 companies:[
  {ticker:"AEVA",cik:"0001789029",archivePayloadVerified:true,accessions:[
   row("0001193125-26-338179","10-Q","2026-08-06T20:27:05.000Z"),
   row("0001193125-26-116518","10-K","2026-03-20T01:55:26.000Z"),
   row("0001193125-22-123626","10-K/A","2022-04-27T20:13:18.000Z")
  ]},
  {ticker:"SWKS",cik:"0000004127",archivePayloadVerified:true,accessions:[
   row("0000004127-26-000049","10-Q","2026-07-29T00:48:13.000Z"),
   row("0000004127-25-000085","10-K","2025-11-08T02:08:12.000Z"),
   row("0000004127-26-000003","10-K/A","2026-01-31T02:06:48.000Z")
  ]}
 ]
});
test("bounded archive-backed selection chooses original quarterly annual and amendment once",()=>{
 const chosen=selectPilotFilings(acceptance());
 assert.equal(chosen.length,6);
 assert.equal(chosen.filter(x=>x.ticker==="AEVA").length,3);
 assert.equal(chosen.filter(x=>x.ticker==="SWKS").length,3);
 assert.ok(chosen.every(x=>x.acceptedAt&&x.primaryDocument));
});
test("late or incomplete document candidate cannot be retrieved under T0 pilot",()=>{
 const a=acceptance();
 a.companies[0].accessions.unshift(row("0001193125-26-999999","10-Q","2026-10-02T20:27:05.000Z"));
 assert.equal(selectPilotFilings(a).find(x=>x.ticker==="AEVA"&&x.form==="10-Q").accessionNumber,"0001193125-26-338179");
});
test("SEC agent accession digits differ from issuer CIK and remain valid",()=>{
 const urls=buildEdgarUrls({ticker:"AEVA",cik:"0001789029",accessionNumber:"0001193125-26-338179",primaryDocument:"aeva-20260630x10q.htm"});
 assert.ok(urls.primaryDocumentUrl.endsWith("/000119312526338179/aeva-20260630x10q.htm"));
 assert.ok(urls.headerUrl.endsWith("/0001193125-26-338179.hdr.sgml"));
});
test("reject unexpected document traversal and wrong registrant CIK",()=>{
 assert.throws(()=>buildEdgarUrls({ticker:"AEVA",cik:"0001789029",accessionNumber:"0001193125-26-338179",primaryDocument:"../evil"}));
 assert.throws(()=>buildEdgarUrls({ticker:"AEVA",cik:"0000004127",accessionNumber:"0001193125-26-338179",primaryDocument:"index.htm"}));
});
test("header acceptance compares SEC-local timestamp to UTC metadata",()=>{
 assert.equal(compareHeaderAcceptance("<ACCEPTANCE-DATETIME>20260806162705","2026-08-06T20:27:05.000Z").matches,true);
 assert.equal(compareHeaderAcceptance("<ACCEPTANCE-DATETIME>20260806162706","2026-08-06T20:27:05.000Z").matches,false);
});
test("reject report attempting to grant canonical authority",()=>{
 const a=acceptance();a.canonicalWriteAuthority=true;
 assert.throws(()=>selectPilotFilings(a),/untrusted_source_acceptance_audit/);
});
