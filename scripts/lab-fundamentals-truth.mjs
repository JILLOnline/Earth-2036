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
const outputDir = argValue("--output-dir", path.join("data", "lab", "truth", "fundamentals"));

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
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
