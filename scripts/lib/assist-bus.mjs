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

function isLegacyDormantOutcome(value) {
  const outcome = String(value || "").toLowerCase();
  return [
    "unavailable",
    "blocked",
    "no_new_evidence",
    "no_new_material_evidence",
    "existing_lineage_already_contains_candidate_source",
    "skipped_same_signature_prior_failure",
    "skipped_unchanged_input",
  ].includes(outcome);
}

function isDormantOutcome(value) {
  const outcome = String(value || "").toLowerCase();
  return isLegacyDormantOutcome(outcome) ||
    outcome.includes("unchanged_input") ||
    outcome.includes("unchanged_prior") ||
    outcome.includes("not_retried") ||
    outcome.includes("no_new_") ||
    outcome.includes("duplicate");
}

function ageHours(value, nowIso) {
  const a = Date.parse(value || "");
  const b = Date.parse(nowIso || "");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round(((b - a) / 3_600_000) * 100) / 100);
}

function requestFor(packet, row, helperRole, capability, rootOwner, failures, nowIso, options) {
  const requestId = "assist:" + packet.ticker + ":" + rootOwner + ":" + helperRole + ":" + capability;
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
  const lifecycleEnabled = options.lifecycleEnabled !== false;
  const frontier = lifecycleEnabled && options.frontierTickers.has(packet.ticker);
  const operationalStatus = lifecycleEnabled ? (options.operationalStatusByTicker[packet.ticker] || null) : null;
  const stalled = lifecycleEnabled && ["repeated_unchanged_input", "awaiting_external_change"].includes(operationalStatus);
  return {
    version: 2,
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
    packetPath: "data/runtime/workgraph/packets/" + packet.ticker + ".json",
    evidencePaths: packet.evidencePaths || [],
    successCondition: "New source-addressed evidence changes the packet input signature or allows the root owner to close at least one owned failure.",
    guardrails: [
      "Helper does not create or overwrite the root owner's authoritative perspective.",
      "Helper preserves exact source lineage and does not invent facts.",
      "An unchanged failed input becomes dormant instead of being retried indefinitely.",
      ...(lifecycleEnabled ? ["A stalled closure-frontier input must not consume active capacity until its input signature changes."] : []),
    ],
    frontier,
    operationalStatus,
    priority: statePriority(row?.state || packet.sourceState) +
      failurePriority(failures) +
      Math.min(12, Number(packet?.specialistCoverage?.present?.length || 0) * 2) +
      Math.min(8, Number(row?.attempts || 0) * 2) +
      (frontier ? 80 : 0) -
      (stalled ? 120 : 0),
    generatedAt: nowIso,
  };
}

export function buildAssistRequests(
  graph,
  packets,
  roleRuns = [],
  nowIso = new Date().toISOString(),
  previousBus = null,
  options = {}
) {
  const normalizedOptions = {
    frontierTickers: new Set(options.frontierTickers || []),
    operationalStatusByTicker: options.operationalStatusByTicker || {},
    lifecycleEnabled: options.lifecycleEnabled !== false,
  };
  const requests = [];
  for (const packet of packets || []) {
    const row = graph?.companies?.[packet.ticker];
    if (!row || !["researching","evidence_complete","packet_ready","chief_ready"].includes(row.state)) continue;
    const failures = packet?.preflight?.failures || [];
    const isFrontierState = ["packet_ready","chief_ready"].includes(row.state);
    const evidenceStarted = Number(packet?.evidencePaths?.length || 0) > 0;
    const researchAssistEligible = row.state === "researching" && evidenceStarted;
    const assistEligible = isFrontierState || researchAssistEligible;

    const alphaSourceFailures = failures.filter((failure) => [
      "missing_primary_source","missing_source_lineage","missing_factor_evidence",
      "missing_numeric_score_record","missing_score_risk_evidence","missing_data_confidence_evidence"
    ].includes(failure));
    if (alphaSourceFailures.length && assistEligible) {
      requests.push(requestFor(packet, row, "earth-scout", "source-acquisition", "council-alpha", alphaSourceFailures, nowIso, normalizedOptions));
    }

    const alphaRiskFailures = failures.filter((failure) => failure === "missing_score_risk_evidence");
    if (alphaRiskFailures.length && assistEligible) {
      requests.push(requestFor(packet, row, "council-beta", "risk-source-support", "council-alpha", alphaRiskFailures, nowIso, normalizedOptions));
    }

    const betaSourceFailures = failures.filter((failure) => failure === "missing_causal_mapping");
    if (betaSourceFailures.length && assistEligible) {
      requests.push(requestFor(packet, row, "earth-scout", "causal-source-support", "council-beta", betaSourceFailures, nowIso, normalizedOptions));
    }
  }

  const capacityByHelper = {
    "earth-scout": 6,
    "council-alpha": 4,
    "council-beta": 4,
    "deep-resolver": 3,
  };
  const priorByKey = Object.fromEntries(
    (previousBus?.requests || []).map((request) => [
      String(request.requestId) + ":" + String(request.inputSignature),
      request,
    ])
  );
  const enriched = requests
    .map((request) => {
      const priorAttempt = latestAttempt(roleRuns, request.requestId, request.inputSignature);
      const unchangedFailure = priorAttempt && (
        normalizedOptions.lifecycleEnabled
          ? isDormantOutcome(priorAttempt.outcome)
          : isLegacyDormantOutcome(priorAttempt.outcome)
      );
      const key = String(request.requestId) + ":" + String(request.inputSignature);
      const priorRequest = priorByKey[key] || null;
      const firstSeenAt = priorRequest?.firstSeenAt || priorRequest?.generatedAt || request.generatedAt;
      const stalled = normalizedOptions.lifecycleEnabled &&
        ["repeated_unchanged_input", "awaiting_external_change"].includes(request.operationalStatus);
      return {
        ...request,
        firstSeenAt,
        ageHours: ageHours(firstSeenAt, nowIso),
        status: (unchangedFailure || stalled) ? "dormant_until_input_changes" : "candidate",
        priorAttempt: priorAttempt || null,
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

  const currentKeys = new Set(scheduled.map((request) =>
    String(request.requestId) + ":" + String(request.inputSignature)
  ));
  const priorArchive = Array.isArray(previousBus?.archive) ? previousBus.archive : [];
  const archivedKeys = new Set(priorArchive.map((request) =>
    String(request.requestId) + ":" + String(request.inputSignature)
  ));
  const newlyArchived = (previousBus?.requests || [])
    .filter((request) => {
      const key = String(request.requestId) + ":" + String(request.inputSignature);
      return !currentKeys.has(key) && !archivedKeys.has(key);
    })
    .map((request) => ({
      ...request,
      archivedAt: nowIso,
      archiveReason: scheduled.some((current) => current.requestId === request.requestId)
        ? "input_signature_changed"
        : "root_failure_disappeared_or_request_replaced",
    }));
  const archive = [...priorArchive, ...newlyArchived];

  return {
    version: normalizedOptions.lifecycleEnabled ? 2 : 1,
    contract: normalizedOptions.lifecycleEnabled ? "earth2036-assist-bus-v2" : "earth2036-assist-bus-v1",
    generatedAt: nowIso,
    policy: {
      rootOwnerRetainsAuthority: true,
      oneHelperPerRequest: true,
      unchangedFailedInputSleeps: true,
      helperCapacityBounded: true,
      frontierFirst: normalizedOptions.lifecycleEnabled && normalizedOptions.frontierTickers.size > 0,
      lifecycleEnabled: normalizedOptions.lifecycleEnabled,
      canonicalAuthorityUnchanged: true,
      historyAppendOnly: true,
    },
    capacityByHelper,
    total: scheduled.length,
    active: active.length,
    dormant: dormant.length,
    queued: queued.length,
    archived: archive.length,
    byHelper: Object.fromEntries(
      ["earth-scout","council-alpha","council-beta","deep-resolver"].map((role) => [
        role,
        active.filter((request) => request.helperRole === role).length,
      ])
    ),
    requests: scheduled,
    archive,
  };
}
