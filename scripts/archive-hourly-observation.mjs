#!/usr/bin/env node
// Immutable post-T0 observation history, independent of qualified trial tick status.
// Git history retains the exact full observation-source file; this compact snapshot
// keeps all 250 per-company fingerprints and a SHA-256 of each raw input file.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { hourStart } from './hourly-accountability.mjs';

const ROOT=process.cwd();
const RUNTIME=path.join(ROOT,'data','runtime');
const MANIFEST=path.join(ROOT,'data','baselines','earth2036-official-t0-2026-09-12','manifest.json');
const sha256=s=>createHash('sha256').update(s).digest('hex');

export function buildHourlyObservationArchive({state,manifest,observations,sourceHealth,rawHashes}) {
  if (!manifest?.published || state?.phase !== 'trial') return null;
  const hourKey=state?.cycleKey;
  hourStart(hourKey); // enforce strict UTC hourly identity
  const source=observations?.candidates ?? {};
  const names=Object.keys(source).sort();
  const candidates=Object.fromEntries(names.map(ticker=>{
    const item=source[ticker]||{};
    const filings=Array.isArray(item.filings)?item.filings:[];
    return [ticker,{
      status:item.status??null, observedAt:item.observedAt??null,
      cik:item.cik??null, filingFingerprint:item.filingFingerprint??null,
      filingCount:filings.length, latestFilingAccession:filings[0]?.accessionNumber??null,
      latestFilingDate:filings[0]?.filingDate??null
    }];
  }));
  return {
    contract:'earth2036-post-t0-hourly-observation-v1',
    authority:'observation-only-nonqualifying-history',
    cycleKey:hourKey, observedAt:state.lastCycleAt,
    methodologyVersion:state.methodologyVersion, universeVersion:state.universeVersion,
    observedCompanyCount:state.companiesObserved, archiveCandidateCount:names.length,
    identityValidated:state.identityValidated, tradabilityValidated:state.tradabilityValidated,
    scoreRecords:state.scoredCompanies, publishableCompanies:state.publishableCompanies,
    unresolvedEvidence:state.unresolvedEvidence,
    machineSourceCoverage:state.machineSourceCoverageRatio,
    supervisorSourceCoverage:state.supervisorSourceCoverageRatio,
    combinedSourceCoverage:state.combinedSourceCoverageRatio,
    discoveryScanCompleted:state.discoveryScanCompleted,
    qualifiedTrialTick:state.qualifiedTick===true,
    qualifiedTrialCount:state.qualifiedTrialTicks,
    sourceHealth: (sourceHealth?.sources||[]).map(s=>({
      id:s.id,status:s.status,coverage:s.coverage,lastSuccess:s.lastSuccess??null,
      lastFailure:s.lastFailure??null,requiredForTick:s.requiredForTick===true
    })),
    rawFileHashes:rawHashes, candidates,
    limitations:'Historical observation, not a price-series bar or a qualified trial tick. Full source payloads are recoverable from the corresponding committed Git tree; immutable tick authority remains the existing finalizer.'
  };
}
async function main(){
 const files=[
  path.join(RUNTIME,'system-state.json'),
  MANIFEST,
  path.join(RUNTIME,'company-observations.json'),
  path.join(RUNTIME,'source-health.json')
 ];
 const raw=await Promise.all(files.map(f=>readFile(f,'utf8')));
 const [state,manifest,observations,sourceHealth]=raw.map(JSON.parse);
 const row=buildHourlyObservationArchive({
   state,manifest,observations,sourceHealth,
   rawHashes:{systemState:sha256(raw[0]),companyObservations:sha256(raw[2]),sourceHealth:sha256(raw[3])}
 });
 if(!row){console.log('T0 unpublished: no post-T0 archive generated.');return}
 const f=path.join(RUNTIME,'hourly-observations',row.cycleKey+'.json');
 await mkdir(path.dirname(f),{recursive:true});
 try{
   await writeFile(f,JSON.stringify(row,null,2)+'\n',{flag:'wx'});
   console.log('Archived post-T0 hourly observations: '+row.cycleKey);
 }catch(e){
   if(e.code!=='EEXIST')throw e;
   const prior=JSON.parse(await readFile(f,'utf8'));
   if(prior.cycleKey!==row.cycleKey || prior.contract!==row.contract)throw Error('Immutable hourly archive conflict');
   console.log('Immutable post-T0 hourly observation already exists for '+row.cycleKey);
 }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(e=>{console.error(e);process.exitCode=1});
}
