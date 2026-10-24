import test from "node:test";
import assert from "node:assert/strict";
import {selectAmendmentFamilies,reviewAmendmentFamilies} from "../scripts/phoenix-edgar-amendment-family.mjs";
const iso="2026-09-12T23:59:59-04:00";
const row=(prefix,id,form,reportDate,acceptedAt)=>({
 accessionNumber:prefix+"-"+id,
 form,reportDate,acceptedAt,filingDate:acceptedAt.slice(0,10),
 primaryDocument:"annual.htm",
 acceptanceDisposition:"accepted_by_historical_cutoff"
});
const date=i=>new Date(Date.UTC(2019+i,10,12)).toISOString();
function fixture(){
 const aeva=[row("0001193125","21-179186","10-K/A","2020-12-31","2021-06-02T14:33:19Z"),
  row("0001193125","22-123626","10-K/A","2021-12-31","2022-04-27T20:13:18Z"),
  row("0001193125","21-014857","10-K","2020-12-31","2021-03-11T12:00:00Z"),
  row("0000950170","22-002379","10-K","2021-12-31","2022-03-01T12:00:00Z")];
 const swks=[];
 for(let i=0;i<7;i++){
  const year=2019+i,period=year+"-09-27";
  swks.push(row("0000004127",String(20+i).padStart(2,"0")+"-"+String(100+i).padStart(6,"0"),"10-K",period,date(i)));
  swks.push(row("0000004127",String(20+i).padStart(2,"0")+"-"+String(200+i).padStart(6,"0"),"10-K/A",period,
    new Date(Date.parse(date(i))+40*86400000).toISOString()));
 }
 return {contract:"earth2036-phoenix-sec-acceptance-triage-v1",
 cutoff:iso,historicalT0EvidenceAdmitted:0,canonicalWriteAuthority:false,
 publicAvailabilityAuthenticated:false,
 companies:[{ticker:"AEVA",cik:"0001789029",archivePayloadVerified:true,accessions:aeva},
 {ticker:"SWKS",cik:"0000004127",archivePayloadVerified:true,accessions:swks}]};
}
test("all nine amendments uniquely pair to a prior same SEC report period",()=>{
 const out=selectAmendmentFamilies(fixture());
 assert.equal(out.length,9);assert.equal(out.filter(x=>x.ticker==="SWKS").length,7);
 assert.ok(out.every(x=>x.sourcePeriodMatchStatus==="exact_same_period_10k"));
 assert.ok(out.every(x=>x.original?.reportDate===x.amendment.reportDate));
 assert.ok(out.every(x=>x.historicalAdmissibility!==true));
});
test("unverified nearby annual filing is not silently used for a different reporting period",()=>{
 const f=fixture();
 f.companies[0].accessions[0].reportDate="2020-01-01";
 const family=selectAmendmentFamilies(f).find(x=>x.amendment.reportDate==="2020-01-01");
 assert.equal(family.original,null);
 assert.equal(family.sourcePeriodMatchStatus,"no_preceding_same_period_10k");
 assert.ok(family.unverifiedPriorAnnualCandidate);
});
test("duplicate parent matches are marked ambiguous, not arbitrarily selected",()=>{
 const f=fixture();f.companies[0].accessions.push({...f.companies[0].accessions[2],
 accessionNumber:"0001193125-20-999999",acceptedAt:"2021-03-10T12:00:00Z"});
 const family=selectAmendmentFamilies(f).find(x=>x.amendment.reportDate==="2020-12-31");
 assert.equal(family.original,null);
 assert.equal(family.sourcePeriodMatchStatus,"ambiguous_same_period_originals");
});
test("changed historical inventory or noncanonical contract aborts",()=>{
 const f=fixture();f.companies[0].accessions=f.companies[0].accessions.filter(x=>x.form!=="10-K/A");
 assert.throws(()=>selectAmendmentFamilies(f),/historical_amendment_inventory_changed/);
 const g=fixture();g.canonicalWriteAuthority=true;
 assert.throws(()=>selectAmendmentFamilies(g),/untrusted_original_sec_acceptance_report/);
});
test("fetched original bytes do not confer publication, financial restatement, or T0 admission",async()=>{
 const mock=async()=>({
  bytes:Buffer.from("Explanatory Note Part III financial statements test"),
  sha256:"9".repeat(64),size:54
 });
 const out=await reviewAmendmentFamilies(fixture(),{agent:"Test SEC user-agent test@example.invalid",
 fetcher:mock,delay:0});
 assert.equal(out.totalAmendments,9);
 assert.equal(out.amendmentPrimaryDocumentsRetrieved,9);
 assert.equal(out.originalPrimaryDocumentsRetrieved,9);
 assert.equal(out.originalPeriodMatched,9);
 assert.equal(out.historicalT0EvidenceAdmitted,0);
 assert.equal(out.amendmentContentReviewComplete,false);
 assert.ok(out.families.every(x=>x.historicalAdmissibility===false&&x.supersessionDisposition==="not_reviewed"));
});
