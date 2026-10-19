// Immutable, bounded *original SEC byte* acquisition for historical T0 research.
// A verified download is NOT as-of eligibility, formal review, underwriting,
// canonical promotion, Chief approval, or qualified tick evidence.
import { assertSecDocumentIdentity } from "./sec-document-authentication.mjs";

export const T0_SOURCE_ACQUISITION_CONTRACT="earth2036-t0-primary-original-acquisition-v1";
export const T0_SOURCE_CUTOFF="2026-09-12T23:59:59-04:00";
export const T0_ORIGINAL_CANDIDATES=Object.freeze([
  {
    ticker:"AEVA",cik:"1789029",accessionNumber:"0001193125-26-335102",
    primaryDocument:"aeva-20260730.htm",filingDate:"2026-08-05",
    expectedDocumentSha256:"b050086dad483b12be4c2bf5cccc7dafb70f3bb89a859d3236b92de7233708c0",
  },
  {
    ticker:"AEVA",cik:"1789029",accessionNumber:"0001193125-26-359631",
    primaryDocument:"ownership.xml",filingDate:"2026-08-20",
    expectedDocumentSha256:"8fed58031bfcfc1a03ce1348da00477fe50a985c7e4c8c9c5b625ce5772a7411",
  },
  {
    ticker:"AEVA",cik:"1789029",accessionNumber:"0001193125-26-338179",
    primaryDocument:"aeva-20260630.htm",filingDate:"2026-08-06",
    expectedDocumentSha256:"50a50d985259e53b3aa25eddcdc0fa1a654d724d8c079d7030261a43de7b0b35",
  },
  {
    ticker:"SWKS",cik:"4127",accessionNumber:"0000004127-26-000049",
    primaryDocument:"swks-20260703.htm",filingDate:"2026-07-28",
    expectedDocumentSha256:null,
  },
]);

const hash64=/^[0-9a-f]{64}$/;
export function validateT0PrimaryCandidate(row,manifest){
  if(manifest?.baselineId!=="earth2036-official-t0-2026-09-12"||
      manifest?.methodologyVersion!=="1.0.0"||
      manifest?.evidenceWindowEnd!==T0_SOURCE_CUTOFF||
      manifest?.expectedCompanies!==250)
    throw new Error("t0_source_manifest_governance_mismatch");
  if(!row||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(row.filingDate||"")||
      !Number.isFinite(Date.parse(row.filingDate+"T00:00:00Z"))||
      new Date(row.filingDate+"T00:00:00Z").toISOString().slice(0,10)!==row.filingDate||
      row.filingDate>manifest.evidenceWindowEnd.slice(0,10))
    throw new Error("t0_source_not_proven_pre_cutoff_date");
  if(row.expectedDocumentSha256!==null&&!hash64.test(row.expectedDocumentSha256))
    throw new Error("t0_source_invalid_pinned_sha");
  const accession=row.accessionNumber;
  const primary=row.primaryDocument;
  const normalizedCik=BigInt(row.cik).toString();
  const filing={
    id:row.ticker+":"+accession,ticker:row.ticker,cik:row.cik,
    accessionNumber:accession,primaryDocument:primary,
    sourceUrl:"https://www.sec.gov/Archives/edgar/data/"+normalizedCik+
      "/"+accession.replaceAll("-","")+"/"+primary,
  };
  assertSecDocumentIdentity(filing);
  return filing;
}
export function assertOriginalSourceBytes(row,artifact){
  if(row.expectedDocumentSha256&&artifact?.sourceDocumentSha256!==row.expectedDocumentSha256)
    throw new Error("t0_source_pinned_original_byte_hash_changed");
  return {historicalAdmission:false,reviewed:false,firstPublicAsOfCutoffVerified:false};
}
