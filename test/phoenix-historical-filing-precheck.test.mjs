import test from "node:test";
import assert from "node:assert/strict";
import {assessHistoricalFiling,HISTORICAL_T0_CUTOFF} from "../scripts/lib/phoenix-historical-filing-precheck.mjs";
const base=()=>({ticker:"AEVA",cik:"0001789029",fact:{accn:"0001789029-26-000100",filed:"2026-09-12"},
filing:{cik:"0001789029",accessionNumber:"0001789029-26-000100",acceptedAt:"2026-09-12T17:10:00-04:00",
publiclyAvailableAt:"2026-09-12T17:11:00-04:00",amendmentAndSupersessionReviewed:true,sourceAccessionAuthenticated:true},
archiveVerified:true,sourceBytesVerified:true});
test("missing archive or original bytes fails closed",()=>{const a=base();a.archiveVerified=false;assert.equal(assessHistoricalFiling(a).temporalAndSourcePrecheckPassed,false)});
test("date-only SEC filed field never replaces acceptance timestamp",()=>{const a=base();delete a.filing.acceptedAt;assert.ok(assessHistoricalFiling(a).failures.includes("sec_acceptance_timestamp_unverified"))});
test("reject after cutoff in NY time despite same filing date",()=>{const a=base();a.filing.acceptedAt="2026-09-12T23:59:59-05:00";assert.ok(assessHistoricalFiling(a).failures.includes("sec_filing_accepted_after_cutoff"))});
test("reject delayed public availability",()=>{const a=base();a.filing.publiclyAvailableAt="2026-09-13T00:00:00-04:00";assert.ok(assessHistoricalFiling(a).failures.includes("public_availability_after_cutoff"))});
test("reject mismatched CIK and accession",()=>{const a=base();a.filing.cik="0000004127";a.fact.accn="0000004127-26-000100";assert.ok(assessHistoricalFiling(a).failures.length>=2)});
test("reject unreviewed amendment/supersession",()=>{const a=base();a.filing.amendmentAndSupersessionReviewed=false;assert.ok(assessHistoricalFiling(a).failures.includes("amendment_supersession_not_reviewed"))});
test("immutable T0 historical cutoff",()=>{assert.throws(()=>assessHistoricalFiling({...base(),cutoff:"2026-10-17T00:00:00Z"}),/immutable/);assert.equal(HISTORICAL_T0_CUTOFF,"2026-09-12T23:59:59-04:00")});
test("even fully passing precheck grants no authority",()=>{const r=assessHistoricalFiling(base());assert.equal(r.temporalAndSourcePrecheckPassed,true);assert.equal(r.historicalT0EvidenceAdmitted,false);assert.equal(r.sourceWriteAuthorized,false);assert.equal(r.canonicalPromotionAuthorized,false)});
