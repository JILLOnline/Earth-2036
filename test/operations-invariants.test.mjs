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
  assert.ok(sync >= 0, "workgraph sync must exist");
  assert.ok(finalizer >= 0, "finalizer must exist");
  assert.ok(sync < finalizer, "finalizer must run only after fresh Workgraph reconciliation");
});

test("Workgraph supervision never invalidates cumulative evidence by exact hourly cycle key", async () => {
  const text = await source("scripts/mark-council-pending.mjs");
  assert.equal(text.includes("supervisor.cycleKey !== state.cycleKey"), false);
  assert.equal(text.includes("supervisorSameCycle ?"), false);
  assert.ok(text.includes("Workgraph v2 cumulative evidence is authoritative"));
});

test("scheduler preflights typecheck and tests before executing engine cycle", async () => {
  const text = await source("../.github/workflows/earth2036-scheduler.yml");
  const typecheck = text.indexOf("npm run typecheck");
  const tests = text.indexOf("npm test");
  const cycle = text.indexOf("npm run engine:cycle");
  assert.ok(typecheck >= 0 && tests >= 0 && cycle >= 0);
  assert.ok(typecheck < cycle);
  assert.ok(tests < cycle);
});

test("watchdog inspects both scheduler and CI conclusions", async () => {
  const text = await source("../.github/workflows/earth2036-watchdog.yml");
  assert.ok(text.includes("--workflow earth2036-scheduler.yml"));
  assert.ok(text.includes("--workflow earth2036-ci.yml"));
  assert.ok(text.includes("Fail closed on unhealthy execution plane"));
});


test("evidence arrival triggers burst-safe Workgraph reconciliation", async () => {
  const text = await source("../.github/workflows/earth2036-workgraph-reconcile.yml");
  assert.ok(text.includes('earth-2036/data/runtime/workgraph/evidence/**'));
  assert.ok(text.includes("cancel-in-progress: true"));
  assert.ok(text.includes("npm run workgraph:sync"));
  assert.ok(text.includes("scripts/mark-council-pending.mjs"));
  assert.ok(text.includes("Evidence branch advanced during reconciliation"));
});

test("CI watches every Earth 2036 operational workflow", async () => {
  const text = await source("../.github/workflows/earth2036-ci.yml");
  assert.ok(text.includes('".github/workflows/earth2036-*.yml"'));
});


test("zero-defect Chief fast path runs after packet compilation and before Beast audit", async () => {
  const text = await source("scripts/earth2036-cycle.mjs");
  const sync = text.indexOf('scripts/workgraph-sync.mjs');
  const fastPath = text.indexOf('scripts/promote-chief-ready.mjs');
  const beast = text.indexOf('scripts/beast-audit.mjs');
  assert.ok(sync >= 0 && fastPath >= 0 && beast >= 0);
  assert.ok(sync < fastPath);
  assert.ok(fastPath < beast);
});

test("evidence-arrival reconciliation includes Chief fast path and Beast fail-closed audit", async () => {
  const text = await source("../.github/workflows/earth2036-workgraph-reconcile.yml");
  const sync = text.indexOf("npm run workgraph:sync");
  const fastPath = text.indexOf("node scripts/promote-chief-ready.mjs");
  const beast = text.indexOf("node scripts/beast-audit.mjs");
  assert.ok(sync >= 0 && fastPath >= 0 && beast >= 0);
  assert.ok(sync < fastPath);
  assert.ok(fastPath < beast);
  assert.ok(text.includes("earth-2036/data/baseline-evidence"));
  assert.ok(text.includes("earth-2036/data/runtime/causal-graph.json"));
});


test("runtime reports Chief-managed hourly preview publication", async () => {
  const text = await source("scripts/earth2036-engine.mjs");
  assert.equal(text.includes('deploymentSync: "git-commit-triggered"'), false);
  assert.equal(text.includes('deploymentSync: "manual-snapshot"'), false);
  assert.ok(text.includes('deploymentSync: "chief-hourly-publish"'));
});
