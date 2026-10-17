import {createHash} from "node:crypto";

export const CONTINUITY_CONTRACT="earth2036-phoenix-continuity-acceptance-v1";
const SHA=/^[a-f0-9]{64}$/;
const keyPattern=/^(\d{4})(\d{2})(\d{2})T(\d{2})00Z$/;
function slotEpoch(key){
  if(typeof key!=="string")throw new Error("phoenix_continuity_bad_hour");
  const m=keyPattern.exec(key);
  if(!m)throw new Error("phoenix_continuity_bad_hour");
  const [_,y,mo,d,h]=m;
  const n=Date.UTC(Number(y),Number(mo)-1,Number(d),Number(h));
  const reconstructed=new Date(n).toISOString().replace(/[-:]/g,"").slice(0,11)+"00Z";
  if(reconstructed!==key)throw new Error("phoenix_continuity_impossible_hour");
  return n;
}
function authorizedOriginalRun(row){
  return Array.isArray(row.schedulerRuns) && row.schedulerRuns.some(x=>
    ["schedule","workflow_dispatch"].includes(x.event) &&
    x.status==="completed" && x.conclusion==="success" &&
    Number.isSafeInteger(x.id) && x.id>0 && typeof x.createdAt==="string" &&
    Number.isFinite(Date.parse(x.createdAt)) &&
    Date.parse(x.createdAt)>=slotEpoch(row.hourKey) &&
    Date.parse(x.createdAt)<slotEpoch(row.hourKey)+3600000
  );
}
function auditRow(row){
  const observed=row.retrospectiveObservationStatus==="persisted_now" &&
    Number.isSafeInteger(row.cycleHistoryLine) && row.cycleHistoryLine>0 &&
    SHA.test(row.sourceLineSha256||"");
  const scheduler=authorizedOriginalRun(row);
  const asOf=row.asOfObservationStatus==="persisted" &&
    SHA.test(row.asOfReceiptSha256||"") &&
    typeof row.asOfReceiptPath==="string" &&
    row.asOfReceiptPath.endsWith("/"+row.hourKey+".json");
  const failure=row.retrospectiveObservationStatus==="still_missing" ||
    !observed || !scheduler;
  return {hourKey:row.hourKey,observed,confirmedOriginalScheduler:scheduler,
    asOfReceipt:asOf,passesObservationContinuity:!failure,
    passesAsOfContinuity:observed&&scheduler&&asOf,
    issues:[
      ...(!observed?["immutable_observation_missing_or_unverified"]:[]),
      ...(!scheduler?["original_scheduler_success_unverified"]:[]),
      ...(!asOf?["as_of_receipt_missing_or_unverified"]:[])
    ]};
}
function streak(rows, key){
  let longest=0,running=0;
  for(const row of rows){
    running=row[key]?running+1:0;
    longest=Math.max(longest,running);
  }
  return {longest,trailing:running};
}
function segment(rows,hours){
  const selected=rows.slice(-hours);
  const counts={
    persistedWithLineage:selected.filter(x=>x.observed).length,
    originalSchedulerAttested:selected.filter(x=>x.confirmedOriginalScheduler).length,
    asOfReceiptsVerified:selected.filter(x=>x.asOfReceipt).length,
    completeObservationHours:selected.filter(x=>x.passesObservationContinuity).length,
    completeAsOfHours:selected.filter(x=>x.passesAsOfContinuity).length
  };
  const a=streak(selected,"passesObservationContinuity");
  const b=streak(selected,"passesAsOfContinuity");
  const full=selected.length===hours;
  return {hours,firstHour:selected[0]?.hourKey||null,lastHour:selected.at(-1)?.hourKey||null,
    fullWindowPresent:full,...counts,
    missingOriginalObservationHours:hours-counts.persistedWithLineage,
    incompleteAsOfHours:hours-counts.completeAsOfHours,
    trailingObservedStreak:a.trailing,longestObservedStreak:a.longest,
    trailingFullyAuditedStreak:b.trailing,longestFullyAuditedStreak:b.longest,
    observationGate:full && counts.completeObservationHours===hours?"passed":"not_qualified",
    asOfGate:full && counts.completeAsOfHours===hours?"passed":"not_qualified"};
}

export function assessPhoenixContinuity(reconciliation){
  if(reconciliation?.contract!=="earth2036-retrospective-hourly-reconciliation-v1" ||
    reconciliation.windowHours!==72 || !Array.isArray(reconciliation.rows) ||
    reconciliation.rows.length!==72 ||
    !Number.isFinite(Date.parse(reconciliation.checkedAt||"")) ||
    reconciliation.governance?.backfillsObservations!==false)
    throw new Error("phoenix_continuity_source_unverified");
  const rows=reconciliation.rows;
  const sorted=[...rows].sort((a,b)=>a.hourKey.localeCompare(b.hourKey));
  for(let i=0;i<sorted.length;i++){
    if(sorted[i]!==rows[i])throw new Error("phoenix_continuity_hour_order_mismatch");
    const n=slotEpoch(rows[i].hourKey);
    if(i && n-slotEpoch(rows[i-1].hourKey)!==3600000)
      throw new Error("phoenix_continuity_missing_or_duplicate_slot");
    if(n>=Date.parse(reconciliation.checkedAt))
      throw new Error("phoenix_continuity_future_slot");
  }
  const observed=rows.map(auditRow);
  const six=segment(observed,6),day=segment(observed,24),threeDays=segment(observed,72);
  const sourceFingerprint=createHash("sha256").update(JSON.stringify(rows.map(x=>({
    hourKey:x.hourKey,sourceLineSha256:x.sourceLineSha256||null,
    asOfReceiptSha256:x.asOfReceiptSha256||null,
    runs:(x.schedulerRuns||[]).map(r=>[r.id,r.conclusion,r.event])
  })))).digest("hex");
  return{
    contract:CONTINUITY_CONTRACT,version:1,mode:"immutable_history_retrospective_read_only",
    checkedAt:reconciliation.checkedAt,sourceFingerprint,
    authority:{schedulerDispatch:false,syntheticObservations:false,backfills:false,
      workerResume:false,sourceApproval:false,scoreWrites:false,canonicalWrites:false,qualifiedTicks:false},
    windows:{"6h":six,"24h":day,"72h":threeDays},
    latestHour:observed.at(-1)?.hourKey||null,
    recentEvidence:observed.slice(-6),
    acceptance:{
      sixConsecutiveOriginalObservations:six.observationGate==="passed",
      sixConsecutiveWithAsOfReceipt:six.asOfGate==="passed",
      twentyFourHourOriginalContinuity:day.observationGate==="passed",
      seventyTwoHourOriginalContinuity:threeDays.observationGate==="passed",
      allGatesSatisfied:six.asOfGate==="passed"&&day.asOfGate==="passed"&&threeDays.asOfGate==="passed"
    },
    note:"Scheduled successes alone never qualify observation continuity. This report never backfills missing hours or infers research/canonical progress from uptime."
  };
}
