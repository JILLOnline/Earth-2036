import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {secFilingRows,reconcileSecAccessionCursor,buildSecAccessionContinuityAudit} from "../scripts/lib/sec-accession-cursor.mjs";

const acc=n=>"0000012345-26-"+String(n).padStart(6,"0");
const filing=n=>({accessionNumber:acc(n),filingDate:"2026-10-09",reportDate:"2026-10-09",form:n%3===0?"8-K":"4",primaryDocument:"x.xml"});
const prev={status:"observed",filingFingerprint:"old",filings:[filing(100),filing(99)]};
test("SEC rows retain every accession, beyond 12, with aligned metadata and deduplication",()=>{
 const input=Array.from({length:15},(_,i)=>filing(115-i));
 input.push(input[0]);
 const table={accessionNumber:input.map(x=>x.accessionNumber),filingDate:input.map(x=>x.filingDate),
 reportDate:input.map(x=>x.reportDate),form:input.map(x=>x.form),primaryDocument:input.map(x=>x.primaryDocument)};
 assert.equal(secFilingRows(table).length,15);
 const j=reconcileSecAccessionCursor(prev,secFilingRows(table));
 assert.equal(j.continuityEstablished,true);
 assert.equal(j.newlyVisible.length,15); // 115..101 precede the prior 100; 15 new accessions.
 assert.equal(j.newlyVisible[0].accessionNumber,acc(115));
 assert.equal(j.newlyVisible[14].accessionNumber,acc(101));
});
test("unchanged old head yields no new filings",()=>{
 const j=reconcileSecAccessionCursor(prev,[filing(100),filing(99)]);
 assert.equal(j.status,"unchanged_head_cursor");assert.equal(j.newlyVisible.length,0);
});
test("archive recovers historical previous cursor after recent window rolls over",()=>{
 const recent=[filing(115),filing(114),filing(113)];
 const gap=reconcileSecAccessionCursor(prev,recent);
 assert.equal(gap.continuityEstablished,false);
 assert.equal(gap.archiveRequired,true);
 assert.equal(gap.newlyVisible.length,0);
 const archived=Array.from({length:13},(_,i)=>filing(112-i));
 const restored=reconcileSecAccessionCursor(prev,recent,archived);
 assert.equal(restored.continuityEstablished,true);
 assert.equal(restored.newlyVisible.length,15);
});
test("failed recovery never asserts completeness or reclassifies historical filings",()=>{
 const j=reconcileSecAccessionCursor(prev,[filing(115),filing(114)]);
 const audit=buildSecAccessionContinuityAudit([{ticker:"MWA",...j,recoveredNewAccessions:j.newlyVisible.length}], "2026-10-09T23:00:00Z");
 assert.equal(audit.incomplete,1);
 assert.equal(audit.continuous,0);
 assert.equal(audit.recoveredNewAccessions,0);
 assert.match(audit.policy,/degrades source-continuity/);
});
test("new member bootstrap is not silently labeled continuous",()=>{
 const j=reconcileSecAccessionCursor(null,[filing(115)]);
 assert.equal(j.status,"bootstrap_no_historical_cursor");
 assert.equal(j.continuityEstablished,false);
 assert.equal(j.newlyVisible.length,0);
});
test("ingestion uses all SEC accessions for review queue, preserving 12-row UI projection",async()=>{
 const engine=await readFile(new URL("../scripts/earth2036-engine.mjs",import.meta.url),"utf8");
 assert.match(engine,/const fullRecent = secFilingRows\(submissions\?\.filings\?\.recent\)/);
 assert.match(engine,/for \(const filing of continuity\.newlyVisible\)/);
 assert.match(engine,/submissionCoverage = Math\.max\(0, observedCount - incompleteAccessionCursors\) \/ EXPECTED/);
 assert.match(engine,/sec-accession-continuity\.json/);
 assert.doesNotMatch(engine,/Math\.min\(accessions\.length, 12\)/);
});
