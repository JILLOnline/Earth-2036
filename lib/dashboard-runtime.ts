import baselineJson from "../data/baselines/earth2036-official-t0-2026-09-12/manifest.json";
import runtimeJson from "../data/runtime/system-state.json";
import supervisorJson from "../data/runtime/supervisor-state.json";
import queueJson from "../data/runtime/evidence-review-queue.json";
import discoveryJson from "../data/runtime/discovery-pool.json";
import graphJson from "../data/runtime/causal-graph.json";
import rankingJson from "../data/runtime/current-ranking.json";
import scoresJson from "../data/runtime/score-state.json";

export const dashboardRuntime = {
  baseline: baselineJson,
  runtime: runtimeJson,
  supervisor: supervisorJson,
  queue: queueJson,
  discovery: discoveryJson,
  graph: graphJson,
  ranking: rankingJson,
  scores: scoresJson,
};

export const percent = (value: number) => `${Math.round((Number(value) || 0) * 100)}%`;

export function runtimeTime(value: string | null | undefined) {
  if (!value) return "WAITING";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(value));
}
