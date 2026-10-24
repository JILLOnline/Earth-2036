import test from "node:test";
import assert from "node:assert/strict";
import {parseRule144,reconcileRule144ToForm4,runRule144Overlap} from "../scripts/phoenix-aeva-rule144-overlap.mjs";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {PINNED_ORIGINAL_FORM4_HASHES} from "../scripts/phoenix-aeva-form4-audit.mjs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const makeNotice=(acc,cik,name,shares,date)=>[
 '<?xml version="1.0"?><edgarSubmission>',
 '<headerData><submissionType>144</submissionType><filerInfo><filer>',
 '<filerCredentials><cik>'+cik+'</cik></filerCredentials></filer></filerInfo></headerData>',
 '<formData><issuerInfo><issuerCik>0001789029</issuerCik>',
 '<nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold>'+name+'</nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold>',
 '</issuerInfo><securitiesInformation><securitiesClassTitle>Common</securitiesClassTitle>',
 '<noOfUnitsSold>'+shares+'</noOfUnitsSold><noOfUnitsOutstanding>69705758</noOfUnitsOutstanding>',
 '<approxSaleDate>'+date+'</approxSaleDate></securitiesInformation>',
 '<securitiesToBeSold><acquiredDate>03/12/2025</acquiredDate>',
 '<natureOfAcquisitionTransaction>Restricted Stock Units</natureOfAcquisitionTransaction>',
 '<amountOfSecuritiesAcquired>'+shares+'</amountOfSecuritiesAcquired></securitiesToBeSold>',
 '<noticeSignature><noticeDate>'+date+'</noticeDate></noticeSignature>',
 '</formData></edgarSubmission>'
].join("");
const a="0001950047-26-007999",b="0001950047-26-008329";
const parsedA=()=>parseRule144(makeNotice(a,"0001830952","KATHERINE MOTLAGH",2500,"08/12/2026"),a);
const parsedB=()=>parseRule144(makeNotice(b,"0001849806","SAURABH SINHA",70000,"08/18/2026"),b);
const form4={
 contract:"earth2036-phoenix-p7h-aeva-original-Form4-v1",
 cutoff:"2026-09-12T23:59:59-04:00",
 originalXmlVerified:5,canonicalWriteAuthority:false,historicalT0EvidenceAdmitted:0,
 filings:[
  {accession:"0001193125-26-352272",originalXmlSha256:PINNED_ORIGINAL_FORM4_HASHES["0001193125-26-352272"],originalXmlTransactionParse:{
   reportingOwnerName:"MOTLAGH KATHERINE",reportingOwnerCik:"0001830952",
   transactions:[{table:"non_derivative",code:"S",acquiredDisposed:"D",
    transactionDate:"2026-08-12",shares:2500}]}},
  {accession:"0001193125-26-359631",originalXmlSha256:PINNED_ORIGINAL_FORM4_HASHES["0001193125-26-359631"],originalXmlTransactionParse:{
   reportingOwnerName:"Sinha Saurabh",reportingOwnerCik:"0001849806",
   transactions:[{table:"non_derivative",code:"S",acquiredDisposed:"D",
    transactionDate:"2026-08-18",shares:70000}]}}
 ]
};
const window={
 contract:"earth2036-phoenix-p7g-aeva-sec-issuer-filing-window-v1",
 cutoff:"2026-09-12T23:59:59-04:00",historicalT0EvidenceAdmitted:0,
 canonicalWriteAuthority:false,records:[
 {form:"144",accessionNumber:a,acceptedAt:"2026-08-12T20:09:00.000Z",
 primaryDocument:"xsl144X01/primary_doc.xml"},
 {form:"144",accessionNumber:b,acceptedAt:"2026-08-18T20:24:36.000Z",
 primaryDocument:"xsl144X01/primary_doc.xml"}]
};
test("two real Form144 shapes retain filer-reported outstanding count as unverified",()=>{
 const mot=parsedA(),sin=parsedB();
 assert.equal(mot.proposedShares,2500);
 assert.equal(sin.proposedShares,70000);
 assert.equal(mot.filerReportedOutstandingShares,69705758);
 assert.equal(sin.filerReportedOutstandingShares,69705758);
 assert.equal(mot.filerReportedOutstandingSharesIssuerAuthenticated,false);
 assert.equal(sin.sourceNoticeIsProposalNotTrade,true);
 assert.equal(sin.acquisitions[0].nature,"Restricted Stock Units");
});
test("matching sales from original Form 4 are counted once, not added again",()=>{
 const r=reconcileRule144ToForm4([parsedA(),parsedB()],form4);
 assert.equal(r.length,2);
 assert.ok(r.every(x=>x.matchedOneOriginalSale&&x.duplicateSaleWouldBeCountedTwice));
 assert.deepEqual(r.map(x=>x.identicalForm4Sales[0].shares),[2500,70000]);
 assert.ok(r.every(x=>x.additionalIssuedSharesAuthenticated===false));
});
test("no owner name alone grants a transaction match",()=>{
 const r=reconcileRule144ToForm4([{...parsedB(),reportingOwnerCik:"0000001234"}],form4);
 assert.equal(r[0].matchedOneOriginalSale,false);
});
test("issuer, quantity, date and malicious XML inputs fail closed",()=>{
 assert.throws(()=>parseRule144(makeNotice(a,"0001830952","KATHERINE MOTLAGH",2600,"08/12/2026"),a),/proposed_sale_identity_changed/);
 assert.throws(()=>parseRule144(makeNotice(a,"0001830952","KATHERINE MOTLAGH",2500,"08/12/2026").replace("0001789029","0000004127"),a),/issuer_or_owner_cik_mismatch/);
 assert.throws(()=>parseRule144("<!DOCTYPE foo>"+makeNotice(a,"0001830952","KATHERINE MOTLAGH",2500,"08/12/2026"),a),/untrusted_oversize_or_dtd/);
 assert.throws(()=>reconcileRule144ToForm4([parsedA()],{...form4,canonicalWriteAuthority:true}),/untrusted_original_sec_form4_report/);
});
test("synthetic SEC bytes fail pinned SHA gate; forged data never becomes admitted",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"aeva-rule144-"));
 try{
  const w=join(dir,"window.json"),f=join(dir,"form4.json");
  await writeFile(w,JSON.stringify(window));await writeFile(f,JSON.stringify(form4));
  const fetcher=async(url)=>({
   bytes:Buffer.from(url.includes("007999")?
     makeNotice(a,"0001830952","KATHERINE MOTLAGH",2500,"08/12/2026"):
     makeNotice(b,"0001849806","SAURABH SINHA",70000,"08/18/2026"))
  });
  const r=await runRule144Overlap(w,f,{agent:"Test AEVA contact@company.invalid",
   fetcher,delayMs:0});
  assert.equal(r.originalsVerified,0);
  assert.equal(r.errors.length,2);
  assert.ok(r.errors.every(x=>x.failure==="historical_rule144_original_XML_digest_changed"));
  assert.equal(r.exactForm4OverlapCount,0);
  assert.equal(r.shareCountAsOfCutoffAuthenticated,false);
  assert.equal(r.marketValuationOpportunity,null);
  assert.equal(r.historicalT0EvidenceAdmitted,0);
  assert.equal(r.canonicalWriteAuthority,false);
 }finally{await rm(dir,{recursive:true,force:true})}
});
