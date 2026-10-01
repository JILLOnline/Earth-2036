import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const WG = path.join(ROOT, "data/runtime/workgraph");
const readJson = async (p) => JSON.parse(await readFile(path.join(ROOT, p), "utf8"));

const graph = await readJson("data/runtime/workgraph/state.json");
const metrics = await readJson("data/runtime/workgraph/metrics.json");
const packetsDir = path.join(WG, "packets");
const packetFiles = (await readdir(packetsDir)).filter((x) => x.endsWith(".json"));
const packets = [];
for (const name of packetFiles) packets.push(JSON.parse(await readFile(path.join(packetsDir, name), "utf8")));

const faults = [];
const warnings = [];
const alphaTerms = /(underwriting|valuation|governance|capital allocation|score|component calibration|pricing power|supply.chain|factor evidence|confidence evidence|risk evidence)/i;

for (const p of packets) {
  const failures = p?.preflight?.failures || [];
  const routes = p?.preflight?.routing || [];
  const scoreEvidence = p?.scoreReadiness?.sourceAddressedEvidence || {};
  if (failures.includes("missing_data_confidence_evidence") && scoreEvidence.dataConfidenceEvidenceComplete === true) {
    faults.push({ticker:p.ticker, invariant:"confidence_gate_consumption_mismatch", detail:"packet says source-addressed data-confidence evidence complete while preflight says missing"});
  }
  if (failures.includes("missing_factor_evidence") && scoreEvidence.factorEvidenceComplete === true) {
    faults.push({ticker:p.ticker, invariant:"factor_gate_consumption_mismatch"});
  }
  if (failures.includes("missing_score_risk_evidence") && scoreEvidence.riskEvidenceComplete === true) {
    faults.push({ticker:p.ticker, invariant:"risk_gate_consumption_mismatch"});
  }
  const resolverOnly = routes.length > 0 && routes.every((r) => r.owner === "deep-resolver");
  const semanticAlpha = [...(p.gatingIssues || []), ...(p.unknowns || []).filter((u)=>u?.gating===true).map((u)=>typeof u === "string" ? u : JSON.stringify(u))].some((x)=>alphaTerms.test(String(x)));
  const material = (p.contradictions || []).some((c)=>c && c.resolved !== true && c.gating !== false && c.material !== false && !String(c.disposition||c.resolutionStatus||"").toLowerCase().startsWith("resolved"));
  if (resolverOnly && semanticAlpha && !material) {
    faults.push({ticker:p.ticker, invariant:"resolver_semantic_misroute", detail:"generic unresolved gate is Resolver-owned but underlying work is Alpha underwriting and no material contradiction is independently actionable"});
  }
  if (p?.sourceState === "chief_ready" && p?.preflight?.passed !== true) {
    faults.push({ticker:p.ticker, invariant:"chief_ready_preflight_false"});
  }
}

const rows = Object.values(graph?.companies || {});
const counts = Object.fromEntries(["observed","triaged","researching","evidence_complete","packet_ready","chief_ready","canonical","blocked"].map(s=>[s,rows.filter(r=>r.state===s).length]));
if (counts.canonical !== Number(metrics?.counts?.canonical || 0)) faults.push({invariant:"canonical_metric_mismatch", graph:counts.canonical, metrics:metrics?.counts?.canonical});
if ((counts.packet_ready + counts.chief_ready) > 0 && Number(metrics?.canonicalProgressAgeHours) > 2) warnings.push({invariant:"closure_velocity_stall", hours:metrics.canonicalProgressAgeHours, packet_ready:counts.packet_ready, chief_ready:counts.chief_ready});

const report = {
  contract:"earth2036-closure-invariant-audit-v1",
  generatedAt:new Date().toISOString(),
  passed:faults.length===0,
  counts,
  packetCount:packets.length,
  faults,
  warnings,
  policy:"Any packet-truth/gate-truth contradiction or semantic owner misroute is a machine fault, not a research request. No methodology or Beast gate is weakened by this audit."
};
console.log(JSON.stringify(report,null,2));
if (faults.length) process.exitCode=2;
