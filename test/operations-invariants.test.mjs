import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("machine cycle reconciles Workgraph before finalization", async () => {
  const text = await source("scripts/earth2036-cycle.mjs");
  const sync = text.indexOf('scripts/workgraph-sync.mjs');
  const finalizer = text.indexOf('scripts/finalize-qualified-tick.mjs');
  assert.ok(sync >= 0 && finalizer >= 0 && sync < finalizer);
});

test("Workgraph supervision never invalidates cumulative evidence by exact hourly cycle key", async () => {
  const text = await source("scripts/mark-council-pending.mjs");
  assert.equal(text.includes("supervisor.cycleKey !== state.cycleKey"), false);
  assert.ok(text.includes("Workgraph v2 cumulative evidence is authoritative"));
});

test("hourly scheduler runs targeted invariants and does not duplicate full CI", async () => {
  const text = await source(".github/workflows/earth2036-scheduler.yml");
  assert.ok(text.includes("test/workgraph-v2.test.mjs"));
  assert.ok(text.includes("test/operations-invariants.test.mjs"));
  assert.ok(text.includes("npm run engine:cycle"));
  assert.equal(text.includes("gh workflow run earth2036-ci.yml"), false);
  assert.ok(text.includes("git merge-base --is-ancestor"));
});

test("watchdog checks GitHub-native scheduler, Pages, reconcile, CI and Workgraph health", async () => {
  const text = await source(".github/workflows/earth2036-watchdog.yml");
  assert.ok(text.includes("earth2036-scheduler.yml"));
  assert.ok(text.includes("earth2036-pages.yml"));
  assert.ok(text.includes("earth2036-workgraph-reconcile.yml"));
  assert.ok(text.includes("earth2036-ci.yml"));
  assert.ok(text.includes("workgraph_healthy"));
});

test("evidence arrival triggers burst-safe Workgraph reconciliation", async () => {
  const text = await source(".github/workflows/earth2036-workgraph-reconcile.yml");
  assert.ok(text.includes('data/runtime/workgraph/evidence/**'));
  assert.ok(text.includes("cancel-in-progress: true"));
  assert.ok(text.includes("npm run workgraph:sync"));
  assert.ok(text.includes("scripts/mark-council-pending.mjs"));
  assert.ok(text.includes("Evidence branch advanced during reconciliation"));
});

test("canonical reconciliation changes dispatch Pages immediately", async () => {
  const text = await source(".github/workflows/earth2036-workgraph-reconcile.yml");
  assert.ok(text.includes("canonical_projection_changed"));
  assert.ok(text.includes("gh workflow run earth2036-pages.yml"));
  assert.ok(text.includes("data/runtime/current-ranking.json"));
  assert.ok(text.includes("data/runtime/score-state.json"));
});

test("CI watches every Earth 2036 operational workflow and publishes only after success", async () => {
  const text = await source(".github/workflows/earth2036-ci.yml");
  assert.ok(text.includes('".github/workflows/earth2036-*.yml"'));
  assert.ok(text.includes("Dispatch Pages after verified main code push"));
});

test("zero-defect Chief fast path runs after packet compilation and before Beast audit", async () => {
  const text = await source("scripts/earth2036-cycle.mjs");
  const sync = text.indexOf('scripts/workgraph-sync.mjs');
  const fastPath = text.indexOf('scripts/promote-chief-ready.mjs');
  const beast = text.indexOf('scripts/beast-audit.mjs');
  assert.ok(sync >= 0 && fastPath >= 0 && beast >= 0);
  assert.ok(sync < fastPath && fastPath < beast);
});

test("evidence reconciliation includes Chief fast path and Beast fail-closed audit", async () => {
  const text = await source(".github/workflows/earth2036-workgraph-reconcile.yml");
  const sync = text.indexOf("npm run workgraph:sync");
  const fastPath = text.indexOf("node scripts/promote-chief-ready.mjs");
  const beast = text.indexOf("node scripts/beast-audit.mjs");
  assert.ok(sync >= 0 && fastPath >= 0 && beast >= 0);
  assert.ok(sync < fastPath && fastPath < beast);
});

test("runtime declares the dedicated GitHub-native control plane", async () => {
  const text = await source("scripts/earth2036-engine.mjs");
  assert.ok(text.includes('canonicalRepository: "JILLOnline/Earth-2036"'));
  assert.ok(text.includes('canonicalBranch: "main"'));
  assert.ok(text.includes('controlPlane: "github-native-v2"'));
  assert.ok(text.includes('browserProjection: "github-pages"'));
  assert.equal(text.includes("spreadsheetMirror:"), false);
  assert.equal(text.includes("deploymentSync:"), false);
});
