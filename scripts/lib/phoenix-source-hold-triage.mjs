import {createHash} from "node:crypto";

export const SOURCE_HOLD_CONTRACT="earth2036-phoenix-source-write-hold-triage-v1";
const exact=(v)=>typeof v==="string" && /^[A-Z0-9.-]{1,10}$/.test(v);
const sha=(s)=>createHash("sha256").update(s).digest("hex");
const inPath=(p,prefix)=>typeof p==="string" && p.startsWith(prefix) && !p.includes("..") && p.endsWith(".json");

export function deriveSourceWriteHolds({catalog, sourceFiles, obligations}) {
  if(catalog?.contract!=="earth2036-phoenix-known-write-rejections-v1" ||
    !Array.isArray(catalog.records) || !Array.isArray(obligations?.allObligations))
    throw new Error("phoenix_source_hold_inputs_invalid");
  const findings=[],seen=new Set();
  for(const record of catalog.records) {
    if(!["exact_request","target_unattributed"].includes(record.kind) ||
       !["earth-scout","council-alpha","council-beta","deep-resolver","chief-earth"].includes(record.role) ||
       !exact(record.ticker) ||
       !(inPath(record.sourcePath,"data/runtime/workgraph/receipts/") ||
          inPath(record.sourcePath,"data/runtime/workgraph/role-runs/")))
      throw new Error("phoenix_source_hold_record_invalid");
    if(seen.has(record.sourcePath))throw new Error("phoenix_source_hold_duplicate_record");
    seen.add(record.sourcePath);
    const raw=sourceFiles?.[record.sourcePath];
    if(typeof raw!=="string" || raw.length>128*1024)
      throw new Error("phoenix_source_hold_original_bytes_unavailable");
    let evidence;
    try{evidence=JSON.parse(raw);}
    catch{throw new Error("phoenix_source_hold_original_json_invalid");}
    const evidenceRole=evidence.worker||evidence.role;
    const evidenceTicker=evidence.ticker||evidence.target;
    if(evidenceRole!==record.role || evidenceTicker!==record.ticker)
      throw new Error("phoenix_source_hold_role_or_ticker_mismatch");
    if(record.kind==="exact_request"){
      if(!record.requestId || evidence.assistRequestId!==record.requestId ||
         evidence.status!=="evidence_write_blocked" || evidence.evidenceCommit!=="not_committed")
        throw new Error("phoenix_source_hold_exact_rejection_unverified");
    }else{
      if(record.requestId || evidence.status!=="blocked" ||
         !/rejected.*safety checks|safety checks.*rejected/i.test(evidence.blocker||"") ||
         !evidence.attemptedArtifact)
        throw new Error("phoenix_source_hold_unattributed_rejection_unverified");
    }
    const matched=obligations.allObligations.filter(o=>
      o.owner===record.role && o.ticker===record.ticker &&
      (record.kind!=="exact_request" || o.requestId===record.requestId));
    findings.push({
      scope:record.kind,role:record.role,ticker:record.ticker,
      requestId:record.kind==="exact_request"?record.requestId:null,
      sourcePath:record.sourcePath,sourceSha256:sha(raw),
      originalRecordedAt:evidence.generatedAt||null,
      currentMatchingObligationIds:matched.map(o=>o.id),
      currentMatchingInputSignatures:matched.map(o=>o.inputSignature),
      disposition:record.kind==="exact_request"?"rejected_request_review_required":"historical_target_write_rejection_unattributed",
      autoRetryAuthorized:false,taskDisableCauseVerified:false,roleRestartAuthorized:false,
    });
  }
  const exactHolds=findings.filter(x=>x.scope==="exact_request" && x.currentMatchingObligationIds.length);
  const historicalOnly=findings.filter(x=>!x.currentMatchingObligationIds.length || x.scope!=="exact_request");
  return {
    contract:SOURCE_HOLD_CONTRACT,mode:"read_only_original_bytes_verified",
    scope:"source_write_attempt_not_task_disable_cause",
    currentExactRequestHolds:exactHolds,
    historicalOrUnattributedRejections:historicalOnly,
    findings,
    automaticRetryPermitted:false,
    anyWorkerResumeAuthorized:false,
  };
}

export function assessWorkerResumption({role,taskState=null,disableCause=null,clearance=null,activeSafetyHold=false}) {
  const denial = (reason)=>({role,decision:"hold_disabled",reason,workerRestartAuthorized:false});
  if(!["earth-scout","council-alpha","council-beta","deep-resolver","chief-earth"].includes(role))
    throw new Error("phoenix_unknown_worker_role");
  if(!taskState || typeof taskState.enabled!=="boolean")return denial("actual_task_state_unavailable");
  if(taskState.enabled===true)return {role,decision:"already_enabled_do_not_restart",workerRestartAuthorized:false};
  if(activeSafetyHold)return denial("unresolved_source_write_safety_hold");
  if(!["transient_platform_interruption","operator_pause","safety_or_policy","unknown"].includes(disableCause))
    return denial("disable_cause_unverified");
  if(disableCause!=="transient_platform_interruption")return denial("disable_cause_not_verified_recoverable");
  if(clearance?.verified!==true || clearance?.source!=="authorized_task_run_diagnostics" ||
     typeof clearance?.evidenceId!=="string" || !clearance.evidenceId.trim())
    return denial("independent_clearance_absent");
  // Even a verified benign interruption cannot *perform* a restart from GitHub:
  // the user-facing task control plane must separately authorize execution.
  return {role,decision:"eligible_for_control_plane_review",
    workerRestartAuthorized:false,
    reason:"verified_benign_interruption_needs_separate_operator_execution"};
}
