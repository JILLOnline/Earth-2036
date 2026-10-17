import { createHash } from "node:crypto";
import { WORKFORCE_OBLIGATIONS_CONTRACT, WORKFORCE_ROLES } from "./phoenix-workforce-obligations.mjs";

export const WORKER_LEASE_CONTRACT = "earth2036-phoenix-worker-lease-ledger-v1";
export const WORKER_ACK_CONTRACT = "earth2036-phoenix-worker-acknowledgment-v1";
export const ACK_TIMEOUT_MS = 120 * 60_000;
export const ACK_MAX_AGE_MS = 120 * 60_000;
const sha256 = text => createHash("sha256").update(text).digest("hex");
const cleanTime = value => {
  const n=Date.parse(value||"");
  return Number.isFinite(n)?new Date(n).toISOString():null;
};
const validSha = value => typeof value==="string" && /^[a-f0-9]{64}$/.test(value);
const own = (obj,k) => Object.prototype.hasOwnProperty.call(obj||{},k);

export function validateWorkerAck(receipt, obligation, now, origin={}) {
  // All source bytes are only a SELF-DECLARED role assertion, not authenticated
  // ChatGPT task execution, approved safety clearance, or evidence qualification.
  const when=Date.parse(now), started=Date.parse(receipt?.acknowledgedAt||"");
  if (receipt?.contract!==WORKER_ACK_CONTRACT || receipt?.version!==1)
    return {valid:false,reason:"invalid_ack_contract"};
  if (receipt?.obligationId!==obligation.id || receipt?.owner!==obligation.owner ||
    receipt?.requestId!==obligation.requestId || receipt?.inputSignature!==obligation.inputSignature ||
    receipt?.ticker!==obligation.ticker)
    return {valid:false,reason:"ack_target_or_input_mismatch"};
  if (!validSha(origin.byteSha256) || !origin.path?.startsWith("data/operations/phoenix/worker-acks/"))
    return {valid:false,reason:"ack_source_provenance_unverified"};
  if (!cleanTime(receipt.acknowledgedAt) || started>when || when-started>ACK_MAX_AGE_MS ||
    !["accepted_for_review","blocked_safety_hold","cannot_proceed"].includes(receipt.disposition))
    return {valid:false,reason:"ack_timestamp_or_disposition_invalid"};
  if (receipt.disposition==="accepted_for_review" && (!Array.isArray(receipt.newEvidencePaths) ||
    receipt.newEvidencePaths.some(x=>typeof x!=="string"||!x.startsWith("data/runtime/workgraph/evidence/"))))
    return {valid:false,reason:"evidence_reference_invalid"};
  return {valid:true,reason:"self_declared_ack_matches_obligation",disposition:receipt.disposition,
    at:cleanTime(receipt.acknowledgedAt),sourcePath:origin.path,sourceByteSha256:origin.byteSha256,
    newEvidencePaths:Array.isArray(receipt.newEvidencePaths)?receipt.newEvidencePaths:[]};
}

export function advanceWorkerLeaseLedger(obligations, previous=null, ackRecords=[], now) {
  if (obligations?.contract!==WORKFORCE_OBLIGATIONS_CONTRACT ||
      !Array.isArray(obligations.allObligations) || !cleanTime(now) ||
      (previous && previous.contract!==WORKER_LEASE_CONTRACT))
    throw new Error("phoenix_invalid_lease_inputs");
  if (!Array.isArray(ackRecords))throw new Error("phoenix_invalid_ack_records");
  const seen=new Set(),current=new Set(), prior=new Map((previous?.entries||[]).map(x=>[x.id,x]));
  if (prior.size!==(previous?.entries||[]).length) throw new Error("phoenix_duplicate_previous_lease");
  const entries=[];
  const when=Date.parse(now);
  for (const obligation of obligations.allObligations) {
    if (!obligation.id || !obligation.owner || !WORKFORCE_ROLES.includes(obligation.owner) ||
        !obligation.requestId || !obligation.inputSignature || seen.has(obligation.id))
      throw new Error("phoenix_invalid_or_duplicate_obligation");
    seen.add(obligation.id);current.add(obligation.id);
    const old=prior.get(obligation.id);
    const firstSeenAt=old?.firstSeenAt||cleanTime(now);
    const age=when-Date.parse(firstSeenAt);
    if (!Number.isFinite(age) || age < 0)throw new Error("phoenix_future_or_invalid_lease_first_seen");
    const matches=ackRecords.filter(row=>row?.data?.obligationId===obligation.id);
    let status="awaiting_acknowledgment",ack=null,reason=null;
    if (obligation.kind==="deferred_source_dependency") {
      status="blocked_deferred_source_dependency";
    } else if (obligation.status==="requires_safety_review") {
      status="blocked_safety_hold";
    } else if (obligation.status==="requires_disable_reason_review") {
      status="blocked_disabled_owner";
    } else if (matches.length>1) {
      status="conflicting_acks_needs_review";
    } else if(matches.length===1) {
      const validation=validateWorkerAck(matches[0].data,obligation,now,matches[0].origin);
      if (!validation.valid) {
        status="invalid_ack_needs_review";
        reason=validation.reason;
      } else {
        ack=validation;
        if (validation.disposition==="blocked_safety_hold") status="blocked_safety_hold";
        else if(validation.disposition==="cannot_proceed") status="blocked_worker_reported";
        else status=validation.newEvidencePaths.length?
          "evidence_claim_unvalidated":"ack_recorded_identity_unverified";
      }
    } else if (age>ACK_TIMEOUT_MS) {
      status="unacknowledged_overdue_needs_review";
    }
    entries.push({
      id:obligation.id,owner:obligation.owner,ticker:obligation.ticker,
      kind:obligation.kind,requestId:obligation.requestId,
      inputSignature:obligation.inputSignature,firstSeenAt,
      lastSeenAt:cleanTime(now),status,reason,
      ack,sourceView:obligation.sourceView||null,
      executorAvailability:obligation.status,
      automaticRetryPermitted:false,workerIdentityAuthenticated:false,
      evidenceValidated:false,workgraphClosureConfirmed:false,
      leaseDurationMinutes:Math.trunc(age/60_000),
    });
  }
  // If the source Workgraph stops presenting an obligation, preserve its
  // unresolved history. Disappearance alone never proves completion.
  for (const old of previous?.entries||[]) {
    if(!current.has(old.id)) entries.push({...old,status:"no_longer_routed_unverified",
      automaticRetryPermitted:false, evidenceValidated:false,workgraphClosureConfirmed:false});
  }
  entries.sort((a,b)=>a.id.localeCompare(b.id));
  const byStatus={};
  for (const row of entries) byStatus[row.status]=(byStatus[row.status]||0)+1;
  return {
    contract:WORKER_LEASE_CONTRACT,version:1,mode:"noncanonical_diagnostic_only",
    observedAt:cleanTime(now),
    governance:{workerResume:false,workerAckWrite:false,rejectedWriteRetry:false,
      scoring:false,canonicalPromotion:false,tickQualification:false,
      proofFromRoleRunTimestamp:false},
    count:entries.length,unverifiedQueueCount:entries.filter(x=>x.status==="awaiting_acknowledgment"||x.status==="unacknowledged_overdue_needs_review").length,
    byStatus,entries,
    note:"Git-file self-declared acknowledgments never authenticate worker identity or independently validate evidence. Safety holds and missing signatures fail closed.",
  };
}
