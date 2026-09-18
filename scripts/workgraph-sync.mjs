import { readFile } from "node:fs/promises";
import path from "node:path";
import { applyPacketState, compilePromotionPacket, computeWorkgraphMetrics, loadRoleRuns, loadStructuredEvidence, migrateLegacyQueue, validateWorkgraph, writeWorkgraphArtifacts } from "./lib/workgraph-v2.mjs";

const ROOT = process.cwd();
const LEGACY_PATH = path.join(ROOT, "data", "runtime", "supervisors", "t0-bootstrap-queue.json");
const REGISTRY_PATH = path.join(ROOT, "data", "runtime", "entity-registry.json");
const SCORE_STATE_PATH = path.join(ROOT, "data", "runtime", "score-state.json");
const STATE_PATH = path.join(ROOT, "data", "runtime", "workgraph", "state.json");

async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }

const registry = await readJson(REGISTRY_PATH);
const scoreState = await readJson(SCORE_STATE_PATH);
const methodologyVersion = scoreState?.methodologyVersion || null;
const registryByTicker = Object.fromEntries((registry?.candidates || []).filter((row) => row?.ticker).map((row) => [row.ticker, row]));

let graph;
try {
  graph = await readJson(STATE_PATH);
} catch {
  graph = migrateLegacyQueue(await readJson(LEGACY_PATH), registry);
}

const expected = Number(registry?.expected || registry?.candidates?.length || 250);
const errors = validateWorkgraph(graph, expected);
if (errors.length) {
  console.error("Workgraph invariant failure:", errors);
  process.exit(1);
}

const [evidence, roleRuns] = await Promise.all([loadStructuredEvidence(ROOT), loadRoleRuns(ROOT)]);
const packets = [];
for (const [ticker, row] of Object.entries(graph.companies)) {
  if (["canonical", "blocked"].includes(row.state)) continue;
  const packet = compilePromotionPacket(ticker, evidence, row, {
    minConfidence: 60,
    methodologyVersion,
    registryEntry: registryByTicker[ticker] || null,
  });
  packets.push(packet);
  applyPacketState(graph, packet);
}

const postErrors = validateWorkgraph(graph, expected);
if (postErrors.length) {
  console.error("Workgraph post-compile invariant failure:", postErrors);
  process.exit(1);
}

const metrics = computeWorkgraphMetrics(graph, new Date(), evidence, roleRuns);
await writeWorkgraphArtifacts(ROOT, graph, packets, metrics);
console.log(`Workgraph v2: ${metrics.total} companies; ${metrics.counts.chief_ready} chief_ready; ${metrics.counts.packet_ready} packet_ready; ${metrics.counts.blocked} blocked.`);
