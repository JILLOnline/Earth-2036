// SEC accession completeness is not the same as source materiality.
// Full recent tables, explicit anchor cursors, and archive recovery avoid the
// old 12-entry rolling-window gap. Never infer that an absent record was filed
// at a more recent date or that an unreviewed filing is nonmaterial.

export function secFilingRows(table) {
  const recent=table || {}, numbers=Array.isArray(recent.accessionNumber)?recent.accessionNumber:[];
  const seen=new Set(),rows=[];
  for(let i=0;i<numbers.length;i++){
    const accessionNumber=String(numbers[i]||"").trim();
    if(!/^\d{10}-\d{2}-\d{6}$/.test(accessionNumber) || seen.has(accessionNumber))continue;
    seen.add(accessionNumber);
    rows.push({
      accessionNumber,
      filingDate: recent.filingDate?.[i] ?? null,
      reportDate: recent.reportDate?.[i] ?? null,
      form: recent.form?.[i] ?? null,
      primaryDocument: recent.primaryDocument?.[i] ?? null,
    });
  }
  return rows;
}

export function reconcileSecAccessionCursor(previousObservation, currentRows, archivedRows = []) {
  const anchor=previousObservation?.filings?.[0]?.accessionNumber||null;
  const hadPrevious=Boolean(previousObservation?.filingFingerprint && anchor);
  const combined=[],seen=new Set();
  for(const filing of [...currentRows,...archivedRows]){
    if(!filing?.accessionNumber || seen.has(filing.accessionNumber))continue;
    seen.add(filing.accessionNumber);combined.push(filing);
  }
  if(!hadPrevious){
    return {status:"bootstrap_no_historical_cursor",anchor:null,
      newlyVisible:[],archiveRequired:false,continuityEstablished:false,
      sourceEntriesConsidered:combined.length,reason:"No trustworthy prior accession cursor; cannot assert previously unobserved filings are newly filed."};
  }
  const index=combined.findIndex(filing=>filing.accessionNumber===anchor);
  if(index<0){
    return {status:"prior_cursor_not_found",anchor,newlyVisible:[],
      archiveRequired:true,continuityEstablished:false,
      sourceEntriesConsidered:combined.length,
      reason:"Prior head accession absent from recovered SEC window; preserve previous history and fail closed on source continuity."};
  }
  const previousKnown=new Set((previousObservation?.filings||[]).map(x=>x.accessionNumber));
  // SEC submissions are newest-first; recover all previously unseen entries
  // before the previous known head even if there are 13+ new filings.
  const newlyVisible=combined.slice(0,index).filter(filing=>!previousKnown.has(filing.accessionNumber));
  return {
    status:newlyVisible.length?"new_accessions_since_previous_cursor":"unchanged_head_cursor",
    anchor,newlyVisible,archiveRequired:false,continuityEstablished:true,
    sourceEntriesConsidered:combined.length,existingHeadOffset:index,
    reason:"Accession sequence reconciled to previously observed head; filingDate remains SEC-provided, detection timestamp remains actual machine time.",
  };
}

export function buildSecAccessionContinuityAudit(items,checkedAt){
  const problems=items.filter(x=>x.continuityEstablished!==true);
  return {
    version:1,contract:"earth2036-sec-accession-continuity-v1",generatedAt:checkedAt,
    scope:"prior accession head recovered in full SEC recent table and bounded archive files",
    companiesChecked:items.length,
    continuous:items.length-problems.length,
    incomplete:problems.length,
    recoveredNewAccessions:items.reduce((n,x)=>n+(x.recoveredNewAccessions||0),0),
    issues:problems.map(x=>({ticker:x.ticker,status:x.status,anchor:x.anchor||null,reason:x.reason||null})),
    policy:"An incomplete accession cursor degrades source-continuity coverage; no filing is silently declared reviewed or safe, and no retroactive observation is created.",
  };
}
