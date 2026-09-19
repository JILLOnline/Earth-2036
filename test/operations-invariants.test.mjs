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

test("completed worker receipts trigger one burst-safe Workgraph reconciliation", async () => {
  const text = await source(".github/workflows/earth2036-workgraph-reconcile.yml");
  assert.equal(text.includes('data/runtime/workgraph/evidence/**'), false);
  assert.ok(text.includes('data/runtime/workgraph/role-runs/**'));
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

test("CI watches every Earth 2036 operational workflow and publishes every verified main snapshot", async () => {
  const text = await source(".github/workflows/earth2036-ci.yml");
  assert.ok(text.includes('".github/workflows/earth2036-*.yml"'));
  assert.ok(text.includes("Dispatch Pages after verified main push"));
  assert.ok(text.includes('source_sha="${GITHUB_SHA}"'));
  assert.equal(text.includes("Detect browser-projection code changes"), false);
});

test("zero-defect Chief fast path runs after packet compilation and before Beast audit", async () => {
  const text = await source("scripts/earth2036-cycle.mjs");
  const sync = text.indexOf('scripts/workgraph-sync.mjs');
  const fastPath = text.indexOf('scripts/promote-chief-ready.mjs');
  const beast = text.indexOf('scripts/beast-audit.mjs');
  assert.ok(sync >= 0 && fastPath >= 0 && beast >= 0);
  assert.ok(sync < fastPath && fastPath < beast);
});

test("evidence reconciliation persists routing while Beast remains a hard promotion gate", async () => {
  const text = await source(".github/workflows/earth2036-workgraph-reconcile.yml");
  const sync = text.indexOf("npm run workgraph:sync");
  const beast = text.indexOf("node scripts/beast-audit.mjs");
  const guard = text.indexOf('if [ "$beast_status" -eq 0 ]');
  const fastPath = text.indexOf("node scripts/promote-chief-ready.mjs");
  assert.ok(sync >= 0 && beast >= 0 && guard >= 0 && fastPath >= 0);
  assert.ok(sync < beast && beast < guard && guard < fastPath);
  assert.ok(text.includes("persisting non-canonical Workgraph state and routing only"));
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


test("tick finalization requires Workgraph v2 and has no legacy council fallback", async () => {
  const text = await source("scripts/finalize-qualified-tick.mjs");
  assert.ok(text.includes('reason: "workgraph_v2_required"'));
  assert.equal(text.includes("supervisor-council.json"), false);
  assert.equal(text.includes("validateCouncilAttestationShape"), false);
  assert.equal(text.includes("legacyCouncilPassed"), false);
});


test("Workgraph refreshes shared operational learning signals every reconcile", async () => {
  const text = await source("scripts/workgraph-sync.mjs");
  assert.ok(text.includes("learning-state.json"));
  assert.ok(text.includes("zeroClosureWithBacklog"));
  assert.ok(text.includes("dependentResolverSymptoms"));
  assert.ok(text.includes("repeatedFailureRequiresChangedStrategy"));
  assert.ok(text.includes("hardTruthGatesMayNotBeWeakened"));
});


test("Methodology 1.0 has one machine-readable authority and shadow systems cannot promote", async () => {
  const methodology = JSON.parse(await source("config/methodology-1.0.json"));
  const total = Object.values(methodology.scoreWeights).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.equal(methodology.requiredScoreComponents.length, 12);

  const ts = await source("engine/methodology.ts");
  const gates = await source("scripts/lib/runtime-gates.mjs");
  const promote = await source("scripts/promote-chief-ready.mjs");
  const sync = await source("scripts/workgraph-sync.mjs");
  assert.ok(ts.includes('config/methodology-1.0.json'));
  assert.ok(gates.includes('config/methodology-1.0.json'));
  assert.ok(promote.includes("METHODOLOGY_VERSION"));
  assert.ok(sync.includes('canonicalWriteAuthority: false'));
  assert.equal(promote.includes("assist-bus"), false);
  assert.equal(promote.includes("calibration-engine"), false);
});

test("Earth doctrine protects agency, evidence, improvement and anti-pay-to-rank", async () => {
  const doctrine = JSON.parse(await source("config/earth-doctrine.json"));
  assert.equal(doctrine.status, "constitutional");
  assert.ok(doctrine.principles.includes("Recommend; never coerce."));
  assert.ok(doctrine.principles.some((line) => line.includes("weaknesses without humiliation")));
  assert.ok(doctrine.representationContract.forbiddenBehaviors.includes("pay-to-rank"));
  assert.ok(doctrine.representationContract.forbiddenBehaviors.includes("pay-to-suppress"));
});

test("Assist and calibration outputs are derived inside Workgraph rather than independent canonical writers", async () => {
  const sync = await source("scripts/workgraph-sync.mjs");
  const reconcile = await source(".github/workflows/earth2036-workgraph-reconcile.yml");
  assert.ok(sync.includes("assist-bus.json"));
  assert.ok(sync.includes('shadowDir'));
  assert.ok(sync.includes('"calibration.json"'));
  assert.ok(reconcile.includes("git add data/runtime/workgraph"));
});


test("engine registry keeps a single canonical authority and explicit Shadow/Lab firewalls", async () => {
  const registry = JSON.parse(await source("config/engine-registry.json"));
  assert.equal(registry.canonicalAuthority, "Earth Core");
  assert.equal(registry.systems.core.canWriteCanonical, true);
  assert.equal(registry.systems.shadow.canWriteCanonical, false);
  assert.equal(registry.systems.lab.canWriteCanonical, false);
  assert.ok(registry.engines.filter((engine) => engine.system !== "core").every((engine) => engine.canonicalAuthority === false));
});

test("workforce contract preserves ownership while allowing bounded assistance", async () => {
  const workforce = JSON.parse(await source("config/workforce-contract.json"));
  assert.ok(workforce.principle.includes("Help every other lane"));
  assert.ok(workforce.handoffRules.includes("Every assist request retains a root owner."));
  assert.ok(workforce.handoffRules.includes("No assist request can modify canonical state directly."));
});

test("Workgraph emits all shadow intelligence under non-canonical derived state", async () => {
  const sync = await source("scripts/workgraph-sync.mjs");
  assert.ok(sync.includes('"calibration.json"'));
  assert.ok(sync.includes('"digital-twins.json"'));
  assert.ok(sync.includes('"value-allocation.json"'));
  assert.ok(sync.includes("canonicalWriteAuthority: false"));
});


test("production UI has no legacy external ledger or retired hosting authority", async () => {
  const system = await source("app/system/page.tsx");
  const shell = await source("app/components/EarthShell.tsx");
  const ledger = await source("app/ledger/page.tsx");
  const registry = JSON.parse(await source("data/runtime/supervisors/registry.json"));
  const combined = [system, shell, ledger, JSON.stringify(registry)].join("\n").toLowerCase();

  assert.equal(combined.includes("docs.google.com/spreadsheets"), false);
  assert.equal(combined.includes("netlify"), false);
  assert.equal(combined.includes("vercel"), false);
  assert.equal(JSON.stringify(registry).includes("Sheet mirror"), false);
  assert.ok(shell.includes('["/ledger", "LEDGER"]'));
  assert.ok(system.includes('href="/ledger"'));
});

test("System UI distinguishes integrity lock from workflow attention", async () => {
  const system = await source("app/system/page.tsx");
  assert.ok(system.includes('const integrityPass = integrity.passed && integrity.sourceMesh.passed'));
  assert.ok(system.includes('workgraph.healthy === true ? "PASS" : "ATTENTION"'));
  assert.ok(system.includes('detail="EVIDENCE COVERAGE"'));
});

test("Trust Ledger exposes doctrine and shadow authority without turning operational priority into company rank", async () => {
  const ledger = await source("app/ledger/page.tsx");
  const allocator = await source("scripts/lib/value-allocator.mjs");
  assert.ok(ledger.includes("TRUST LEDGER"));
  assert.ok(ledger.includes("NO CANONICAL WRITES"));
  assert.ok(ledger.includes("VALUE ALLOCATION"));
  assert.ok(allocator.includes("never a company-quality or investment score"));
});


test("scheduler is hourly/manual only so code pushes cannot collide with minion evidence bursts", async () => {
  const text = await source(".github/workflows/earth2036-scheduler.yml");
  assert.ok(text.includes('cron: "0 * * * *"'));
  assert.ok(text.includes("workflow_dispatch:"));
  assert.equal(text.includes('scripts/**'), false);
  assert.equal(/\n\s*push:\s*\n/.test(text), false);
});

test("GitHub workflows use Node-24-compatible checkout/setup actions", async () => {
  for (const path of [
    ".github/workflows/earth2036-scheduler.yml",
    ".github/workflows/earth2036-workgraph-reconcile.yml",
    ".github/workflows/earth2036-ci.yml",
    ".github/workflows/earth2036-pages.yml",
  ]) {
    const text = await source(path);
    if (text.includes("actions/checkout@")) assert.ok(text.includes("actions/checkout@v5"));
    if (text.includes("actions/setup-node@")) assert.ok(text.includes("actions/setup-node@v5"));
  }
});


test("Workgraph exposes effective adaptive backlog separately from raw preflight ownership", async () => {
  const sync = await source("scripts/workgraph-sync.mjs");
  const system = await source("app/system/page.tsx");
  assert.ok(sync.includes("metrics.effectiveOwnerBacklog"));
  assert.ok(sync.includes("metrics.routingQueueCounts"));
  assert.ok(system.includes("effectiveOwnerBacklog ?? workgraph.ownerBacklog"));
});

test("canonical causal promotion refreshes graph-level freshness metadata", async () => {
  const promote = await source("scripts/promote-chief-ready.mjs");
  const refresh = promote.indexOf("prospectiveGraph.updatedAt = new Date().toISOString()");
  const write = promote.indexOf('writeJson(path.join(RUNTIME, "causal-graph.json"), prospectiveGraph)');
  assert.ok(refresh >= 0 && write >= 0 && refresh < write);
});
