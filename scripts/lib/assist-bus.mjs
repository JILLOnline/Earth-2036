import { createHash } from "node:crypto";

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20);
}

function latestAttempt(roleRuns, requestId, inputSignature) {
  const attempts = [];
  for (const run of roleRuns || []) {
    for (const attempt of run?.assistAttempts || []) {
      if (attempt?.requestId === requestId && attempt?.inputSignature === inputSignature) {
        attempts.push({ ...attempt, generatedAt: run.generatedAt || null });
      }
    }
  }
  return attempts.sort((a,b) => Date.parse(b.generatedAt || 0) - Date.parse(a.generatedAt || 0))[0] || null;
}

function statePriority(state) {
  return state === "chief_ready" ? 120 :
    state === "packet_ready" ? 110 :
    state === "evidence_complete" ? 95 :
    state === "researching" ? 70 : 40;
}

function failurePriority(failures) {
  if (failures.includes("missing_primary_source")) return 40;
  if (failures.includes("missing_source_lineage")) return 32;
  if (failures.includes("missing_factor_evidence")) return 22;
  if (failures.includes("missing_numeric_score_record")) return 18;
  if (failures.includes("missing_score_risk_evidence")) return 14;
  if (failures.includes("missing_data_confidence_evidence")) return 12;
  return 0;
}

function requestFor(packet, row, helperRole, capability, rootOwner, failures, nowIso) {
  const requestId = `assist:${packet.ticker}:${rootOwner}:${helperRole}:${capability}`;
  const inputSignature = hash({
    ticker: packet.ticker,
    state: row?.state,
    failures: [...failures].sort(),
    evidencePaths: [...(packet.evidencePaths || [])].sort(),
    gatingIssues: packet.gatingIssues || [],
    unknowns: packet.unknowns || [],
  });
  const exactQuestion = capability === "source-acquisition"
    ? "Acquire materially new primary or independent evidence reusable by the root owner to close source-addressed underwriting gaps."
    : capability === "causal-source-support"
      ? "Acquire evidence that can strengthen or falsify the causal mechanism without taking over the root owner's causal judgment."
      : capability === "risk-source-support"
        ? "Acquire source-addressed downside, execution-risk and falsifier evidence Alpha can reuse without setting Alpha's numeric risk or score."
        : "Provide bounded support without assuming the root owner's authority.";
  return {
    version: 1,
    requestId,
    inputSignature,
    ticker: packet.ticker,
    workId: packet.workId,
    sourceState: row?.state || packet.sourceState,
    rootOwner,
    helperRole,
    capability,
    exactQuestion,
    failures: [...new Set(failures)],
    packetPath: `data/runtime/workgraph/packets/${packet.ticker}.json`,
    evidencePaths: packet.evidencePaths || [],
    successCondition: "New source-addressed evidence changes the packet input signature or allows the root owner to close at least one owned failure.",
    guardrails: [
      "Helper does not create or overwrite the root owner's authoritative perspective.",
      "Helper preserves exact source lineage and does not invent facts.",
      "An unchanged failed input becomes dormant instead of being retried indefinitely."
    ],
    priority: statePriority(row?.state || packet.sourceState) +
      failurePriority(failures) +
      Math.min(12, Number(packet?.specialistCoverage?.present?.length || 0) * 2) +
      Math.min(8, Number(row?.attempts || 0) * 2),
    generatedAt: nowIso,
  };
}

export function buildAssistRequests(graph, packets, roleRuns = [], nowIso = new Date().toISOString()) {
  const requests = [];
  for (const packet of packets || []) {
    const row = graph?.companies?.[packet.ticker];
    if (!row || !["researching","evidence_complete","packet_ready","chief_ready"].includes(row.state)) continue;
    const failures = packet?.preflight?.failures || [];
    const isFrontier = ["packet_ready","chief_ready"].includes(row.state);
    const evidenceStarted = Number(packet?.evidencePaths?.length || 0) > 0;
    const researchAssistEligible = row.state === "researching" && evidenceStarted;
    const assistEligible = isFrontier || researchAssistEligible;

    const alphaSourceFailures = failures.filter((failure) => [
      "missing_primary_source","missing_source_lineage","missing_factor_evidence",
      "missing_numeric_score_record","missing_score_risk_evidence","missing_data_confidence_evidence"
    ].includes(failure));
    if (alphaSourceFailures.length && assistEligible) {
      requests.push(requestFor(packet, row, "earth-scout", "source-acquisition", "council-alpha", alphaSourceFailures, nowIso));
    }

    const alphaRiskFailures = failures.filter((failure) => failure === "missing_score_risk_evidence");
    if (alphaRiskFailures.length && assistEligible) {
      requests.push(requestFor(packet, row, "council-beta", "risk-source-support", "council-alpha", alphaRiskFailures, nowIso));
    }

    const betaSourceFailures = failures.filter((failure) => failure === "missing_causal_mapping");
    if (betaSourceFailures.length && assistEligible) {
      requests.push(requestFor(packet, row, "earth-scout", "causal-source-support", "council-beta", betaSourceFailures, nowIso));
    }
  }

  const capacityByHelper = {
    "earth-scout": 6,
    "council-alpha": 4,
    "council-beta": 4,
    "deep-resolver": 3,
  };
  const enriched = requests
    .map((request) => {
      const prior = latestAttempt(roleRuns, request.requestId, request.inputSignature);
      const dormantOutcomes = new Set([
        "unavailable",
        "blocked",
        "no_new_evidence",
        "no_new_material_evidence",
        "existing_lineage_already_contains_candidate_source",
        "skipped_same_signature_prior_failure",
        "skipped_unchanged_input",
      ]);
      const unchangedFailure = prior && dormantOutcomes.has(String(prior.outcome || ""));
      return {
        ...request,
        status: unchangedFailure ? "dormant_until_input_changes" : "candidate",
        priorAttempt: prior || null,
      };
    })
    .sort((a,b) => b.priority - a.priority || a.ticker.localeCompare(b.ticker));

  const activeCountByHelper = {};
  const scheduled = enriched.map((request) => {
    if (request.status === "dormant_until_input_changes") return request;
    const used = activeCountByHelper[request.helperRole] || 0;
    const cap = capacityByHelper[request.helperRole] || 0;
    if (used >= cap) return { ...request, status: "queued_capacity" };
    activeCountByHelper[request.helperRole] = used + 1;
    return { ...request, status: "active" };
  });

  const active = scheduled.filter((request) => request.status === "active");
  const dormant = scheduled.filter((request) => request.status === "dormant_until_input_changes");
  const queued = scheduled.filter((request) => request.status === "queued_capacity");
  return {
    version: 1,
    contract: "earth2036-assist-bus-v1",
    generatedAt: nowIso,
    policy: {
      rootOwnerRetainsAuthority: true,
      oneHelperPerRequest: true,
      unchangedFailedInputSleeps: true,
      helperCapacityBounded: true,
      canonicalAuthorityUnchanged: true,
    },
    capacityByHelper,
    total: scheduled.length,
    active: active.length,
    dormant: dormant.length,
    queued: queued.length,
    byHelper: Object.fromEntries(
      ["earth-scout","council-alpha","council-beta","deep-resolver"].map((role) => [
        role,
        active.filter((request) => request.helperRole === role).length,
      ])
    ),
    requests: scheduled,
  };
}
