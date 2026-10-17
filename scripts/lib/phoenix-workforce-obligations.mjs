import {createHash} from "node:crypto";

export const WORKFORCE_OBLIGATIONS_CONTRACT="earth2036-phoenix-workforce-obligations-shadow-v1";
export const WORKFORCE_ROLES=["earth-scout","council-alpha","council-beta","deep-resolver","chief-earth"];
const id=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0,20);
const count=v=>Number.isFinite(Number(v))?Math.max(0,Math.trunc(Number(v))):0;
const priority=v=>Number.isFinite(Number(v))?Number(v):0;
const isObject=v=>v && typeof v==="object" && !Array.isArray(v);

function statusFor(owner, roster, isDeferred=false) {
  if(isDeferred)return "awaiting_verified_source_and_worker_clearance";
  const role=roster?.[owner];
  if(role?.clearance==="safety_hold")return "requires_safety_review";
  if(role?.enabled===false)return "requires_disable_reason_review";
  // A task in enabled state is not proof of acknowledgement, source production,
  // or write authority. A GitHub-only read cannot authenticate enabled state.
  return role?.enabled===true?"awaiting_explicit_worker_acknowledgement":"executor_state_unverified";
}
function makeObligation(kind, role, ticker, requestId, fingerprint, priorityValue, exactQuestion, meta, roster, deferred=false) {
  if(!WORKFORCE_ROLES.includes(role) || !ticker || !requestId)
    throw new Error("phoenix_invalid_owner_or_request");
  const status=statusFor(role,roster,deferred);
  return {
    id:id({kind,role,ticker,requestId,fingerprint}),kind,ticker,
    owner:role,requestId,inputSignature:fingerprint||null,priority:priorityValue,
    exactQuestion:exactQuestion||"Confirm the exact source-addressed work requirement from the packet.",
    status, ...meta,
    executionAuthorized:false, acknowledged:false, evidenceCommitted:false,
    canonicalWritesAuthorized:false, mustValidateBeforeConsumption:true,
  };
}

export function buildWorkforceObligations({assistViews={},routingViews={},sourceDependencyHandoffs=null,roster=null,generatedAt=null}={}) {
  if(roster!==null && !isObject(roster)) throw new Error("phoenix_invalid_roster");
  const found=[];
  for(const role of WORKFORCE_ROLES) {
    const assist=assistViews[role];
    for(const request of assist?.requests||[]) {
      if(request?.status!=="active")continue;
      if(request.helperRole!==role || !request.requestId || !request.inputSignature)
        throw new Error("phoenix_invalid_source_assist_contract");
      found.push(makeObligation("source_assist",role,request.ticker,request.requestId,
        request.inputSignature,priority(request.priority),request.exactQuestion,{
          rootOwner:request.rootOwner||null,capability:request.capability||null,
          packetPath:request.packetPath||null,sourceView:"assist/"+role,
        },roster));
    }
    const routes=routingViews[role];
    for(const item of routes?.items||[]) {
      if(item?.deferred===true)continue;
      if(!item?.ticker || !item?.packetPath || !Array.isArray(item.ownedFailures))
        throw new Error("phoenix_invalid_workgraph_route");
      const signature=id({ticker:item.ticker,ownedFailures:[...item.ownedFailures].sort(),
        evidencePaths:[...(item.evidencePaths||[])].sort(),guard:item.executionGuard||null});
      found.push(makeObligation("owned_route",role,item.ticker,
        "route:"+role+":"+item.ticker,signature,1000-count(item.rank),
        "Close exactly these owned preflight failures with source-addressed evidence: "+item.ownedFailures.join(", "),{
          packetPath:item.packetPath,sourceView:"routing/"+role,
          ownedFailures:item.ownedFailures,
          changedStrategyRequired:item.executionGuard==="changed_strategy_required",
        },roster));
    }
  }
  for(const item of sourceDependencyHandoffs?.selected||[]) {
    if(item?.taskExecutionAuthorized!==false || item?.isActionableResolverContradiction!==false ||
        !item?.ticker || !item?.researchId || !item?.sourceOwner || !item?.signature)
      throw new Error("phoenix_unsafe_source_dependency_admission");
    found.push(makeObligation("deferred_source_dependency",item.sourceOwner,item.ticker,
      item.researchId,item.signature,100,item.problem,{
        packetPath:item.packetPath||null,rootOwner:item.rootOwner||null,
        exactMissingFacts:item.exactMissingFacts||[],
        sourceView:"source-dependency-handoffs/selected",materialityVerified:false,
      },roster,true));
  }
  const seen=new Set();
  for(const row of found) {
    if(seen.has(row.id))throw new Error("phoenix_duplicate_obligation_id");
    seen.add(row.id);
  }
  const buckets=found.reduce((acc,row)=>(acc[row.status]=(acc[row.status]||0)+1,acc),{});
  found.sort((a,b)=>b.priority-a.priority || a.ticker.localeCompare(b.ticker) || a.kind.localeCompare(b.kind));
  return {
    contract:WORKFORCE_OBLIGATIONS_CONTRACT,version:1,
    generatedAt,mode:"diagnostic_only",sourceAuthority:"GitHub Workgraph worker-view",
    rosterStatus:roster?"external_operator_context_unverified_by_repository":"not_available_from_repository",
    governance:{workerRestart:false,automaticTaskAssignment:false,tokenGrants:false,
      scoreWrites:false,canonicalWrites:false,sourceApproval:false},
    total:found.length,byStatus:buckets,
    actionableWithoutWorkerAck:0,
    selected:found.slice(0,12),
    compact:found.map(x=>({id:x.id,ticker:x.ticker,owner:x.owner,kind:x.kind,status:x.status,requestId:x.requestId})),
    rule:"No role is 'working' without a matching explicit receipt. A deferred contradiction is a source dependency, not a valid resolver claim pair.",
  };
}
