function adjacencyFromRequests(requests) {
  const adj = new Map();
  for (const request of requests || []) {
    if (request?.status !== "active") continue;
    const from = request.rootOwner;
    const to = request.helperRole;
    if (!from || !to || from === to) continue;
    if (!adj.has(from)) adj.set(from, new Set());
    adj.get(from).add(to);
    if (!adj.has(to)) adj.set(to, new Set());
  }
  return adj;
}

export function detectRoleCycles(requests) {
  const adj = adjacencyFromRequests(requests);
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];

  function dfs(node) {
    if (visiting.has(node)) {
      const index = stack.indexOf(node);
      if (index >= 0) cycles.push([...stack.slice(index), node]);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of adj.get(node) || []) dfs(next);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of adj.keys()) dfs(node);
  return cycles;
}

export function buildDependencyShadow(assistBus, generatedAt = new Date().toISOString()) {
  const requests = assistBus?.requests || [];
  const active = requests.filter((request) => request.status === "active");
  const dormant = requests.filter((request) => request.status === "dormant_until_input_changes");
  const cycles = detectRoleCycles(active);
  return {
    version: 1,
    contract: "earth2036-dependency-shadow-v1",
    generatedAt,
    canonicalWriteAuthority: false,
    activeEdges: active.map((request) => ({
      requestId: request.requestId,
      ticker: request.ticker,
      from: request.rootOwner,
      to: request.helperRole,
      capability: request.capability,
      inputSignature: request.inputSignature,
    })),
    roleCycles: cycles,
    deadlocks: dormant.map((request) => ({
      requestId: request.requestId,
      ticker: request.ticker,
      rootOwner: request.rootOwner,
      helperRole: request.helperRole,
      reason: "unchanged_failed_assist_input",
      unlockCondition: "packet/evidence input signature changes or Chief explicitly adjudicates the dependency",
    })),
    healthy: cycles.length === 0,
    policy: {
      circularAssistanceForbidden: true,
      unchangedFailedAssistSleeps: true,
      rootOwnerRetainsAuthority: true,
    },
  };
}
