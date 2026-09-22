import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFundamentalsTruth, validateFundamentalsTruth } from "./lib/sec-fundamentals-truth.mjs";

const ROOT = process.cwd();
const USER_AGENT = process.env.SEC_USER_AGENT || "JILLOnline Earth2036 info@jillonlinestore.com";
const args = process.argv.slice(2);

function argValue(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] != null ? args[index + 1] : fallback;
}

const tickersArg = argValue("--tickers", "");
const limit = Math.max(1, Number(argValue("--limit", "5")) || 5);
const asOf = argValue("--as-of", new Date().toISOString());
const writeMode = !args.includes("--no-write");
const auditDetails = args.includes("--audit-details");
const outputDir = argValue("--output-dir", path.join("data", "lab", "truth", "fundamentals"));

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function selectedSummary(bucket) {
  const fact = bucket?.selected ?? null;
  return {
    status: bucket?.status ?? "missing",
    selected: fact ? {
      taxonomy: fact.taxonomy,
      tag: fact.tag,
      unit: fact.unit,
      val: fact.val,
      start: fact.start,
      end: fact.end,
      filed: fact.filed,
      accn: fact.accn,
      form: fact.form
    } : null,
    candidateCount: Array.isArray(bucket?.facts) ? bucket.facts.length : 0
  };
}

function auditTruth(truth) {
  const metrics = {};
  for (const [name, metric] of Object.entries(truth.metrics ?? {})) {
    const ambiguityByKind = {};
    for (const period of metric.periods ?? []) {
      if (String(period.status).startsWith("ambiguous")) {
        ambiguityByKind[period.kind] = (ambiguityByKind[period.kind] || 0) + 1;
      }
    }
    metrics[name] = {
      status: metric.status,
      sourceFacts: metric.allEligibleFacts.length,
      currentFacts: metric.currentFacts.length,
      supersededFacts: metric.supersededFacts.length,
      ambiguousPeriods: Object.values(ambiguityByKind).reduce((a,b)=>a+b,0),
      ambiguityByKind,
      latest: metric.periodType === "instant"
        ? { instant: selectedSummary(metric.latest?.instant) }
        : {
            annual: selectedSummary(metric.latest?.annual),
            quarter: selectedSummary(metric.latest?.quarter),
            yearToDate: selectedSummary(metric.latest?.yearToDate)
          }
    };
  }
  const derived = Object.fromEntries(
    Object.entries(truth.derived ?? {}).map(([name, metric]) => [name, {
      observations: metric.observations.length,
      latest: metric.observations.at(-1) ?? null
    }])
  );
  return { metrics, derived };
}

async function fetchJson(url, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" }
      });
      if (!response.ok) throw new Error(String(response.status) + " " + response.statusText);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** (attempt - 1))));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

const registry = await readJson(path.join(ROOT, "data", "runtime", "entity-registry.json"));
const selected = new Set(
  tickersArg.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean)
);

let entities = (registry.candidates ?? []).filter((entity) => entity?.ticker && entity?.cik);
if (selected.size) {
  entities = entities.filter((entity) => selected.has(String(entity.ticker).toUpperCase()));
}
entities = entities.slice(0, limit);
if (!entities.length) throw new Error("No matching SEC-identified companies found for fundamentals canary.");

const results = [];
for (const entity of entities) {
  const sourceUrl = "https://data.sec.gov/api/xbrl/companyfacts/CIK" + entity.cik + ".json";
  const payload = await fetchJson(sourceUrl);
  const truth = buildFundamentalsTruth(payload, {
    ticker: entity.ticker,
    cik: entity.cik,
    asOf,
    retrievedAt: new Date().toISOString(),
    sourceUrl
  });
  const errors = validateFundamentalsTruth(truth);

  results.push({
    ticker: entity.ticker,
    cik: entity.cik,
    errors,
    audit: truth.audit,
    details: auditDetails ? auditTruth(truth) : undefined,
    truthHash: truth.truthHash
  });

  if (writeMode) {
    const dir = path.join(ROOT, outputDir);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, entity.ticker + ".json"), JSON.stringify(truth, null, 2) + "\n", "utf8");
  }

  await new Promise((resolve) => setTimeout(resolve, 125));
}

const failed = results.filter((result) => result.errors.length);
console.log(JSON.stringify({
  contract: "earth2036-fundamentals-truth-v1",
  asOf,
  writeMode,
  companies: results.length,
  failed: failed.length,
  results
}, null, 2));

if (failed.length) process.exitCode = 1;
