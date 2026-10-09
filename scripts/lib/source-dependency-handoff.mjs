import { createHash } from "node:crypto";

// Deterministic, non-authoritative research dependency planner. A pending
// source dependency never certifies a contradiction, approves a worker restart
// or gives Chief the right to promote.
const fingerprint = value => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0,24);
const unique = values => [...new Set(values.filter(Boolean))];
const meaningful = value => typeof value === "string" && value.trim().length >= 16;
const stateOrder = { packet_ready: 0, evidence_complete: 1, researching: 2, triaged: 3, observed: 4 };

function missingFacts(packet, adjudication) {
  const direct = (adjudication?.deferredItems || [])
    .map(item => item.exactMissingFact).filter(meaningful);
  const nextPaths = (packet?.gatingIssues || [])
    .flatMap(item => typeof item === "object" ? [item.nextLawfulEvidencePath, item.defect] : [])
    .filter(meaningful);
  const materialUnknowns = (packet?.unknowns || [])
    .filter(item => item && typeof item === "object" && item.gating === true)
    .map(item => item.unknown).filter(meaningful);
  return {
    exactMissingFacts: unique([...direct, ...materialUnknowns]).slice(0,8),
    nextLawfulSourcePaths: unique(nextPaths).slice(0,8),
  };
}

export function buildSourceDependencyHandoffs(graph, packets, resolverQueue, now, options = {}) {
  if (!Number.isFinite(Date.parse(now || ""))) throw new Error("Invalid source-dependency audit time");
  const cap = Math.max(1, Math.min(3, Math.trunc(options.maxPilotCases || 1)));
  const packetsByTicker = new Map((packets || []).map(p=>[p.ticker,p]));
  const candidates = [];
  for (const item of resolverQueue?.deferredItems || []) {
    const packet = packetsByTicker.get(item.ticker);
    const row = graph?.companies?.[item.ticker];
    const adjudication = item.adjudicationPacket;
    if (!packet || !row || ["canonical","blocked","chief_ready"].includes(row.state)) continue;
    if (!(packet.preflight?.failures || []).includes("unresolved_material_contradiction")) continue;
    if (!adjudication || adjudication.actionable !== false || (adjudication.deferredItemCount || 0) < 1) continue;
    const { exactMissingFacts, nextLawfulSourcePaths } = missingFacts(packet, adjudication);
    const researchId = "source-dependency:" + packet.ticker + ":resolver-claim-pair";
    const key = fingerprint({
      ticker: packet.ticker,
      failures: [...(packet.preflight.failures || [])].sort(),
      evidencePaths: [...(packet.evidencePaths || [])].sort(),
      exactMissingFacts,
      nextLawfulSourcePaths,
    });
    candidates.push({
      researchId,
      ticker: packet.ticker,
      workId: packet.workId,
      packetPath: "data/runtime/workgraph/packets/" + packet.ticker + ".json",
      sourceState: row.state,
      rootOwner: "deep-resolver",
      sourceOwner: "earth-scout",
      problem: "Material uncertainty lacks independent, source-addressed opposing claims",
      exactMissingFacts,
      nextLawfulSourcePaths,
      sourceEvidencePaths: (packet.evidencePaths || []).slice(-16),
      signature: key,
      status: "awaiting_verified_source_and_worker_clearance",
      isActionableResolverContradiction: false,
      sourceMaterialityVerified: false,
      taskExecutionAuthorized: false,
      noRepeatUntilChangedInput: true,
      successCondition: "Find new authentic primary-source facts relevant to the margin/volume/refund question, establish separately identifiable claim/source fields or preserve a still-material unknown; then recompile the original packet and independently validate the gate.",
    });
  }
  candidates.sort((a,b) =>
    (stateOrder[a.sourceState] ?? 9) - (stateOrder[b.sourceState] ?? 9)
    || a.ticker.localeCompare(b.ticker)
  );
  return {
    version: 1,
    contract: "earth2036-source-dependency-handoff-v1",
    generatedAt: now,
    canonicalWriteAuthority: false,
    automaticWorkerActivation: false,
    sourceReviewAuthority: false,
    prohibition: "No automatic restart, safety-rejected payload retry, fabricated claim-pair, deferred-input reset, or materiality waiver.",
    totalCandidates: candidates.length,
    pilotLimit: cap,
    selected: candidates.slice(0,cap),
    deferred: candidates.slice(cap).map(x=>({ticker:x.ticker,researchId:x.researchId,signature:x.signature,reason:"bounded_source_dependency_capacity"})),
    decision: candidates.length ? "source_gap_identified_without_adjudication" : "no_unresolved_unsourced_resolver_dependency",
  };
}
