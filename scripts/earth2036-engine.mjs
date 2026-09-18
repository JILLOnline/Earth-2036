import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildUniverse, normalizeTicker } from "./lib/universe-parser.mjs";
import {
  baselineGate,
  isPublishableScoreRecord,
  isScoreRecordComplete,
  qualifiesTick,
  rankRecords,
} from "./lib/runtime-gates.mjs";

const ROOT = process.cwd();
const RUNTIME_DIR = path.join(ROOT, "data", "runtime");
const BASELINE_MANIFEST = path.join(ROOT, "data", "baselines", "earth2036-official-t0-2026-09-12", "manifest.json");
const METHODOLOGY_VERSION = "1.0.0";
const UNIVERSE_VERSION = "u1-250";
const EXPECTED = 250;
const SEC_USER_AGENT = process.env.SEC_USER_AGENT || "Earth2036/1.0 research-system https://github.com/JILLOnline/Earth-2036";

const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const NASDAQ_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt";
const OTHER_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const nowIso = () => new Date().toISOString();
const cycleKey = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}00Z`;
};

async function ensureRuntime() {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await mkdir(path.join(RUNTIME_DIR, "ticks"), { recursive: true });
}

async function readText(file, fallback = "") {
  try {
    return await readFile(file, "utf8");
  } catch {
    return fallback;
  }
}

async function readJson(file, fallback) {
  const text = await readText(file, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function appendJsonLine(file, value) {
  const previous = await readText(file, "");
  await writeFile(file, `${previous}${JSON.stringify(value)}\n`, "utf8");
}

async function fetchWithRetry(url, options = {}, tries = 2, timeoutMs = 12000) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const latencyMs = Date.now() - started;
      clearTimeout(timer);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return { response, latencyMs };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < tries) await sleep(500 * attempt);
    }
  }
  throw lastError;
}

export function parseSecTickerMap(payload) {
  const byTicker = new Map();
  for (const value of Object.values(payload ?? {})) {
    if (!value?.ticker || value?.cik_str == null) continue;
    byTicker.set(normalizeTicker(value.ticker), {
      ticker: normalizeTicker(value.ticker),
      cik: String(value.cik_str).padStart(10, "0"),
      title: value.title ?? "",
    });
  }
  return byTicker;
}

export function parseNasdaqListed(text) {
  const map = new Map();
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (let index = 1; index < lines.length; index += 1) {
    const parts = lines[index].split("|");
    if (parts.length < 8 || parts[0] === "File Creation Time") continue;
    const [symbol, name, , testIssue, , roundLot, etf] = parts;
    if (!symbol || etf === "Y" || testIssue === "Y") continue;
    map.set(normalizeTicker(symbol), { symbol: normalizeTicker(symbol), name, exchange: "NASDAQ", roundLot });
  }
  return map;
}

const OTHER_EXCHANGE = Object.freeze({
  A: "NYSE AMERICAN",
  N: "NYSE",
  P: "NYSE ARCA",
  Z: "CBOE BZX",
  V: "IEX",
});

export function parseOtherListed(text) {
  const map = new Map();
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (let index = 1; index < lines.length; index += 1) {
    const parts = lines[index].split("|");
    if (parts.length < 7 || parts[0] === "File Creation Time") continue;
    const [actSymbol, name, exchangeCode, , etf, roundLot, testIssue] = parts;
    if (!actSymbol || etf === "Y" || testIssue === "Y") continue;
    map.set(normalizeTicker(actSymbol), {
      symbol: normalizeTicker(actSymbol),
      name,
      exchange: OTHER_EXCHANGE[exchangeCode] ?? exchangeCode ?? "OTHER",
      roundLot,
    });
  }
  return map;
}

export function mergeExchangeMaps(...maps) {
  const merged = new Map();
  for (const map of maps) for (const [key, value] of map) merged.set(key, value);
  return merged;
}

function recentFilings(submissions) {
  const recent = submissions?.filings?.recent ?? {};
  const accessions = recent.accessionNumber ?? [];
  const result = [];
  for (let index = 0; index < Math.min(accessions.length, 12); index += 1) {
    result.push({
      accessionNumber: accessions[index] ?? null,
      filingDate: recent.filingDate?.[index] ?? null,
      reportDate: recent.reportDate?.[index] ?? null,
      form: recent.form?.[index] ?? null,
      primaryDocument: recent.primaryDocument?.[index] ?? null,
    });
  }
  return result;
}

function mergeDiscoveryPool(previous, additions) {
  const byKey = new Map((previous.items ?? []).map((item) => [`${item.ticker}:${item.exchange}`, item]));
  for (const item of additions) {
    const key = `${item.ticker}:${item.exchange}`;
    const existing = byKey.get(key);
    byKey.set(key, existing ? { ...existing, lastSeenAt: item.lastSeenAt, sourceUrl: item.sourceUrl } : item);
  }
  return { version: 1, updatedAt: nowIso(), items: [...byKey.values()].sort((a, b) => a.ticker.localeCompare(b.ticker)) };
}

function sourceRecord(previous, id, name, authority, cadence, requiredForTick) {
  const prior = (previous.sources ?? []).find((source) => source.id === id) ?? {};
  return { id, name, authority, cadence, requiredForTick, status: "unknown", lastSuccess: prior.lastSuccess ?? null, lastFailure: prior.lastFailure ?? null, latencyMs: null, coverage: 0, note: "" };
}

function sourceSuccess(source, latencyMs, coverage = 1, note = "") {
  return { ...source, status: coverage >= 0.98 ? "healthy" : coverage >= 0.9 ? "degraded" : "unhealthy", lastSuccess: nowIso(), latencyMs, coverage, note };
}

function sourceFailure(source, error) {
  return { ...source, status: "failed", lastFailure: nowIso(), latencyMs: null, coverage: 0, note: String(error?.message ?? error) };
}

async function main() {
  await ensureRuntime();
  const startedAt = nowIso();
  const thisCycle = cycleKey();

  const [universeSource, expansionSource] = await Promise.all([
    readText(path.join(ROOT, "lib", "universe.ts")),
    readText(path.join(ROOT, "lib", "universe-expansion.ts")),
  ]);
  const universe = buildUniverse({ universeSource, expansionSource, expectedSize: EXPECTED });
  const universeTickers = new Set(universe.map((candidate) => candidate.ticker));

  const previousHealth = await readJson(path.join(RUNTIME_DIR, "source-health.json"), { sources: [] });
  const previousEntities = await readJson(path.join(RUNTIME_DIR, "entity-registry.json"), { candidates: [] });
  const previousObservations = await readJson(path.join(RUNTIME_DIR, "company-observations.json"), { candidates: {} });
  const previousListingSnapshot = await readJson(path.join(RUNTIME_DIR, "listing-snapshot.json"), null);
  const previousDiscovery = await readJson(path.join(RUNTIME_DIR, "discovery-pool.json"), { version: 1, items: [] });
  const queue = await readJson(path.join(RUNTIME_DIR, "evidence-review-queue.json"), { version: 1, items: [] });
  const supervisor = await readJson(path.join(RUNTIME_DIR, "supervisor-state.json"), {
    updatedAt: null,
    sourceCoverageRatio: 0,
    discoveryScanCompleted: false,
    rejectedSeeds: 0,
    replacementCandidates: 0,
    notes: ["Awaiting intelligent supervisor coverage."],
  });
  const scoreState = await readJson(path.join(RUNTIME_DIR, "score-state.json"), { methodologyVersion: METHODOLOGY_VERSION, candidates: {} });
  const runtimeState = await readJson(path.join(RUNTIME_DIR, "system-state.json"), { qualifiedTrialTicks: 0, lastQualifiedCycleKey: null });
  const baselineManifest = await readJson(BASELINE_MANIFEST, null);

  let secMap = new Map();
  let nasdaqMap = new Map();
  let otherMap = new Map();
  const sources = [];

  let secTickerSource = sourceRecord(previousHealth, "sec-company-tickers", "SEC company ticker map", "primary", "hourly", true);
  try {
    const { response, latencyMs } = await fetchWithRetry(SEC_TICKERS_URL, { headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/json" } });
    secMap = parseSecTickerMap(await response.json());
    secTickerSource = sourceSuccess(secTickerSource, latencyMs, 1, `${secMap.size} SEC ticker identities loaded`);
  } catch (error) {
    secTickerSource = sourceFailure(secTickerSource, error);
  }
  sources.push(secTickerSource);

  let nasdaqSource = sourceRecord(previousHealth, "nasdaq-symbol-directory", "Nasdaq listed equities", "primary", "hourly", true);
  try {
    const { response, latencyMs } = await fetchWithRetry(NASDAQ_LISTED_URL);
    nasdaqMap = parseNasdaqListed(await response.text());
    nasdaqSource = sourceSuccess(nasdaqSource, latencyMs, 1, `${nasdaqMap.size} operating securities loaded`);
  } catch (error) {
    nasdaqSource = sourceFailure(nasdaqSource, error);
  }
  sources.push(nasdaqSource);

  let otherSource = sourceRecord(previousHealth, "other-listed-symbol-directory", "NYSE/NYSE American/Cboe/IEX symbol directory", "primary", "hourly", true);
  try {
    const { response, latencyMs } = await fetchWithRetry(OTHER_LISTED_URL);
    otherMap = parseOtherListed(await response.text());
    otherSource = sourceSuccess(otherSource, latencyMs, 1, `${otherMap.size} operating securities loaded`);
  } catch (error) {
    otherSource = sourceFailure(otherSource, error);
  }
  sources.push(otherSource);

  const exchangeMap = mergeExchangeMaps(nasdaqMap, otherMap);
  const entities = universe.map((candidate) => {
    const sec = secMap.get(candidate.ticker) ?? null;
    const exchange = exchangeMap.get(candidate.ticker) ?? null;
    return {
      ...candidate,
      cik: sec?.cik ?? null,
      secName: sec?.title ?? null,
      exchange: exchange?.exchange ?? null,
      exchangeName: exchange?.name ?? null,
      identityStatus: sec ? "validated" : "unresolved",
      tradabilityStatus: exchange ? "validated" : "unresolved",
      validatedAt: sec || exchange ? startedAt : null,
    };
  });

  const identityValidated = entities.filter((entity) => entity.identityStatus === "validated").length;
  const tradabilityValidated = entities.filter((entity) => entity.tradabilityStatus === "validated").length;
  await writeJson(path.join(RUNTIME_DIR, "entity-registry.json"), {
    version: 1,
    universeVersion: UNIVERSE_VERSION,
    updatedAt: startedAt,
    previousUpdatedAt: previousEntities.updatedAt ?? null,
    expected: EXPECTED,
    identityValidated,
    tradabilityValidated,
    candidates: entities,
  });

  const currentListings = [...exchangeMap.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const currentListingBySymbol = new Map(currentListings.map((item) => [item.symbol, item]));
  const newlyListed = [];
  if (previousListingSnapshot?.symbols) {
    const previousSymbols = new Set(previousListingSnapshot.symbols.map((item) => item.symbol));
    for (const listing of currentListings) {
      if (!previousSymbols.has(listing.symbol) && !universeTickers.has(listing.symbol)) {
        newlyListed.push({
          firstDetectedAt: startedAt,
          lastSeenAt: startedAt,
          ticker: listing.symbol,
          company: listing.name,
          exchange: listing.exchange,
          listingStage: "trading",
          status: "outside_universe",
          detectionSource: "official-symbol-directory",
          sourceUrl: listing.exchange === "NASDAQ" ? NASDAQ_LISTED_URL : OTHER_LISTED_URL,
          dataConfidence: 80,
          notes: "New symbol detected relative to the prior official exchange snapshot; requires business relevance screening before admission consideration.",
        });
      }
    }
  }
  await writeJson(path.join(RUNTIME_DIR, "listing-snapshot.json"), {
    version: 1,
    capturedAt: startedAt,
    bootstrap: !previousListingSnapshot,
    sourceFingerprint: hash(currentListings),
    symbols: currentListings,
  });
  await writeJson(path.join(RUNTIME_DIR, "discovery-pool.json"), mergeDiscoveryPool(previousDiscovery, newlyListed));

  const observations = {};
  const priorQueueById = new Map((queue.items ?? []).map((item) => [item.id, item]));
  let observedCount = 0;
  let submissionLatencyTotal = 0;
  let submissionRequests = 0;

  for (const entity of entities) {
    const previous = previousObservations.candidates?.[entity.ticker] ?? null;
    if (!entity.cik) {
      observations[entity.ticker] = { ticker: entity.ticker, observedAt: startedAt, status: "unresolved_identity", cik: null, filingFingerprint: null, filings: [] };
      continue;
    }

    try {
      await sleep(115);
      const url = `https://data.sec.gov/submissions/CIK${entity.cik}.json`;
      const { response, latencyMs } = await fetchWithRetry(url, { headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/json" } }, 2, 10000);
      const submissions = await response.json();
      const filings = recentFilings(submissions);
      const filingFingerprint = hash(filings.map((filing) => [filing.accessionNumber, filing.form, filing.filingDate]));
      observedCount += 1;
      submissionLatencyTotal += latencyMs;
      submissionRequests += 1;
      observations[entity.ticker] = {
        ticker: entity.ticker,
        observedAt: startedAt,
        status: "observed",
        cik: entity.cik,
        secName: submissions.name ?? entity.secName,
        sic: submissions.sic ?? null,
        fiscalYearEnd: submissions.fiscalYearEnd ?? null,
        filingFingerprint,
        filings,
        sourceUrl: url,
      };

      if (previous?.filingFingerprint && previous.filingFingerprint !== filingFingerprint) {
        const priorAccessions = new Set((previous.filings ?? []).map((filing) => filing.accessionNumber));
        for (const filing of filings.filter((item) => item.accessionNumber && !priorAccessions.has(item.accessionNumber))) {
          const id = `${entity.ticker}:${filing.accessionNumber}`;
          if (!priorQueueById.has(id)) {
            priorQueueById.set(id, {
              id,
              ticker: entity.ticker,
              cik: entity.cik,
              detectedAt: startedAt,
              form: filing.form,
              filingDate: filing.filingDate,
              reportDate: filing.reportDate,
              accessionNumber: filing.accessionNumber,
              primaryDocument: filing.primaryDocument,
              sourceUrl: `https://www.sec.gov/Archives/edgar/data/${Number(entity.cik)}/${String(filing.accessionNumber).replaceAll("-", "")}/${filing.primaryDocument}`,
              status: "pending",
              reviewer: null,
              resolutionNote: null,
            });
          }
        }
      }
    } catch (error) {
      observations[entity.ticker] = {
        ticker: entity.ticker,
        observedAt: startedAt,
        status: "failed",
        cik: entity.cik,
        filingFingerprint: previous?.filingFingerprint ?? null,
        filings: previous?.filings ?? [],
        error: String(error?.message ?? error),
      };
    }
  }

  await writeJson(path.join(RUNTIME_DIR, "company-observations.json"), {
    version: 1,
    universeVersion: UNIVERSE_VERSION,
    methodologyVersion: METHODOLOGY_VERSION,
    capturedAt: startedAt,
    companiesExpected: EXPECTED,
    companiesObserved: observedCount,
    candidates: observations,
  });

  const submissionCoverage = observedCount / EXPECTED;
  const submissionsSource = sourceRecord(previousHealth, "sec-submissions-universe", "SEC submissions — active universe", "primary", "hourly", true);
  sources.push(
    submissionRequests > 0
      ? sourceSuccess(submissionsSource, Math.round(submissionLatencyTotal / submissionRequests), submissionCoverage, `${observedCount}/${EXPECTED} active companies observed`)
      : sourceFailure(submissionsSource, new Error("No SEC submissions observations succeeded")),
  );

  const unresolvedQueue = [...priorQueueById.values()].filter((item) => item.status !== "resolved");
  await writeJson(path.join(RUNTIME_DIR, "evidence-review-queue.json"), {
    version: 1,
    updatedAt: startedAt,
    unresolved: unresolvedQueue.length,
    items: [...priorQueueById.values()].sort((a, b) => String(b.detectedAt).localeCompare(String(a.detectedAt))),
  });

  const requiredSources = sources.filter((source) => source.requiredForTick);
  const machineCoverage = requiredSources.reduce((sum, source) => sum + Number(source.coverage || 0), 0) / Math.max(1, requiredSources.length);
  const machineDiscoveryComplete = [secTickerSource, nasdaqSource, otherSource].every((source) => source.status === "healthy");
  const supervisorCoverage = Number(supervisor.sourceCoverageRatio ?? 0);
  const combinedCoverage = Math.min(machineCoverage, supervisorCoverage);
  const discoveryScanCompleted = machineDiscoveryComplete && supervisor.discoveryScanCompleted === true;

  await writeJson(path.join(RUNTIME_DIR, "source-health.json"), {
    version: 1,
    updatedAt: startedAt,
    machineCoverageRatio: Math.round(machineCoverage * 10000) / 10000,
    supervisorCoverageRatio: Math.round(supervisorCoverage * 10000) / 10000,
    combinedCoverageRatio: Math.round(combinedCoverage * 10000) / 10000,
    machineDiscoveryComplete,
    supervisorDiscoveryComplete: supervisor.discoveryScanCompleted === true,
    sources,
  });

  const scoreRecords = Object.entries(scoreState.candidates ?? {}).map(([ticker, record]) => ({ ticker, ...record }));
  const scoredCompanies = scoreRecords.filter((record) => isScoreRecordComplete(record, METHODOLOGY_VERSION, 60)).length;
  const publishableCompanies = scoreRecords.filter((record) => isPublishableScoreRecord(record, METHODOLOGY_VERSION, 60)).length;
  const ranked = rankRecords(scoreRecords.filter((record) => isPublishableScoreRecord(record, METHODOLOGY_VERSION, 60)));
  await writeJson(path.join(RUNTIME_DIR, "current-ranking.json"), {
    version: 1,
    methodologyVersion: METHODOLOGY_VERSION,
    capturedAt: startedAt,
    official: Boolean(baselineManifest?.published),
    publishableCompanies,
    rankings: ranked,
  });

  let manifest = baselineManifest;
  if (manifest) {
    const gate = baselineGate({
      identityValidated,
      tradabilityValidated,
      scoredCompanies,
      publishableCompanies,
      sourceCoverage: combinedCoverage,
      discoveryScanCompleted,
      unresolvedEvidence: unresolvedQueue.length,
    });
    manifest = {
      ...manifest,
      identityValidated,
      tradabilityValidated,
      scoredCompanies,
      publishableCompanies,
      rejectedSeeds: Number(supervisor.rejectedSeeds ?? manifest.rejectedSeeds ?? 0),
      replacementCandidates: Number(supervisor.replacementCandidates ?? manifest.replacementCandidates ?? 0),
      discoveryScanCompleted,
      sourceCoverageRatio: Math.round(combinedCoverage * 10000) / 10000,
      trialEligible: Boolean(manifest.published && gate.passed),
      runtimeGate: gate,
      lastMachineCycleAt: startedAt,
    };
    await writeJson(BASELINE_MANIFEST, manifest);
  }

  const baselinePublished = Boolean(manifest?.published);
  const qualified = qualifiesTick({
    baselinePublished,
    companiesExpected: EXPECTED,
    companiesObserved: observedCount,
    sourceCoverage: combinedCoverage,
    discoveryScanCompleted,
    methodologyVersion: METHODOLOGY_VERSION,
    unresolvedEvidence: unresolvedQueue.length,
    scoredCompanies: publishableCompanies,
  });

  let qualifiedTrialTicks = Number(runtimeState.qualifiedTrialTicks ?? manifest?.qualifiedTrialTicksAfterBaseline ?? 0);
  let lastQualifiedCycleKey = runtimeState.lastQualifiedCycleKey ?? null;
  if (qualified && lastQualifiedCycleKey !== thisCycle) {
    qualifiedTrialTicks += 1;
    lastQualifiedCycleKey = thisCycle;
    const rankedByTicker = new Map(ranked.map((record) => [record.ticker, record]));
    const tickRows = entities.map((entity) => {
      const rank = rankedByTicker.get(entity.ticker) ?? null;
      return {
        ticker: entity.ticker,
        rank: rank?.rank ?? null,
        rankClass: rank?.rankClass ?? null,
        earthScore: rank?.earthScore ?? null,
        dataConfidence: rank?.dataConfidence ?? null,
        risk: rank?.risk ?? null,
        filingFingerprint: observations[entity.ticker]?.filingFingerprint ?? null,
      };
    });
    await writeJson(path.join(RUNTIME_DIR, "ticks", `${thisCycle}.json`), {
      tickNumber: qualifiedTrialTicks,
      cycleKey: thisCycle,
      capturedAt: startedAt,
      methodologyVersion: METHODOLOGY_VERSION,
      universeVersion: UNIVERSE_VERSION,
      sourceCoverageRatio: combinedCoverage,
      discoveryScanCompleted,
      companiesObserved: observedCount,
      rankings: tickRows,
    });
  }

  if (manifest && manifest.qualifiedTrialTicksAfterBaseline !== qualifiedTrialTicks) {
    manifest = { ...manifest, qualifiedTrialTicksAfterBaseline: qualifiedTrialTicks };
    await writeJson(BASELINE_MANIFEST, manifest);
  }

  const state = {
    version: 1,
    phase: baselinePublished ? "trial" : "official_t0_baseline",
    cycleKey: thisCycle,
    lastCycleAt: startedAt,
    cycleStatus: observedCount === EXPECTED ? "completed" : "partial",
    methodologyVersion: METHODOLOGY_VERSION,
    universeVersion: UNIVERSE_VERSION,
    companiesExpected: EXPECTED,
    companiesObserved: observedCount,
    identityValidated,
    tradabilityValidated,
    scoredCompanies,
    publishableCompanies,
    machineSourceCoverageRatio: Math.round(machineCoverage * 10000) / 10000,
    supervisorSourceCoverageRatio: Math.round(supervisorCoverage * 10000) / 10000,
    combinedSourceCoverageRatio: Math.round(combinedCoverage * 10000) / 10000,
    machineDiscoveryComplete,
    discoveryScanCompleted,
    newDiscoveries: newlyListed.length,
    unresolvedEvidence: unresolvedQueue.length,
    qualifiedTick: qualified,
    qualifiedTrialTicks,
    lastQualifiedCycleKey,
    canonicalRepository: "JILLOnline/Earth-2036",
    canonicalBranch: "main",
    controlPlane: "github-native-v2",
    browserProjection: "github-pages",
  };
  await writeJson(path.join(RUNTIME_DIR, "system-state.json"), state);

  const cycleHistoryPath = path.join(RUNTIME_DIR, "cycle-history.jsonl");
  const priorHistory = await readText(cycleHistoryPath, "");
  const alreadyRecorded = priorHistory.split(/\r?\n/).some((line) => line.includes(`\"cycleKey\":\"${thisCycle}\"`));
  if (!alreadyRecorded) await appendJsonLine(cycleHistoryPath, state);

  console.log(JSON.stringify({
    cycleKey: thisCycle,
    phase: state.phase,
    companiesObserved: observedCount,
    identityValidated,
    tradabilityValidated,
    publishableCompanies,
    newDiscoveries: newlyListed.length,
    unresolvedEvidence: unresolvedQueue.length,
    machineCoverage: state.machineSourceCoverageRatio,
    combinedCoverage: state.combinedSourceCoverageRatio,
    qualifiedTick: qualified,
    qualifiedTrialTicks,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
