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

test("watchdog checks execution-plane health while separating critical Workgraph failure from productivity attention", async () => {
  const text = await source(".github/workflows/earth2036-watchdog.yml");
  assert.ok(text.includes("earth2036-scheduler.yml"));
  assert.ok(text.includes("earth2036-pages.yml"));
  assert.ok(text.includes("earth2036-workgraph-reconcile.yml"));
  assert.ok(text.includes("earth2036-ci.yml"));
  assert.ok(text.includes("workgraph_healthy"));
  assert.ok(text.includes("workgraph_critical"));
  assert.ok(text.includes("workgraph_attention_count"));
  assert.ok(text.includes("owner_stale_with_backlog:"));
  assert.ok(text.includes("t0_frontier_stalled_over_2h_without_chief_ready:"));
  assert.equal(text.includes('if [ "$WORKGRAPH_HEALTHY" != "true" ]; then unhealthy=true; fi'), false);
});

test("completed worker receipts and direct evidence writes trigger one burst-safe Workgraph reconciliation", async () => {
  const text = await source(".github/workflows/earth2036-workgraph-reconcile.yml");
  assert.equal(text.includes('data/runtime/workgraph/evidence/**'), true);
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

test("runtime control plane skips malformed evidence fail-closed while CI retains the hard JSON invariant", async () => {
  const scheduler = await source(".github/workflows/earth2036-scheduler.yml");
  const reconcile = await source(".github/workflows/earth2036-workgraph-reconcile.yml");
  const ci = await source(".github/workflows/earth2036-ci.yml");
  assert.equal(scheduler.includes("evidence-json-integrity.test.mjs"), false);
  assert.equal(reconcile.includes("evidence-json-integrity.test.mjs"), false);
  assert.ok(ci.includes("npm test"));
  const loader = await source("scripts/lib/workgraph-v2.mjs");
  assert.ok(loader.includes("Workgraph evidence quarantined"));
  assert.ok(loader.includes("holdPacketForEvidenceQuarantine"));
  assert.ok(loader.includes("worker_evidence_parse_or_normalization_failure"));
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

test("machine cycle refreshes Workgraph and Shadow projections after canonical promotion", async () => {
  const text = await source("scripts/earth2036-cycle.mjs");
  const firstSync = text.indexOf('scripts/workgraph-sync.mjs');
  const fastPath = text.indexOf('scripts/promote-chief-ready.mjs');
  const secondSync = text.indexOf('scripts/workgraph-sync.mjs', firstSync + 1);
  const supervision = text.indexOf('scripts/mark-council-pending.mjs');
  const beast = text.indexOf('scripts/beast-audit.mjs');
  assert.ok(firstSync >= 0 && fastPath >= 0 && secondSync >= 0 && supervision >= 0 && beast >= 0);
  assert.ok(firstSync < fastPath && fastPath < secondSync && secondSync < supervision && supervision < beast);
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

test("canonical score math is deterministic, independently audited and causal proof does not borrow score authority", async () => {
  const gates = await source("scripts/lib/runtime-gates.mjs");
  const loader = await source("scripts/lib/baseline-evidence-loader.mjs");
  const promote = await source("scripts/promote-chief-ready.mjs");
  const beast = await source("engine/beast-integrity.mjs");

  assert.ok(gates.includes("calculateCanonicalEarthScoreBreakdown"));
  assert.ok(gates.includes("SCORE_FORMULA_HASH"));
  assert.ok(loader.includes("normalizeCanonicalScoreRecord"));
  assert.ok(promote.includes("calculateCanonicalEarthScoreBreakdown"));
  assert.ok(promote.includes("sourceAuthoredEarthScore"));
  assert.equal(promote.includes("scoreRecord?.components?.bottleneckControl"), false);
  assert.ok(beast.includes("score_math_mismatch"));
  assert.ok(beast.includes("score_formula_hash_mismatch"));
  assert.ok(beast.includes("mathematicalIntegrity"));
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


test("scheduler remains burst-safe while core engine membership changes refresh immediately", async () => {
  const text = await source(".github/workflows/earth2036-scheduler.yml");
  assert.ok(text.split(String.fromCharCode(10)).some(line => line.trim() === '- cron: "7,27,47 * * * *"'));
  assert.equal(text.includes(String.fromCharCode(92) + "n    # Each invocation"), false);
  assert.ok(text.includes('scripts/check-hourly-observation.mjs'));
  assert.ok(text.includes("skipped_hour=true"));
  assert.ok(text.includes("if: steps.persist.outputs.skipped_hour != 'true'"));
  assert.ok(text.includes("workflow_dispatch:"));
  assert.ok(/\n\s*push:\s*\n/.test(text));
  assert.ok(text.includes("    branches: [main]"));
  assert.equal(text.includes('scripts/**'), false);
  assert.equal(text.includes('"data/'), false);
  assert.equal(text.includes('workgraph/evidence'), false);
});

test("watchdog checks twice per hour and recovers an idle stale machine before a second missed cycle", async () => {
  const text = await source(".github/workflows/earth2036-watchdog.yml");
  assert.ok(text.includes('cron: "22,42 * * * *"'));
  assert.ok(text.includes("age>3900"));
  assert.ok(text.includes('status == "in_progress" or .status == "queued"'));
  assert.ok(text.includes("gh workflow run earth2036-scheduler.yml"));
});


test("GitHub workflows use Node-24-compatible checkout/setup actions", async () => {
  for (const path of [
    ".github/workflows/earth2036-scheduler.yml",
    ".github/workflows/earth2036-workgraph-reconcile.yml",
    ".github/workflows/earth2036-ci.yml",
    ".github/workflows/earth2036-pages.yml",
    ".github/workflows/fundamentals-trajectory-bridge-live.yml",
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

test("Fundamentals live bridge is bulk-first, fingerprint-incremental and has a full-universe drift canary", async () => {
  const live = await source(".github/workflows/fundamentals-trajectory-bridge-live.yml");
  assert.ok(live.includes('companyfacts.zip'));
  assert.ok(live.includes('--bulk-zip /tmp/companyfacts.zip'));
  assert.ok(live.includes('source_mode=incremental-fingerprint'));
  assert.ok(live.includes('weekly-full-drift'));
  assert.ok(live.includes('cron: "17 7 * * 0"'));
  assert.ok(live.includes('health.companies !== 250'));
  assert.ok(live.includes('health.invalid !== 0'));
});

test("canonical causal promotion refreshes graph-level freshness metadata", async () => {
  const promote = await source("scripts/promote-chief-ready.mjs");
  const refresh = promote.indexOf("prospectiveGraph.updatedAt = new Date().toISOString()");
  const write = promote.indexOf('writeJson(path.join(RUNTIME, "causal-graph.json"), prospectiveGraph)');
  assert.ok(refresh >= 0 && write >= 0 && refresh < write);
});

test("Chief canonicalization carries packet primary provenance into Beast sovereignty", async () => {
  const promote = await source("scripts/promote-chief-ready.mjs");
  assert.ok(promote.includes("function primaryPacketSourceUrls(packet)"));
  assert.ok(promote.includes("...primaryPacketSourceUrls(packet)"));
  assert.ok(promote.includes("Array.isArray(score.primarySourceUrls)"));
});

test("effective Workgraph health follows executable routing rather than deferred raw ownership", async () => {
  const sync = await source("scripts/workgraph-sync.mjs");
  assert.ok(sync.includes("Raw packet ownership is audit lineage, not necessarily executable worker work."));
  assert.ok(sync.includes("metrics.effectiveOwnerBacklog?.[match[1]]"));
  assert.ok(sync.includes("metrics.healthy = metrics.healthAlerts.length === 0"));
});

test("watchdog treats stale successful Pages as bounded auto-healable freshness", async () => {
  const watchdog = await source(".github/workflows/earth2036-watchdog.yml");
  const pages = await source(".github/workflows/earth2036-pages.yml");
  assert.ok(watchdog.includes("Stale-but-previously-successful Pages is recoverable when no old active"));
  assert.equal(watchdog.includes('pages_stale=true\n              unhealthy=true'), false);
  assert.ok(watchdog.includes('active_pages_created=$(gh run list --repo "\${{ github.repository }}" --workflow earth2036-pages.yml'));
  assert.ok(watchdog.includes('if [ $((now_epoch - active_pages_epoch)) -gt 1200 ]; then'));
  assert.ok(watchdog.includes('if [ "$pages_conclusion" != "success" ]; then unhealthy=true; fi'));
  assert.ok(pages.includes("  deploy:\n    needs: build\n    timeout-minutes: 10"));
});

test("active ranking excludes historical score-state records outside the current 250-member universe", async () => {
  const engine = await source("scripts/earth2036-engine.mjs");
  assert.ok(engine.includes(".filter(([ticker]) => universeTickers.has(normalizeTicker(ticker)))"));
  assert.ok(engine.includes("Score-state is append-only historical memory."));
});

test("Workgraph sync reconciles active registry membership before preflight and logs transitions", async () => {
  const sync = await source("scripts/workgraph-sync.mjs");
  assert.ok(sync.includes("reconcileWorkgraphMembership(graph, registry, now)"));
  assert.ok(sync.includes('contract: "earth2036-membership-event-v1"'));
  assert.ok(sync.includes("validateWorkgraph(graph, expected, expectedTickers)"));
});

test("active-universe engine changes trigger an immediate machine cycle on main", async () => {
  const scheduler = await source(".github/workflows/earth2036-scheduler.yml");
  assert.ok(scheduler.includes("  push:\n    branches: [main]\n    paths:"));
  assert.ok(scheduler.includes('      - "lib/universe-expansion.ts"'));
  assert.ok(scheduler.includes('      - "scripts/earth2036-engine.mjs"'));
});
