import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFundamentalsTruth, validateFundamentalsTruth } from "./lib/sec-fundamentals-truth.mjs";

const ROOT=process.cwd();
const USER_AGENT=process.env.SEC_USER_AGENT || "JILLOnline Earth2036 info@jillonlinestore.com";
const args=process.argv.slice(2);

function argValue(name,fallback=null){
  const i=args.indexOf(name);
  return i>=0 && args[i+1]!=null ? args[i+1] : fallback;
}

const tickersArg=argValue("--tickers","");
const limit=Math.max(1,Number(argValue("--limit","5"))||5);
const asOf=argValue("--as-of",new Date().toISOString());
const writeMode=!args.includes("--no-write");
const auditDetails=args.includes("--audit-details");
const summaryOnly=args.includes("--summary-only");
const outputDir=argValue("--output-dir",path.join("data","lab","truth","fundamentals"));

async function readJson(file){ return JSON.parse(await readFile(file,"utf8")); }

async function writeImmutableJson(file,value){
  await mkdir(path.dirname(file),{recursive:true});
  const body=JSON.stringify(value,null,2)+"\n";
  try{
    await writeFile(file,body,{encoding:"utf8",flag:"wx"});
    return "created";
  }catch(error){
    if(error?.code!=="EEXIST") throw error;
    const existing=await readFile(file,"utf8");
    if(existing!==body) throw new Error("immutable truth collision at "+file);
    return "reused";
  }
}

async function fetchJson(url,attempts=3){
  let lastError=null;
  for(let attempt=1;attempt<=attempts;attempt+=1){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(url,{
        signal:controller.signal,
        headers:{"User-Agent":USER_AGENT,Accept:"application/json"}
      });
      if(!response.ok) throw new Error(String(response.status)+" "+response.statusText);
      return await response.json();
    }catch(error){
      lastError=error;
      if(attempt<attempts) await new Promise(r=>setTimeout(r,500*(2**(attempt-1))));
    }finally{ clearTimeout(timer); }
  }
  throw lastError;
}

function auditSummary(truth){
  const missing=Object.entries(truth.normalizedProjection?.metrics ?? {})
    .filter(([,metric])=>metric.status==="missing").map(([name])=>name);
  return {
    rawFactCount:truth.audit.rawFactCount,
    rawCurrentFactCount:truth.audit.rawCurrentFactCount,
    rawSupersededFactCount:truth.audit.rawSupersededFactCount,
    taxonomyCount:truth.audit.taxonomyCount,
    tagCount:truth.audit.tagCount,
    unitCount:truth.audit.unitCount,
    formCount:truth.audit.formCount,
    earliestFiled:truth.audit.earliestFiled,
    latestFiled:truth.audit.latestFiled,
    normalizedObservedMetricCount:truth.audit.normalizedObservedMetricCount,
    normalizedMissingMetrics:missing,
    normalizedAmbiguousPeriodCount:truth.audit.normalizedAmbiguousPeriodCount,
    derivedObservationCount:truth.audit.derivedObservationCount,
    rawTruthBytes:Buffer.byteLength(JSON.stringify(truth.rawTruth)),
    projectionBytes:Buffer.byteLength(JSON.stringify(truth.normalizedProjection)),
  };
}

const registry=await readJson(path.join(ROOT,"data","runtime","entity-registry.json"));
const requested=new Set(tickersArg.split(",").map(v=>v.trim().toUpperCase()).filter(Boolean));
let entities=(registry.candidates ?? []).filter(e=>e?.ticker && e?.cik);
if(requested.size) entities=entities.filter(e=>requested.has(String(e.ticker).toUpperCase()));
entities=entities.slice(0,limit);
if(!entities.length) throw new Error("No matching SEC-identified companies found.");

const results=[];
const manifestCompanies=[];

for(const entity of entities){
  const sourceUrl="https://data.sec.gov/api/xbrl/companyfacts/CIK"+entity.cik+".json";
  const payload=await fetchJson(sourceUrl);
  const truth=buildFundamentalsTruth(payload,{
    ticker:entity.ticker,cik:entity.cik,asOf,
    retrievedAt:new Date().toISOString(),sourceUrl
  });
  const errors=validateFundamentalsTruth(truth);
  const audit=auditSummary(truth);

  let objectWrite="not-written";
  if(writeMode){
    const rawObject={
      version:1,
      contract:"earth2036-fundamentals-raw-object-v1",
      cik:truth.identity.cik,
      factStateHash:truth.factStateHash,
      source:truth.source,
      rawTruth:truth.rawTruth
    };
    const objectPath=path.join(ROOT,outputDir,"objects",truth.identity.cik,truth.factStateHash+".json");
    objectWrite=await writeImmutableJson(objectPath,rawObject);
  }

  results.push({
    ticker:entity.ticker,cik:entity.cik,errors,
    factStateHash:truth.factStateHash,
    snapshotHash:truth.snapshotHash,
    projectionHash:truth.projectionHash,
    objectWrite,
    ...audit,
    details:auditDetails?{
      sourceTaxonomies:truth.source.sourceTaxonomies,
      availabilityBasis:truth.source.availabilityBasis,
      currentFactIndexCount:truth.rawTruth.currentFactIndexes.length,
      supersessionCount:truth.rawTruth.supersessions.length
    }:undefined
  });

  manifestCompanies.push({
    ticker:entity.ticker,
    cik:entity.cik,
    factStateHash:truth.factStateHash,
    snapshotHash:truth.snapshotHash,
    projectionHash:truth.projectionHash,
    validationPassed:errors.length===0,
    audit
  });

  // 8 requests/sec max here, below SEC's published 10 req/sec ceiling.
  await new Promise(r=>setTimeout(r,125));
}

let manifestWrite="not-written";
if(writeMode){
  const safeAsOf=asOf.replaceAll(":","-");
  const manifest={
    version:1,
    contract:"earth2036-fundamentals-snapshot-manifest-v1",
    asOf,
    companies:manifestCompanies
  };
  manifestWrite=await writeImmutableJson(path.join(ROOT,outputDir,"manifests",safeAsOf+".json"),manifest);
}

const failed=results.filter(r=>r.errors.length);
const aggregate={
  companies:results.length,
  failed:failed.length,
  totalRawFactCount:results.reduce((sum,row)=>sum+row.rawFactCount,0),
  totalRawTruthBytes:results.reduce((sum,row)=>sum+row.rawTruthBytes,0),
  zeroRawFactCompanies:results.filter((row)=>row.rawFactCount===0).map((row)=>row.ticker),
  normalizedCoverage:{
    min:results.length?Math.min(...results.map((row)=>row.normalizedObservedMetricCount)):0,
    max:results.length?Math.max(...results.map((row)=>row.normalizedObservedMetricCount)):0,
    average:results.length?Math.round(results.reduce((sum,row)=>sum+row.normalizedObservedMetricCount,0)/results.length*100)/100:0
  },
  highAmbiguity:results.filter((row)=>row.normalizedAmbiguousPeriodCount>=20)
    .map((row)=>({ticker:row.ticker,count:row.normalizedAmbiguousPeriodCount})),
  lowNormalizedCoverage:results.filter((row)=>row.normalizedObservedMetricCount<=6)
    .map((row)=>({ticker:row.ticker,count:row.normalizedObservedMetricCount,missing:row.normalizedMissingMetrics})),
  largestRawStates:[...results].sort((a,b)=>b.rawTruthBytes-a.rawTruthBytes).slice(0,10)
    .map((row)=>({ticker:row.ticker,bytes:row.rawTruthBytes,facts:row.rawFactCount})),
  failures:failed.map((row)=>({ticker:row.ticker,errors:row.errors}))
};
console.log(JSON.stringify({
  contract:"earth2036-fundamentals-truth-v1",
  source:"SEC XBRL Company Facts",
  asOf,writeMode,manifestWrite,
  aggregate,
  results:summaryOnly?results.filter((row)=>
    row.errors.length||row.rawFactCount===0||row.normalizedObservedMetricCount<=6||row.normalizedAmbiguousPeriodCount>=20
  ):results
},null,2));
if(failed.length) process.exitCode=1;
