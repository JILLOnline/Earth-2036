import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifyBridgeIndex } from "./lib/fundamentals-bridge-index.mjs";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback;
};
const has = (flag) => args.includes(flag);

const cacheDir = path.resolve(ROOT, arg("--cache-dir", "data/lab/bridge"));
const asOf = arg("--as-of");
const publishRuntime = has("--publish-runtime");
const archiveTag = arg("--archive-tag");
const archiveSha256 = arg("--archive-sha256");
const archiveAsset = arg("--archive-asset", "fundamentals-source-cache.tar.gz");

if (!asOf || !Number.isFinite(Date.parse(asOf))) throw new Error("valid --as-of required");
if (publishRuntime && (!archiveTag || !/^[a-f0-9]{64}$/i.test(archiveSha256 || ""))) {
  throw new Error("--publish-runtime requires archive tag and SHA-256");
}

async function json(file) {
  return JSON.parse(await readFile(file, "utf8"));
}
async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

const indexFile = path.join(cacheDir, "current-index.json");
const healthFile = path.join(ROOT, "data/runtime/workgraph/shadow/fundamentals-bridge-health.json");
const registryFile = path.join(ROOT, "data/runtime/entity-registry.json");
const observationsFile = path.join(ROOT, "data/runtime/company-observations.json");

const [index, health, registry, observations] = await Promise.all([
  json(indexFile), json(healthFile), json(registryFile), json(observationsFile),
]);

const universe = (registry.candidates || []).filter((row) => row?.ticker && row?.cik).slice(0, 250);
const tickers = universe.map((row) => row.ticker);
if (tickers.length !== 250 || new Set(tickers).size !== 250) {
  throw new Error(`bootstrap universe must contain exactly 250 unique trusted-CIK issuers; got ${tickers.length}`);
}
if (index.asOf !== asOf || index.mode !== "live-shadow" || index.system !== "shadow" ||
    index.canonicalWriteAuthority !== false || index.trialEligible !== false) {
  throw new Error("bridge index governance/asOf mismatch");
}
if (Object.keys(index.entries || {}).length !== 250) {
  throw new Error(`bridge index population mismatch: ${Object.keys(index.entries || {}).length}/250`);
}

const verified = verifyBridgeIndex(index, {
  asOf,
  observations: observations.candidates || {},
  tickers,
});
if (Object.keys(verified).length !== 250) {
  throw new Error(`verified bridge population mismatch: ${Object.keys(verified).length}/250`);
}

const statuses = { valid: 0, unknown: 0, invalid: 0 };
for (const ticker of tickers) {
  const status = verified[ticker]?.reference?.status;
  if (!(status in statuses)) throw new Error("missing verified status for " + ticker);
  statuses[status]++;
}
if (statuses.invalid !== 0) throw new Error(`invalid live bridge references: ${statuses.invalid}`);

const hardCounters = {
  futureLeakage: Number(health.futureLeakage || 0),
  cikMismatches: Number(health.cikMismatches || 0),
  hashFailures: Number(health.hashFailures || 0),
  projectionAuthority: Number(health.projectionAuthority || 0),
  canonicalWrites: Number(health.canonicalWrites || 0),
};
for (const [name, value] of Object.entries(hardCounters)) {
  if (value !== 0) throw new Error(`bridge bootstrap hard counter ${name}=${value}`);
}
if (Number(health.companies) !== 250 ||
    Number(health.valid) !== statuses.valid ||
    Number(health.unknown) !== statuses.unknown ||
    Number(health.invalid) !== statuses.invalid) {
  throw new Error("bridge health denominator/status counts do not match verified index");
}

const runtimeIndexFile = path.join(ROOT, "data/runtime/workgraph/shadow/fundamentals-bridge-index.json");
const report = {
  contract: "earth2036-fundamentals-live-bootstrap-attestation-v1",
  system: "shadow",
  asOf,
  indexHash: index.indexHash,
  companies: 250,
  ...statuses,
  ...hardCounters,
  canonicalWriteAuthority: false,
  trialEligible: false,
  publishRuntime,
};

if (publishRuntime) {
  const publishedHealth = {
    ...health,
    status: "live-universe-bootstrap-verified",
    source: "github-release-verified-bridge-index",
    canonicalWriteAuthority: false,
    asOf,
    sourceArchive: {
      provider: "github-release",
      repository: "JILLOnline/Earth-2036",
      tag: archiveTag,
      asset: archiveAsset,
      sha256: archiveSha256.toLowerCase(),
      immutableByPolicy: true,
      reconstructionPolicy: "hydrate exact release asset, verify SHA-256, then verify source payload hash from descriptor/cache manifest",
    },
    bootstrapAttestation: {
      indexHash: index.indexHash,
      companies: 250,
      valid: statuses.valid,
      unknown: statuses.unknown,
      invalid: statuses.invalid,
      verifiedAt: new Date().toISOString(),
    },
  };
  await writeJson(runtimeIndexFile, index);
  await writeJson(healthFile, publishedHealth);
  report.runtimeIndex = path.relative(ROOT, runtimeIndexFile);
  report.healthStatus = publishedHealth.status;
}

console.log(JSON.stringify(report, null, 2));
