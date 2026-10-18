import test from "node:test";
import assert from "node:assert/strict";
import {indexLocator,verifyDailyMasterIndex} from "../scripts/phoenix-edgar-daily-index-pilot.mjs";
const f={ticker:"AEVA",cik:"0001789029",accessionNumber:"0001193125-26-338179",filingDate:"2026-08-06",form:"10-Q"};
test("SEC dated index path is bounded by filing date, registrant CIK and accession",()=>{
 const {indexUrl,expectedPath}=indexLocator(f);
 assert.equal(indexUrl,"https://www.sec.gov/Archives/edgar/daily-index/2026/QTR3/master.20260806.idx");
 assert.equal(expectedPath,"edgar/data/1789029/0001193125-26-338179.txt");
});
test("unique original registrant CIK and form row matches",()=>{
 const idx="CIK|Company Name|Form Type|Date Filed|Filename\n"+
 "1789029|Aeva|10-Q|2026-08-06|edgar/data/1789029/0001193125-26-338179.txt\n";
 assert.equal(verifyDailyMasterIndex(idx,f).verifiedUniqueMatch,true);
 assert.equal(verifyDailyMasterIndex(idx,{...f,form:"10-K"}).verifiedUniqueMatch,false);
});
test("supports the SEC alternative accession-directory filing path without relaxing identity",()=>{
 const content="1789029|Aeva|10-Q|2026-08-06|edgar/data/1789029/000119312526338179/0001193125-26-338179.txt";
 assert.equal(verifyDailyMasterIndex(content,f).verifiedUniqueMatch,true);
});
test("no ambiguous duplicated index rows admitted",()=>{
 const row="1789029|Aeva|10-Q|2026-08-06|edgar/data/1789029/0001193125-26-338179.txt\n";
 assert.equal(verifyDailyMasterIndex(row+row,f).verifiedUniqueMatch,false);
});
test("reject file path injection and unsupported dates",()=>{
 assert.throws(()=>indexLocator({...f,accessionNumber:"../evil"}));
 assert.throws(()=>indexLocator({...f,filingDate:"2026-13-06"}));
});
