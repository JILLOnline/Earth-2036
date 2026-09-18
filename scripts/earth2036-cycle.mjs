import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
// Operational ordering is a safety invariant covered by test/operations-invariants.test.mjs.
import { spawn } from "node:child_process";
import { loadBaselineEvidence, mergeScoreState } from "./lib/baseline-evidence-loader.mjs";

const ROOT = process.cwd();
const SCORE_STATE_PATH = path.join(ROOT, "data", "runtime", "score-state.json");

async function readScoreState() {
  try { return JSON.parse(await readFile(SCORE_STATE_PATH, "utf8")); }
  catch { return { version: 1, methodologyVersion: "1.0.0", updatedAt: null, candidates: {} }; }
}

async function ingestBaselineEvidence() {
  const evidence = await loadBaselineEvidence(ROOT);
  if (!evidence.candidateCount) return evidence;
  const current = await readScoreState();
  const merged = mergeScoreState(current, evidence);
  await writeFile(SCORE_STATE_PATH, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return evidence;
}

async function runScript(relativePath, label) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, relativePath)], { cwd: ROOT, env: process.env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${label} exited with code ${code}`)));
  });
}

const evidence = await ingestBaselineEvidence();
if (evidence.errors.length) {
  console.error("Baseline evidence loader errors:", evidence.errors);
  process.exitCode = 1;
} else {
  console.log(`Baseline evidence: ${evidence.candidateCount} candidate records from ${evidence.filesScanned} JSON files.`);
  await runScript("scripts/official-source-scan.mjs", "Earth 2036 official-source scan");
  await runScript("scripts/earth2036-engine.mjs", "Earth 2036 engine");
  await runScript("scripts/sanitize-listing-runtime.mjs", "Earth 2036 listing-runtime sanitizer");
  await runScript("scripts/workgraph-sync.mjs", "Earth 2036 workgraph v2 sync/preflight");
  await runScript("scripts/promote-chief-ready.mjs", "Earth 2036 zero-defect Chief fast path");
  await runScript("scripts/mark-council-pending.mjs", "Earth 2036 Workgraph supervision sync");
  await runScript("scripts/beast-audit.mjs", "Earth 2036 Beast integrity audit");
  await runScript("scripts/finalize-qualified-tick.mjs", "Earth 2036 deterministic finalizer");
}
