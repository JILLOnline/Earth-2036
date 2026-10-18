#!/usr/bin/env node
// Phoenix P7C — read-only cross-reference against primary SEC submissions.
// Acceptance before T0 is NOT proof of public availability at T0.
import {readFile} from "node:fs/promises";
const file=process.argv[2];
if(!file||process.argv.length!==3)throw Error("Usage: node scripts/phoenix-sec-acceptance-audit.mjs <archive-report.json>");
const source=JSON.parse(await readFile(file,"utf8"));
const cutoff="2026-09-12T23:59:59-04:00";
if(source.contract!=="earth2036-phoenix-p7b-archive-pilot-v3"||
 source.archiveBytesAuthenticated!==true||source.cutoff!==cutoff||
 source.historicalT0EvidenceAdmitted!==0||source.canonicalWriteAuthority!==false||
 source.companies?.length!==2||
 source.companies.map(x=>x.ticker).sort().join(",")!=="AEVA,SWKS")
 throw Error("untrusted_original_archive_pilot_receipt");
const agent=process.env.SEC_USER_AGENT;
if(!agent||agent.length<20)throw Error("SEC_USER_AGENT_required");
const fetchSec=async pathname=>{
 if(!/^\/?(submissions\/CIK\d{10}(?:-submissions-\d{3})?\.json)$/.test(pathname))
  throw Error("unexpected_SEC_submissions_path");
 const url="https://data.sec.gov/"+pathname.replace(/^\//,"");
 const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),18000);
 try{
  const response=await fetch(url,{signal:ctl.signal,headers:{"User-Agent":agent,Accept:"application/json"}});
  if(!response.ok)throw Error("SEC_submissions_http_"+response.status);
  const size=Number(response.headers.get("content-length")||0);
  if(size>14_000_000)throw Error("SEC_submissions_oversize");
  const raw=await response.text();
  if(raw.length>14_000_000)throw Error("SEC_submissions_oversize");
  return {url,body:JSON.parse(raw)};
 }finally{clearTimeout(timeout)}
};
function records(items,sourceUrl){
 if(!items||!Array.isArray(items.accessionNumber))return [];
 const keys=["accessionNumber","filingDate","acceptanceDateTime","form","reportDate","primaryDocument"];
 return items.accessionNumber.map((accn,i)=>({sourceUrl,...Object.fromEntries(keys.map(k=>[k,items[k]?.[i]??null])),accessionNumber:accn}));
}
const out={contract:"earth2036-phoenix-sec-acceptance-triage-v1",
 mode:"noncanonical_read_only",cutoff,originalArchiveSha256:source.archiveSha256,
 secAcceptanceCrosscheckPerformed:true,publicAvailabilityAuthenticated:false,
 originalFilingBytesAuthenticated:false,amendmentSupersessionReviewed:false,
 historicalT0EvidenceAdmitted:0,canonicalWriteAuthority:false,
 workerRestartAuthorized:false,companies:[]};
for(const row of source.companies){
 if(row.archivedFullPayloadVerified!==true||row.cik!==({AEVA:"0001789029",SWKS:"0000004127"})[row.ticker]||
  !Array.isArray(row.historicalAccessions)||!row.historicalAccessions.length)
  throw Error("archive_company_source_not_reconstructed:"+row.ticker);
 const {body,url}=await fetchSec("submissions/CIK"+row.cik+".json");
 if(String(body.cik).replace(/\D/g,"").padStart(10,"0")!==row.cik)
  throw Error("sec_response_cik_mismatch:"+row.ticker);
 const filings=body.filings??{};
 const entries=records(filings.recent,url);
 const filenames=filings.files??[];
 if(filenames.length>40)throw Error("SEC_history_file_count_unbounded:"+row.ticker);
 for(const f of filenames){
  if(!/^CIK\d{10}-submissions-\d{3}\.json$/.test(f.name)||
   !f.name.startsWith("CIK"+row.cik+"-"))
   throw Error("SEC_untrusted_history_filename:"+row.ticker);
  const more=await fetchSec("submissions/"+f.name);
  entries.push(...records(more.body,more.url));
 }
 const byAccession=new Map();
 for(const item of entries){
  if(typeof item.accessionNumber==="string" && !byAccession.has(item.accessionNumber))
   byAccession.set(item.accessionNumber,item);
 }
 const checked=[];
 for(const accn of row.historicalAccessions){
  if(!/^\d{10}-\d{2}-\d{6}$/.test(accn))
   throw Error("archived_accession_identity_invalid:"+row.ticker);
  const found=byAccession.get(accn)??null;
  const acceptance=found?.acceptanceDateTime??null;
  const acceptanceVerified=typeof acceptance==="string"&&
   /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(acceptance)&&
   Number.isFinite(Date.parse(acceptance));
  const received=acceptanceVerified?Date.parse(acceptance):null;
  const acceptanceDisposition=!found?"missing_sec_accession_metadata":
   !acceptanceVerified?"missing_precise_acceptance_timestamp":
   received>Date.parse(cutoff)?"accepted_after_historical_cutoff":"accepted_by_historical_cutoff";
  checked.push({
   accessionNumber:accn,form:found?.form??null,filingDate:found?.filingDate??null,
   reportDate:found?.reportDate??null,
   primaryDocument:found?.primaryDocument??null,
   acceptedAt:acceptanceVerified?acceptance:null,
   acceptanceDisposition,secMetadataUrl:found?.sourceUrl??null,
   amendment:typeof found?.form==="string"&&found.form.endsWith("/A"),
   publicAvailableAt:null,publicAvailabilityAuthenticated:false,
   originalFilingBytesAuthenticated:false,historicalT0EvidenceAdmitted:false
  });
 }
 const counts=checked.reduce((m,x)=>(m[x.acceptanceDisposition]=(m[x.acceptanceDisposition]??0)+1,m),{});
 out.companies.push({
  ticker:row.ticker,cik:row.cik,archivePayloadVerified:true,
  archiveCandidates:row.historicalAccessions.length,counts,accessions:checked,
  allAccessionMetadataMatched:checked.every(x=>x.acceptanceDisposition!=="missing_sec_accession_metadata"),
  nextAction:"Independently verify original filing primary document bytes, acceptance/publication and amendment decisions before historical T0 source admission."
 });
}
console.log(JSON.stringify(out,null,2));
