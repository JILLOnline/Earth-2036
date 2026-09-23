import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildFundamentalsTruth,
  extractAllStandardFacts,
  extractMetricFacts,
  normalizeMetric,
  validateFundamentalsTruth,
} from "../scripts/lib/sec-fundamentals-truth.mjs";
import { fundamentalsSnapshotPath, writeImmutableFundamentalsSnapshot } from "../scripts/lib/fundamentals-storage.mjs";

function payload(overrides={}){
  return {
    cik:1551182,
    entityName:"Truth Test Corp",
    facts:{
      "us-gaap":{
        RevenueFromContractWithCustomerExcludingAssessedTax:{
          label:"Revenue",units:{USD:[
            {start:"2025-01-01",end:"2025-12-31",val:100,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY",frame:"CY2025"},
            {start:"2025-01-01",end:"2025-12-31",val:105,filed:"2026-03-01",accn:"A2",form:"10-K/A",fy:2025,fp:"FY",frame:"CY2025"},
            {start:"2026-01-01",end:"2026-03-31",val:30,filed:"2026-05-01",accn:"Q1",form:"10-Q",fy:2026,fp:"Q1",frame:"CY2026Q1"},
            {start:"2026-01-01",end:"2026-06-30",val:65,filed:"2026-08-01",accn:"Q2",form:"10-Q",fy:2026,fp:"Q2"}
          ]}
        },
        GrossProfit:{label:"Gross Profit",units:{USD:[
          {start:"2025-01-01",end:"2025-12-31",val:40,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        OperatingIncomeLoss:{label:"Operating Income",units:{USD:[
          {start:"2025-01-01",end:"2025-12-31",val:15,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        NetIncomeLoss:{label:"Net Income",units:{USD:[
          {start:"2025-01-01",end:"2025-12-31",val:12,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        NetCashProvidedByUsedInOperatingActivities:{label:"OCF",units:{USD:[
          {start:"2025-01-01",end:"2025-12-31",val:20,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        PaymentsToAcquirePropertyPlantAndEquipment:{label:"Capex",units:{USD:[
          {start:"2025-01-01",end:"2025-12-31",val:5,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        CashAndCashEquivalentsAtCarryingValue:{label:"Cash",units:{USD:[
          {end:"2025-12-31",val:40,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        LongTermDebtCurrent:{label:"Current Debt",units:{USD:[
          {end:"2025-12-31",val:10,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        LongTermDebtNoncurrent:{label:"Noncurrent Debt",units:{USD:[
          {end:"2025-12-31",val:30,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        ResearchAndDevelopmentExpense:{label:"R&D",units:{USD:[
          {start:"2025-01-01",end:"2025-12-31",val:7,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}},
        InventoryNet:{label:"Inventory",units:{USD:[
          {end:"2025-12-31",val:9,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}}
      },
      dei:{
        EntityCommonStockSharesOutstanding:{label:"Shares",units:{shares:[
          {end:"2025-12-31",val:1000,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
        ]}}
      }
    },
    ...overrides
  };
}

test("raw truth preserves standard facts we did not choose as named metrics",()=>{
  const facts=extractAllStandardFacts(payload(),"2026-04-01T00:00:00Z");
  assert.ok(facts.some(f=>f.tag==="ResearchAndDevelopmentExpense"));
  assert.ok(facts.some(f=>f.tag==="InventoryNet"));
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.equal(truth.primaryLearningAuthority,"rawTruth.facts");
  assert.equal(truth.rawTruth.learningAuthority,true);
  assert.equal(truth.normalizedProjection.learningAuthority,false);
});

test("future-filed facts are excluded point-in-time",()=>{
  const facts=extractAllStandardFacts(payload(),"2026-02-15T00:00:00Z");
  assert.equal(facts.some(f=>f.accn==="A2"),false);
  assert.equal(facts.some(f=>f.accn==="A1"),true);
});

test("same-day facts are conservatively unavailable until UTC day end",()=>{
  const noon=extractAllStandardFacts(payload(),"2026-02-01T12:00:00Z");
  const next=extractAllStandardFacts(payload(),"2026-02-02T00:00:00Z");
  assert.equal(noon.some(f=>f.accn==="A1"),false);
  assert.equal(next.some(f=>f.accn==="A1"),true);
});

test("same-context amendments supersede current view but immutable history remains",()=>{
  const metric=normalizeMetric(payload(),"revenue","2026-04-01T00:00:00Z");
  assert.equal(metric.currentFacts.some(f=>f.accn==="A2"),true);
  assert.equal(metric.currentFacts.some(f=>f.accn==="A1"),false);
  assert.ok(metric.supersededFacts.some(f=>f.accn==="A1"&&f.supersededBy==="A2"));
  assert.equal(metric.latest.annual.selected.val,105);
});

test("conflicting standard concepts become unknown instead of silently reconciled",()=>{
  const sample=payload();
  sample.facts["us-gaap"].Revenues={label:"Revenues",units:{USD:[
    {start:"2025-01-01",end:"2025-12-31",val:99,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}
  ]}};
  const metric=normalizeMetric(sample,"revenue","2026-04-01T00:00:00Z");
  assert.equal(metric.latest.annual.status,"ambiguous_concepts");
  assert.equal(metric.latest.annual.selected,null);
});

test("8-K remains in raw truth but cannot silently supersede normalized periodic fundamentals",()=>{
  const sample=payload();
  sample.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(
    {start:"2025-01-01",end:"2025-12-31",val:999,filed:"2026-03-15",accn:"E1",form:"8-K",fy:2025,fp:"FY"}
  );
  const raw=extractAllStandardFacts(sample,"2026-04-01T00:00:00Z");
  const normalized=extractMetricFacts(sample,"revenue","2026-04-01T00:00:00Z");
  assert.ok(raw.some(f=>f.accn==="E1"));
  assert.equal(normalized.some(f=>f.accn==="E1"),false);
  assert.equal(normalizeMetric(sample,"revenue","2026-04-01T00:00:00Z").latest.annual.selected.val,105);
});

test("derived values require same period unit and accession",()=>{
  const early=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-02-15T00:00:00Z"});
  const late=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.equal(early.normalizedProjection.derived.gross_margin.observations.find(x=>x.end==="2025-12-31").value,0.4);
  assert.equal(early.normalizedProjection.derived.free_cash_flow.observations.find(x=>x.end==="2025-12-31").value,15);
  assert.equal(late.normalizedProjection.derived.gross_margin.observations.find(x=>x.end==="2025-12-31"),undefined);
});

test("different currencies are never silently combined",()=>{
  const sample=payload();
  sample.facts["us-gaap"].PaymentsToAcquirePropertyPlantAndEquipment.units={
    EUR:[{start:"2025-01-01",end:"2025-12-31",val:5,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY"}]
  };
  const truth=buildFundamentalsTruth(sample,{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.equal(truth.normalizedProjection.derived.free_cash_flow.observations.length,0);
});

test("raw truth contains no Earth rank score or methodology context",()=>{
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.equal(truth.earthContextIncluded,false);
  assert.equal("earthScore" in truth,false);
  assert.equal("rank" in truth,false);
  assert.deepEqual(validateFundamentalsTruth(truth),[]);
});

test("tampering raw source facts is caught by hashes",()=>{
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  truth.rawTruth.facts[0].val=999999;
  const errors=validateFundamentalsTruth(truth);
  assert.ok(errors.includes("raw facts hash mismatch"));
  assert.ok(errors.includes("fundamentals truth hash mismatch"));
});

test("nine-month 10-Q remains year-to-date not annual",()=>{
  const sample=payload();
  sample.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(
    {start:"2026-01-01",end:"2026-09-30",val:300,filed:"2026-11-01",accn:"Q3",form:"10-Q",fy:2026,fp:"Q3"}
  );
  const metric=normalizeMetric(sample,"revenue","2026-11-15T00:00:00Z");
  assert.equal(metric.latest.annual.selected.val,105);
  assert.equal(metric.latest.yearToDate.selected.val,300);
});

test("comparative refilings supersede the same economic context even when fy metadata changes",()=>{
  const sample=payload();
  sample.facts["us-gaap"].GrossProfit.units.USD.push(
    {start:"2025-01-01",end:"2025-12-31",val:41,filed:"2027-02-01",accn:"A3",form:"10-K",fy:2026,fp:"FY"}
  );
  const metric=normalizeMetric(sample,"gross_profit","2027-03-01T00:00:00Z");
  assert.equal(metric.currentFacts.filter(f=>f.start==="2025-01-01"&&f.end==="2025-12-31").length,1);
  assert.equal(metric.currentFacts.find(f=>f.end==="2025-12-31").accn,"A3");
});

test("metric freshness is mechanical metadata only",()=>{
  const metric=normalizeMetric(payload(),"cash_and_equivalents","2026-04-01T12:00:00Z");
  assert.equal(metric.freshness.latestPeriodEnd,"2025-12-31");
  assert.equal(metric.freshness.periodEndAgeDays,91);
  assert.equal("stale" in metric.freshness,false);
});


test("same-day competing accessions remain ambiguous instead of lexicographic supersession",()=>{
  const sample=payload();
  sample.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(
    {start:"2025-01-01",end:"2025-12-31",val:111,filed:"2026-03-01",accn:"Z9",form:"10-K/A",fy:2025,fp:"FY",frame:"CY2025"}
  );
  const metric=normalizeMetric(sample,"revenue","2026-04-01T00:00:00Z");
  assert.equal(metric.latest.annual.status,"ambiguous_concepts");
  assert.equal(metric.latest.annual.selected,null);
  assert.ok(metric.currentFacts.some(f=>f.accn==="A2"));
  assert.ok(metric.currentFacts.some(f=>f.accn==="Z9"));
});

test("same-accession duplicate contexts are not mislabeled as superseded",()=>{
  const sample=payload();
  sample.facts["us-gaap"].GrossProfit.units.USD.push(
    {start:"2025-01-01",end:"2025-12-31",val:40,filed:"2026-02-01",accn:"A1",form:"10-K",fy:2025,fp:"FY",frame:"CY2025"}
  );
  const metric=normalizeMetric(sample,"gross_profit","2026-04-01T00:00:00Z");
  assert.equal(metric.currentFacts.filter(f=>f.accn==="A1").length,2);
  assert.equal(metric.supersededFacts.filter(f=>f.accn==="A1").length,0);
  assert.equal(metric.latest.annual.status,"resolved");
  assert.equal(metric.latest.annual.selected.val,40);
});

test("historical point-in-time hash is stable when future filings appear later",()=>{
  const before=payload();
  const after=payload();
  after.facts["us-gaap"].InventoryNet.units.USD.push(
    {end:"2026-12-31",val:999,filed:"2027-02-01",accn:"FUTURE1",form:"10-K",fy:2026,fp:"FY"}
  );
  const a=buildFundamentalsTruth(before,{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  const b=buildFundamentalsTruth(after,{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.equal(a.rawTruth.factsHash,b.rawTruth.factsHash);
  assert.equal(a.sourcePayloadHash,b.sourcePayloadHash);
  assert.equal(a.truthHash,b.truthHash);
  assert.notEqual(a.retrievedPayloadHash,b.retrievedPayloadHash);
});

test("foreign issuer 6-K facts stay raw but do not silently become normalized periodic fundamentals",()=>{
  const sample=payload({facts:{
    "ifrs-full":{
      Revenue:{label:"Revenue",units:{EUR:[
        {start:"2026-01-01",end:"2026-06-30",val:500,filed:"2026-07-20",accn:"F6K",form:"6-K",fy:2026,fp:"H1"}
      ]}}
    }
  }});
  const raw=extractAllStandardFacts(sample,"2026-08-01T00:00:00Z");
  const normalized=extractMetricFacts(sample,"revenue","2026-08-01T00:00:00Z");
  assert.ok(raw.some(f=>f.accn==="F6K"));
  assert.equal(normalized.some(f=>f.accn==="F6K"),false);
});

test("CIK mismatch fails closed instead of mislabeling another filer",()=>{
  assert.throws(
    ()=>buildFundamentalsTruth(payload(),{ticker:"TEST",cik:"0000000001",asOf:"2026-04-01T00:00:00Z"}),
    /CIK mismatch/
  );
});

test("point-in-time source hash tampering is detected independently",()=>{
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  truth.sourcePayloadHash="0".repeat(64);
  const errors=validateFundamentalsTruth(truth);
  assert.ok(errors.includes("point-in-time source payload hash mismatch"));
});


function clone(value){ return structuredClone(value); }

test("historical truth identity ignores future payload growth and untimestamped metadata drift",()=>{
  const asOf="2026-02-15T00:00:00Z";
  const a=payload();
  const b=clone(a);
  b.entityName="Future Renamed Corp";
  b.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.label="Future Revenue Label";
  b.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.description="future-only description";
  b.facts.srt={FutureOnlyConcept:{label:"Future",units:{USD:[
    {end:"2027-12-31",val:1,filed:"2028-02-01",accn:"FUT",form:"10-K",fy:2027,fp:"FY"}
  ]}}};
  const ta=buildFundamentalsTruth(a,{ticker:"TEST",asOf});
  const tb=buildFundamentalsTruth(b,{ticker:"TEST",asOf});
  assert.equal(ta.rawTruth.factsHash,tb.rawTruth.factsHash);
  assert.equal(ta.sourcePayloadHash,tb.sourcePayloadHash);
  assert.equal(ta.truthHash,tb.truthHash);
  assert.notEqual(ta.retrievedPayloadHash,tb.retrievedPayloadHash);
  assert.deepEqual(ta.sourceTaxonomies,tb.sourceTaxonomies);
  assert.equal(tb.sourceTaxonomies.includes("srt"),false);
});

test("untimestamped concept label and description never enter learner-authoritative raw facts",()=>{
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.ok(truth.rawTruth.facts.every((fact)=>!("label" in fact)&&!("description" in fact)));
});

test("human metric projection cannot mutate raw point-in-time truth identity",()=>{
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  const originalTruthHash=truth.truthHash;
  truth.normalizedProjection.metrics.revenue.status="tampered";
  const errors=validateFundamentalsTruth(truth);
  assert.equal(truth.truthHash,originalTruthHash);
  assert.ok(errors.includes("normalized projection hash mismatch"));
  assert.ok(errors.includes("fundamentals record hash mismatch"));
  assert.equal(errors.includes("fundamentals truth hash mismatch"),false);
});

test("foreign issuer IFRS 20-F facts normalize while obscure IFRS facts remain raw",()=>{
  const sample={cik:937966,entityName:"IFRS Test",facts:{"ifrs-full":{
    Revenue:{units:{EUR:[{start:"2025-01-01",end:"2025-12-31",val:1000,filed:"2026-02-15",accn:"F1",form:"20-F",fy:2025,fp:"FY"}]}},
    GrossProfit:{units:{EUR:[{start:"2025-01-01",end:"2025-12-31",val:450,filed:"2026-02-15",accn:"F1",form:"20-F",fy:2025,fp:"FY"}]}},
    ResearchAndDevelopmentExpense:{units:{EUR:[{start:"2025-01-01",end:"2025-12-31",val:120,filed:"2026-02-15",accn:"F1",form:"20-F",fy:2025,fp:"FY"}]}}
  }}};
  const truth=buildFundamentalsTruth(sample,{ticker:"IFRS",cik:"0000937966",asOf:"2026-03-01T00:00:00Z"});
  assert.equal(truth.normalizedProjection.metrics.revenue.latest.annual.selected.val,1000);
  assert.ok(truth.rawTruth.facts.some((fact)=>fact.tag==="ResearchAndDevelopmentExpense"));
  assert.deepEqual(validateFundamentalsTruth(truth),[]);
});

test("banking and insurance peculiarities stay raw when convenience revenue projection is absent",()=>{
  const sample={cik:1,entityName:"Sector Test",facts:{"us-gaap":{
    InterestAndFeeIncomeLoansAndLeases:{units:{USD:[{start:"2025-01-01",end:"2025-12-31",val:800,filed:"2026-02-01",accn:"B1",form:"10-K",fy:2025,fp:"FY"}]}},
    PremiumsEarnedNet:{units:{USD:[{start:"2025-01-01",end:"2025-12-31",val:600,filed:"2026-02-01",accn:"B1",form:"10-K",fy:2025,fp:"FY"}]}}
  }}};
  const truth=buildFundamentalsTruth(sample,{ticker:"SECTOR",asOf:"2026-03-01T00:00:00Z"});
  assert.equal(truth.normalizedProjection.metrics.revenue.status,"missing");
  assert.ok(truth.rawTruth.facts.some((fact)=>fact.tag==="InterestAndFeeIncomeLoansAndLeases"));
  assert.ok(truth.rawTruth.facts.some((fact)=>fact.tag==="PremiumsEarnedNet"));
  assert.equal(truth.normalizedProjection.metrics.revenue.latest.annual.selected,null);
});

test("new non-custom taxonomy namespaces are preserved when point-in-time eligible",()=>{
  const sample=payload();
  sample.facts.srt={SomeStandardConcept:{units:{pure:[
    {end:"2025-12-31",val:3,filed:"2026-02-01",accn:"S1",form:"10-K",fy:2025,fp:"FY"}
  ]}}};
  const truth=buildFundamentalsTruth(sample,{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.ok(truth.rawTruth.facts.some((fact)=>fact.taxonomy==="srt"&&fact.tag==="SomeStandardConcept"));
  assert.ok(truth.sourceTaxonomies.includes("srt"));
});

test("multiple units on the same metric period stay ambiguous instead of cross-unit selection",()=>{
  const sample=payload();
  sample.facts["us-gaap"].GrossProfit.units.EUR=[
    {start:"2025-01-01",end:"2025-12-31",val:40,filed:"2026-03-01",accn:"A2",form:"10-K/A",fy:2025,fp:"FY"}
  ];
  const metric=normalizeMetric(sample,"gross_profit","2026-04-01T00:00:00Z");
  assert.equal(metric.latest.annual.status,"ambiguous_periods");
  assert.equal(metric.latest.annual.selected,null);
});

test("53-week fiscal years remain annual while 10-KT transition periods stay separate",()=>{
  const sample=payload();
  sample.facts["us-gaap"].Revenues={units:{USD:[
    {start:"2025-01-01",end:"2026-01-06",val:500,filed:"2026-02-20",accn:"Y53",form:"10-K",fy:2025,fp:"FY"},
    {start:"2026-01-07",end:"2026-06-30",val:250,filed:"2026-08-01",accn:"T1",form:"10-KT",fy:2026,fp:"FY"}
  ]}};
  const metric=normalizeMetric(sample,"revenue","2026-09-01T00:00:00Z");
  assert.equal(metric.latest.annual.selected.accn,"Y53");
  assert.equal(metric.latest.transition.selected.accn,"T1");
});

test("historical reconstruction changes only when newly eligible facts change the lawful state",()=>{
  const early=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-02-15T00:00:00Z"});
  const late=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  assert.notEqual(early.truthHash,late.truthHash);
  assert.ok(early.rawTruth.facts.some((fact)=>fact.accn==="A1"));
  assert.equal(early.rawTruth.facts.some((fact)=>fact.accn==="A2"),false);
  assert.ok(late.rawTruth.facts.some((fact)=>fact.accn==="A2"));
});

test("immutable storage never overwrites a previously written truth snapshot",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"fund-truth-"));
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z",retrievedAt:"2026-04-02T00:00:00Z"});
  const first=await writeImmutableFundamentalsSnapshot(root,truth);
  assert.equal(first.written,true);
  const second=await writeImmutableFundamentalsSnapshot(root,{...truth,retrievedAt:"2026-04-03T00:00:00Z"});
  assert.equal(second.reused,true);
  assert.equal(first.file,fundamentalsSnapshotPath(root,truth));
  const stored=JSON.parse(await readFile(first.file,"utf8"));
  assert.equal(stored.retrievedAt,"2026-04-02T00:00:00Z");
});

test("derived context-view tampering cannot alter raw truth silently",()=>{
  const truth=buildFundamentalsTruth(payload(),{ticker:"TEST",asOf:"2026-04-01T00:00:00Z"});
  const originalTruthHash=truth.truthHash;
  truth.rawTruth.currentFacts[0].val=123456;
  const errors=validateFundamentalsTruth(truth);
  assert.equal(truth.truthHash,originalTruthHash);
  assert.ok(errors.includes("raw context view hash mismatch"));
  assert.ok(errors.includes("fundamentals record hash mismatch"));
  assert.equal(errors.includes("fundamentals truth hash mismatch"),false);
});
