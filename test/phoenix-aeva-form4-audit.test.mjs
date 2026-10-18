import test from "node:test";
import assert from "node:assert/strict";
import {parseOwnershipXml,choosePreT0Forms4,EXPECTED_FORM4_ACCESSIONS}
 from "../scripts/phoenix-aeva-form4-audit.mjs";

const transaction=(code,direction,shares,date)=>"<nonDerivativeTransaction>"+
 "<securityTitle><value>Common Stock</value></securityTitle>"+
 "<transactionDate><value>"+date+"</value></transactionDate>"+
 "<transactionCoding><transactionCode>"+code+"</transactionCode></transactionCoding>"+
 "<transactionAmounts><transactionShares><value>"+shares+"</value></transactionShares>"+
 "<transactionAcquiredDisposedCode><value>"+direction+"</value></transactionAcquiredDisposedCode></transactionAmounts>"+
 "<postTransactionAmounts><sharesOwnedFollowingTransaction><value>315000</value>"+
 "</sharesOwnedFollowingTransaction></postTransactionAmounts>"+
 '<footnoteId id="F1"/>'+"</nonDerivativeTransaction>";
const xml=['<?xml version="1.0"?>',
'<ownershipDocument><documentType>4</documentType><periodOfReport>2026-08-10</periodOfReport>',
'<issuer><issuerCik>0001789029</issuerCik></issuer>',
'<reportingOwner><reportingOwnerId><rptOwnerCik>0001850177</rptOwnerCik>',
'<rptOwnerName>Rezk Mina</rptOwnerName></reportingOwnerId></reportingOwner>',
'<nonDerivativeTable>',
transaction("S","D","1700","2026-08-10"),
transaction("M","A","1200","2026-08-10"),
transaction("F","D","450","2026-08-10"),
'</nonDerivativeTable>',
'<footnotes><footnote id="F1"> Shares withheld for tax payment </footnote></footnotes>',
'</ownershipDocument>'].join("\n");

test("original issuer and beneficial owner CIK and dated transaction codes are preserved",()=>{
 const result=parseOwnershipXml(xml,{expectedAccession:EXPECTED_FORM4_ACCESSIONS[0]});
 assert.equal(result.issuerCik,"0001789029");
 assert.equal(result.reportingOwnerCik,"0001850177");
 assert.equal(result.nonDerivativeTransactions,3);
 assert.deepEqual(result.codeCounts,{S:1,M:1,F:1});
 assert.deepEqual(result.transactions.map(x=>x.shares),[1700,1200,450]);
 assert.equal(result.transactions[0].codeInterpretation,"reported_sale");
 assert.equal(result.transactions[1].codeInterpretation,"reported_option_exercise_or_conversion");
 assert.equal(result.transactions[2].codeInterpretation,"reported_tax_or_exercise_price_withholding");
 assert.ok(result.transactions.every(x=>x.issuanceFromIssuerConfirmed===false));
 assert.equal(result.outstandingSharesAtT0Authenticated,false);
});
test("reject other issuer CIK, missing owner, DTD injection or wrong document type",()=>{
 assert.throws(()=>parseOwnershipXml(xml.replace("0001789029","0000004127")),/CIK_mismatch/);
 assert.throws(()=>parseOwnershipXml(xml.replace("0001850177","")) ,/owner_identity_missing/);
 assert.throws(()=>parseOwnershipXml("<!DOCTYPE html>"+xml),/untrusted_or_unbounded/);
 assert.throws(()=>parseOwnershipXml(xml.replace("<documentType>4</documentType>","<documentType>3</documentType>")),/not_original_Form4/);
});
test("missing transaction dates or codes fail instead of guessing owner shares",()=>{
 const malformed=xml.replace("<transactionCode>S</transactionCode>","<transactionCode></transactionCode>");
 assert.throws(()=>parseOwnershipXml(malformed),/critical_fields_missing/);
});
const window=()=>({
 contract:"earth2036-phoenix-p7g-aeva-sec-issuer-filing-window-v1",
 cutoff:"2026-09-12T23:59:59-04:00",cik:"0001789029",
 canonicalWriteAuthority:false,historicalT0EvidenceAdmitted:0,
 records:EXPECTED_FORM4_ACCESSIONS.map((accessionNumber,i)=>({
  form:"4",accessionNumber,filingDate:i===4?"2026-09-04":"2026-08-12",
  acceptedAt:i===4?"2026-09-04T22:22:04Z":"2026-08-12T20:06:19Z",
  primaryDocument:"xslF345X06/ownership.xml"
 }))
});
test("exactly five pre-cutoff original Form 4 entries required",()=>{
 assert.equal(choosePreT0Forms4(window()).length,5);
 const missing=window();missing.records.pop();
 assert.throws(()=>choosePreT0Forms4(missing),/inventory_changed/);
 const extra=window();extra.records[1].primaryDocument="../../ownership.xml";
 assert.throws(()=>choosePreT0Forms4(extra),/unsafe_or_incomplete/);
 const late=window();late.records[4].acceptedAt="2026-10-18T20:00:00Z";
 assert.throws(()=>choosePreT0Forms4(late),/unsafe_or_incomplete/);
});
test("Form 4 schema explicitly refuses pre-emptive issuer share authorization",()=>{
 const info=parseOwnershipXml(xml);
 assert.equal(info.issuerShareIssuanceAuthenticated,false);
 assert.equal(info.outstandingSharesAtT0Authenticated,false);
});
