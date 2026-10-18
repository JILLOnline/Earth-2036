import test from "node:test";
import assert from "node:assert/strict";
import {reviewAevaFilingWindow} from "../scripts/phoenix-aeva-filing-window.mjs";

function fixture(){
 return {cik:1789029,filings:{recent:{
  accessionNumber:[
   "0001193125-26-390791","0001193125-26-383903",
   "0001193125-26-338179","0001193125-26-335102",
   "0001193125-26-000001"
  ],
  filingDate:["2026-09-14","2026-09-12","2026-08-06","2026-08-05","2026-07-01"],
  acceptanceDateTime:[
   "2026-09-14T17:00:00Z","2026-09-13T04:00:00Z",
   "2026-08-06T20:27:05Z","2026-08-05T20:00:00Z","2026-07-01T12:00:00Z"
  ],
  form:["3","8-K","10-Q","8-K","10-K"],
  primaryDocument:["form3.xml","file.htm","q2.htm","release.htm","old.htm"]
 }}};
}
test("issuer filing window includes pre-T0 filings but not post-cutoff documents",()=>{
 const x=reviewAevaFilingWindow(fixture());
 assert.equal(x.issuerFilingCountWithinWindow,2);
 assert.equal(x.forms["10-Q"],1);
 assert.equal(x.forms["8-K"],1);
 assert.equal(x.records.find(r=>r.form==="10-Q").accessionNumber,
  "0001193125-26-338179");
 assert.equal(x.heldRecords.length,1);
 assert.equal(x.heldRecords[0].disposition,"accepted_after_cutoff");
 assert.equal(x.marketValuationOpportunity,null);
 assert.equal(x.shareCountAsOfCutoffAuthenticated,false);
 assert.equal(x.issuerCapitalizationEventsExhaustivelyReviewed,false);
 assert.equal(x.beneficialOwnerFormsAndTransferAgentReconciled,false);
 assert.equal(x.canonicalWriteAuthority,false);
 assert.equal(x.historicalT0EvidenceAdmitted,0);
});
test("no pre-cover history in recent records fails closed",()=>{
 const x=fixture();
 x.filings.recent.filingDate=x.filings.recent.filingDate.map(()=>"2026-08-05");
 assert.throws(()=>reviewAevaFilingWindow(x),/SEC_recent_filing_window_not_complete/);
});
test("SEC CIK, missing columns, invalid accession all block source inference",()=>{
 const x=fixture();x.cik=1000000;
 assert.throws(()=>reviewAevaFilingWindow(x),/SEC_issuer_identity_unverified/);
 const y=fixture();delete y.filings.recent.acceptanceDateTime;
 assert.throws(()=>reviewAevaFilingWindow(y),/SEC_recent_filing_columns_missing/);
 const z=fixture();z.filings.recent.accessionNumber[2]="../forged";
 assert.throws(()=>reviewAevaFilingWindow(z),/invalid_SEC_accession_or_form_in_window/);
});
test("missing acceptance clock is held, not silently admitted",()=>{
 const x=fixture();x.filings.recent.acceptanceDateTime[2]=null;
 const o=reviewAevaFilingWindow(x);
 assert.equal(o.issuerFilingCountWithinWindow,1);
 assert.equal(o.heldRecords.length,2);
 assert.ok(o.heldRecords.some(q=>q.disposition==="missing_precise_sec_acceptance"));
});
