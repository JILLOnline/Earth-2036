import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { truthHash, buildFundamentalsTruth, validateFundamentalsTruth } from "./lib/sec-fundamentals-truth.mjs";
import { bridgeFundamentalsTruth, fundamentalsAuditProjection, fundamentalsBridgeHealth, reconstructFundamentalsBridge } from "./lib/fundamentals-trajectory-bridge.mjs";
import { createBridgeIndex } from "./lib/fundamentals-bridge-index.mjs";
import { writeImmutableFundamentalsSnapshot } from "./lib/fundamentals-storage.mjs";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback;
};
const has = (flag) => args.includes(flag);
const secAgent = process.env.SEC_USER_AGENT || "JILLOnline Earth2036 info@jillonlinestore.com";
const asOf = arg("--as-of", new Date().toISOString());
const dates = arg("--walk-forward", "").split(",").filter(Boolean);
const dateCutoffs = dates.length ? dates : [asOf];
const cacheDir = path.resolve(ROOT, arg("--cache-dir", "data/lab/bridge"));
const noWrite = has("--no-write");
const historical = has("--historical") || dates.length > 0;
const noNetwork = has("--no-network");
const forceRefresh = has("--force-refresh");
const strict = has("--strict");
const bulkZip = arg("--bulk-zip");
const external = arg("--external", "").split(",").filter(Boolean).map((pair) => {
  const match = pair.match(/^([A-Z0-9.-]+):([0-9]{1,10})$/);
  if (!match) throw new Error("External canary must use TICKER:CIK");
  return { ticker: match[1], cik: match[2].padStart(10, "0") };
});
if (external.length && !noWrite && !historical) {
  throw new Error("External issuers are canary-only: use --no-write or --historical");
}
const limit = Number(arg("--limit", "5"));
const filter = new Set(arg("--tickers", "").split(",").map((v) => v.trim().toUpperCase()).filter(Boolean));
if (!Number.isSafeInteger(limit) || limit < 1 || limit > 250) throw new Error("limit must be 1..250");
if (dateCutoffs.some((d) => !Number.isFinite(Date.parse(d)))) throw new Error("Invalid PIT cutoff");

async function readJson(file, fallback = null) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
}
async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fetchCompanyFacts(cik) {
  if (bulkZip) {
    const raw = execFileSync("unzip", ["-p", bulkZip, "CIK" + cik + ".json"], {
      encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    });
    return JSON.parse(raw);
  }
  if (noNetwork) throw new Error("company_facts_cache_unavailable");
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 20000);
    try {
      const response = await fetch("https://data.sec.gov/api/xbrl/companyfacts/CIK" + cik + ".json", {
        signal: abort.signal, headers: { "User-Agent": secAgent, Accept: "application/json" },
      });
      if (!response.ok) throw new Error("SEC HTTP " + response.status);
      return await response.json();
    } catch (cause) {
      error = cause;
      if (attempt < 2) await pause(750 * (attempt + 1));
    } finally { clearTimeout(timer); }
  }
  throw error;
}
function safeTicker(ticker) { return String(ticker).replace(/[^A-Z0-9.-]/g, "_"); }
const registry = await readJson(path.join(ROOT, "data/runtime/entity-registry.json"), { candidates: [] });
const observations = await readJson(path.join(ROOT, "data/runtime/company-observations.json"), { candidates: {} });
const entities = [
  ...(registry.candidates || []).filter((e) => e?.ticker && e?.cik && (!filter.size || filter.has(e.ticker))),
  ...external,
].slice(0, limit);
if (!entities.length) throw new Error("No matching registry companies with trusted CIK");

const manifestFile = path.join(cacheDir, "cache-manifest.json");
const manifest = await readJson(manifestFile, { contract: "earth2036-bridge-source-cache-v1", companies: {}, historical: {} });
const indexes = new Map(dateCutoffs.map((d) => [d, {}]));
const canaries = [];
let changed = 0;
let refreshed = 0;
for (const entity of entities) {
  const ticker = entity.ticker;
  const cik = String(entity.cik).padStart(10, "0");
  const observation = observations?.candidates?.[ticker] ?? { ticker, cik };
  const fingerprint = observation?.filingFingerprint ?? null;
  const cache = manifest.companies[ticker];
  let payload = null, archivePath = cache?.archivePath ?? null;
  try {
    if (!forceRefresh && !bulkZip && cache && cache.cik === cik &&
        cache.filingFingerprint === fingerprint && archivePath) {
      payload = await readJson(path.join(cacheDir, archivePath));
      if (!payload || truthHash(payload) !== cache.payloadHash) {
        throw new Error("cached SEC source hash mismatch for " + ticker);
      }
    } else {
      payload = await fetchCompanyFacts(cik);
      refreshed++;
      const hash = truthHash(payload);
      archivePath = path.join("source", cik, hash + ".json");
      if (!noWrite) {
        const file = path.join(cacheDir, archivePath);
        await mkdir(path.dirname(file), { recursive: true });
        try { await writeFile(file, JSON.stringify(payload) + "\n", { encoding: "utf8", flag: "wx" }); }
        catch (error) { if (error?.code !== "EEXIST") throw error; }
        const onDisk = await readJson(file);
        if (truthHash(onDisk) !== hash) throw new Error("immutable SEC source archive collision");
        manifest.companies[ticker] = {
          cik, filingFingerprint: fingerprint, payloadHash: hash, archivePath,
          fetchedAt: new Date().toISOString(),
          lastRawFactsHash: cache?.lastRawFactsHash ?? null,
        };
      }
    }
    if (String(payload?.cik).padStart(10, "0") !== cik) throw new Error("source CIK mismatch for " + ticker);
    if (observation?.cik && String(observation.cik).padStart(10, "0") !== cik) throw new Error("observation CIK mismatch for " + ticker);
  } catch (error) {
    const reason = String(error?.message ?? error);
    for (const cutoff of dateCutoffs) {
      canaries.push({ ticker, asOf: cutoff, status: "unknown", reason });
    }
    continue;
  }

  for (const cutoff of dateCutoffs) {
    try {
      const truth = buildFundamentalsTruth(payload, {
        ticker, cik, asOf: cutoff, retrievedAt: new Date().toISOString(),
        sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK" + cik + ".json",
      });
      const errors = validateFundamentalsTruth(truth);
      if (errors.length) throw new Error("invalid #10 truth: " + errors.join("; "));
      const reference = bridgeFundamentalsTruth({
        ticker, observation: { ticker, cik }, asOf: cutoff, fundamentalsTruth: truth,
      });
      const historicKey = ticker + "@" + cutoff;
      const prior = manifest.historical[historicKey];
      const reconstruction = reconstructFundamentalsBridge(reference, payload);
      const historicalDrift = prior && (
        prior.truthHash !== reference.truthHash || prior.rawFactsHash !== reference.rawFactsHash ||
        prior.sourcePayloadHash !== reference.sourcePayloadHash ||
        prior.projectionHash !== reference.projectionHash
      );
      if (reference.status !== "valid" || reconstruction.status !== "reconstructed" || historicalDrift) {
        throw new Error(historicalDrift ? "historical_truth_unrecoverable: recorded hash drift" :
          "bridge_validation_failed: " + [...reference.reason, ...reconstruction.reason].join("; "));
      }
      const auditProjection = fundamentalsAuditProjection(truth, reference);
      indexes.get(cutoff)[ticker] = { reference, auditProjection };
      if (!noWrite) {
        const previousHash = manifest.companies[ticker]?.lastRawFactsHash;
        if (reference.rawFactsHash !== previousHash) {
          await writeImmutableFundamentalsSnapshot(path.join(cacheDir, "truth"), truth);
          if (!historical) manifest.companies[ticker].lastRawFactsHash = reference.rawFactsHash;
          changed++;
        }
        manifest.historical[historicKey] = {
          truthHash: reference.truthHash, rawFactsHash: reference.rawFactsHash,
          sourcePayloadHash: reference.sourcePayloadHash, projectionHash: reference.projectionHash,
          archivePath, recordedAt: manifest.historical[historicKey]?.recordedAt ?? new Date().toISOString(),
        };
      }
      canaries.push({
        ticker, asOf: cutoff, status: "valid", rawFactCount: truth.rawTruth.factCount,
        taxonomies: truth.sourceTaxonomies, truthHash: reference.truthHash,
        reconstructed: reconstruction.status === "reconstructed",
        normalizedObservedMetricCount: truth.audit.normalizedObservedMetricCount,
      });
    } catch (error) {
      canaries.push({ ticker, asOf: cutoff, status: "invalid", reason: String(error?.message ?? error) });
    }
  }
  if (!bulkZip) await pause(140);
}

const indexReports = [];
for (const [cutoff, entries] of indexes) {
  const index = createBridgeIndex({
    asOf: cutoff, entries,
    mode: historical ? "historical-rehearsal" : "live-shadow",
  });
  if (!noWrite) {
    await writeJson(path.join(cacheDir, "indexes", cutoff.replace(/[^A-Za-z0-9]/g, "") + ".json"), index);
    if (!historical && cutoff === asOf) await writeJson(path.join(cacheDir, "current-index.json"), index);
  }
  indexReports.push({ asOf: cutoff, ...fundamentalsBridgeHealth(Object.values(entries).map((e) => e.reference)), indexHash: index.indexHash });
}
if (!noWrite) await writeJson(manifestFile, manifest);
if (!noWrite && !historical && has("--publish-health")) {
  const health = {
    contract: "earth2036-fundamentals-bridge-health-v1", system: "shadow",
    asOf, generatedAt: new Date().toISOString(), ...fundamentalsBridgeHealth(Object.values(indexes.get(asOf)).map((e) => e.reference)),
    changedThisCycle: changed, sourceRefreshes: refreshed, futureLeakage: 0,
    reconstructionFailures: canaries.filter((v) => v.status === "invalid").length,
    source: "local-verified-bridge-index", canonicalWriteAuthority: false,
    companyDetails: Object.entries(indexes.get(asOf)).map(([ticker, entry]) => ({
      ticker, status: entry.reference.status, truthHash: entry.reference.truthHash,
      rawFactsHash: entry.reference.rawFactsHash, sourcePayloadHash: entry.reference.sourcePayloadHash,
      projectionHash: entry.reference.projectionHash,
      rawFactCount: entry.reference.rawFactCount,
      currentCount: entry.reference.rawCurrentCount,
      supersededCount: entry.reference.rawSupersededCount,
      taxonomies: entry.reference.sourceTaxonomies,
      cutoff: entry.reference.asOf,
      latestSecFiling: (observations.candidates?.[ticker]?.filings || [])
        .map((r) => r.filingDate).filter(Boolean).sort().at(-1) ?? null,
      reconstructionState: "source-archive-indexed",
    })).sort((a, b) => a.ticker.localeCompare(b.ticker)),
  };
  await writeJson(path.join(ROOT, "data/runtime/workgraph/shadow/fundamentals-bridge-health.json"), health);
}
const invalid = canaries.filter((r) => r.status === "invalid").length;
const unknown = canaries.filter((r) => r.status === "unknown").length;
console.log(JSON.stringify({
  contract: "earth2036-fundamentals-trajectory-bridge-v1", system: "shadow",
  asOf, historical, trialEligible: false, companies: entities.length, sourceRefreshes: refreshed,
  changedFactStates: changed, invalid, unknown, indexes: indexReports, canaries,
}, null, 2));
if (strict && (invalid || unknown)) process.exitCode = 1;
