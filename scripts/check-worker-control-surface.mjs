import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const W = path.join(ROOT, "data", "runtime", "workgraph");
const MAX_INDEX_BYTES = 512 * 1024;
const MAX_WORKER_VIEW_BYTES = 512 * 1024;

async function readJson(relative) {
  const file = path.join(ROOT, relative);
  const text = await readFile(file, "utf8");
  return { file, text, value: JSON.parse(text) };
}

async function assertFile(relative, maxBytes = MAX_WORKER_VIEW_BYTES) {
  const { file, value } = await readJson(relative);
  const info = await stat(file);
  if (info.size > maxBytes) throw new Error(`${relative} exceeds worker-readable cap: ${info.size} > ${maxBytes}`);
  return { relative, size: info.size, value };
}

const calibration = await assertFile("data/runtime/workgraph/shadow/calibration.json", MAX_INDEX_BYTES);
if (calibration.value.storageMode !== "sharded-v1") throw new Error("calibration shadow is not sharded");
if (Object.prototype.hasOwnProperty.call(calibration.value, "canonicalAudits")) throw new Error("calibration monolith still embeds canonicalAudits");
if ((calibration.value.canonicalAuditIndex || []).length !== Number(calibration.value.canonicalRecordsAudited || 0)) {
  throw new Error("calibration audit index count mismatch");
}
for (const row of calibration.value.canonicalAuditIndex || []) {
  if (!row?.shardPath) throw new Error("calibration audit index missing shardPath");
  await access(path.join(ROOT, row.shardPath));
}

const twins = await assertFile("data/runtime/workgraph/shadow/digital-twins.json", MAX_INDEX_BYTES);
if (twins.value.contract !== "earth2036-digital-twin-shadow-index-v2") throw new Error("digital twin index contract mismatch");
if (Object.prototype.hasOwnProperty.call(twins.value, "twins")) throw new Error("digital twin index still embeds full twins");
if ((twins.value.entries || []).length !== Number(twins.value.total || 0)) throw new Error("digital twin index count mismatch");
for (const row of twins.value.entries || []) {
  if (!row?.shardPath) throw new Error("digital twin index missing shardPath");
  await access(path.join(ROOT, row.shardPath));
}

const requiredViews = [
  "data/runtime/workgraph/worker-view/assist/summary.json",
  "data/runtime/workgraph/worker-view/assist/earth-scout.json",
  "data/runtime/workgraph/worker-view/assist/council-alpha.json",
  "data/runtime/workgraph/worker-view/assist/council-beta.json",
  "data/runtime/workgraph/worker-view/assist/deep-resolver.json",
  "data/runtime/workgraph/worker-view/calibration-summary.json",
  "data/runtime/workgraph/worker-view/digital-twins-index.json",
  "data/runtime/workgraph/worker-view/council-beta-digital-twins.json",
  "data/runtime/workgraph/worker-view/command-summary.json",
];
const report = [];
for (const relative of requiredViews) {
  const checked = await assertFile(relative);
  report.push({ file: relative, size: checked.size });
}

console.log(JSON.stringify({
  contract: "earth2036-worker-control-surface-check-v1",
  passed: true,
  calibrationIndexBytes: calibration.size,
  digitalTwinIndexBytes: twins.size,
  workerViews: report,
}, null, 2));
