import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const RUNTIME_DIR = path.join(ROOT, "data", "runtime");
const OUTPUT = path.join(RUNTIME_DIR, "automated-source-health.json");
const USER_AGENT = process.env.SEC_USER_AGENT || "JILLOnline Earth2036 public-research-system";
const FINRA_BEARER_TOKEN = process.env.FINRA_BEARER_TOKEN || "";

const nowIso = () => new Date().toISOString();

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
}

async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return { json: await response.json(), latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function scanFinra() {
  const dataUrl = "https://api.finra.org/data/group/otcMarket/name/OTCDAILYLIST";
  const partitionsUrl = "https://api.finra.org/partitions/group/otcMarket/name/otcDailyList";
  const authorization = FINRA_BEARER_TOKEN ? { authorization: `Bearer ${FINRA_BEARER_TOKEN}` } : {};

  // FINRA's unfiltered GET intentionally starts at historical rows. Use the
  // resource-level partitions endpoint to prove the production dataset itself
  // has current calendarDay partitions instead of mistaking a 200 response for
  // freshness. The partitions resource supports unauthenticated public reads.
  const { json: partitions, latencyMs: partitionsLatencyMs } = await fetchJson(partitionsUrl, {
    headers: authorization,
  });

  const availableDays = (partitions?.availablePartitions || [])
    .flatMap((entry) => Array.isArray(entry?.partitions) ? entry.partitions : [])
    .map((value) => String(value || "").slice(0, 10))
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    .sort((a, b) => b.localeCompare(a));

  if (!availableDays.length) throw new Error("FINRA OTC Daily List returned no calendarDay partitions");

  const latestCalendarDay = availableDays[0];
  const latestPartitionMs = Date.parse(`${latestCalendarDay}T23:59:59Z`);
  if (!Number.isFinite(latestPartitionMs)) throw new Error(`FINRA OTC Daily List returned invalid latest partition ${latestCalendarDay}`);

  const ageDays = (Date.now() - latestPartitionMs) / 86_400_000;
  if (ageDays > 7) {
    throw new Error(`FINRA OTC Daily List partitions are stale; latest available calendarDay is ${latestCalendarDay}`);
  }

  let rows = [];
  let dataLatencyMs = null;
  let observationMode = "partition-freshness";
  let eventDataAvailable = false;
  let note = "Freshness validated from FINRA's calendarDay partitions. Row-level current corporate-action retrieval requires a FINRA public Query API bearer token; until configured, the intelligent supervisor must corroborate material OTC events through FINRA OTCE before discovery can be considered complete.";

  if (FINRA_BEARER_TOKEN) {
    const requestBody = {
      fields: ["newSymbolCode", "oldSymbolCode", "dailyListEventCode", "dailyListDatetime", "calendarDay", "newSecurityDescription", "oldSecurityDescription"],
      compareFilters: [{
        compareType: "EQUAL",
        fieldName: "calendarDay",
        fieldValue: latestCalendarDay,
      }],
      limit: 100,
    };
    const result = await fetchJson(dataUrl, {
      method: "POST",
      headers: {
        ...authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    rows = Array.isArray(result.json) ? result.json : [];
    dataLatencyMs = result.latencyMs;
    observationMode = "current-partition-events";
    eventDataAvailable = true;
    note = `Current FINRA corporate-action rows queried from calendarDay ${latestCalendarDay}.`;
  }

  return {
    latencyMs: Math.max(partitionsLatencyMs, dataLatencyMs ?? 0),
    sourceUrl: dataUrl,
    partitionsUrl,
    latestCalendarDay,
    partitionCount: availableDays.length,
    recordCount: eventDataAvailable ? rows.length : null,
    observationMode,
    eventDataAvailable,
    note,
    sample: rows.slice(0, 20).map((row) => ({
      symbol: row.newSymbolCode ?? row.oldSymbolCode ?? null,
      oldSymbol: row.oldSymbolCode ?? null,
      eventCode: row.dailyListEventCode ?? null,
      eventAt: row.dailyListDatetime ?? null,
      calendarDay: row.calendarDay ?? latestCalendarDay,
      description: row.newSecurityDescription ?? row.oldSecurityDescription ?? null,
    })),
  };
}

async function scanUsaSpending() {
  const url = "https://api.usaspending.gov/api/v2/awards/last_updated/";
  const { json, latencyMs } = await fetchJson(url);
  if (!json?.last_updated) throw new Error("USAspending freshness endpoint returned no last_updated value");
  return {
    latencyMs,
    sourceUrl: url,
    datasetLastUpdated: json.last_updated,
    recordCount: null,
    note: "Authoritative dataset freshness check passed. Candidate-level award lookups remain an on-demand supervisor research task so the hourly health probe stays lightweight and reliable.",
  };
}

async function scanClinicalTrials() {
  const versionUrl = "https://clinicaltrials.gov/api/v2/version";
  const { json: version, latencyMs: versionLatency } = await fetchJson(versionUrl);
  const studiesUrl = "https://clinicaltrials.gov/api/v2/studies?format=json&pageSize=100&fields=NCTId,LeadSponsorName,LastUpdatePostDate,OverallStatus,Phase&sort=LastUpdatePostDate:desc";
  const { json, latencyMs } = await fetchJson(studiesUrl, {}, 20000);
  const studies = Array.isArray(json?.studies) ? json.studies : [];
  return {
    latencyMs: Math.max(versionLatency, latencyMs),
    sourceUrl: studiesUrl,
    apiVersion: version?.apiVersion ?? null,
    datasetTimestamp: version?.dataTimestamp ?? null,
    recordCount: studies.length,
    sample: studies.slice(0, 20).map((study) => ({
      nctId: study?.protocolSection?.identificationModule?.nctId ?? null,
      sponsor: study?.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name ?? null,
      lastUpdatePostDate: study?.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date ?? null,
      status: study?.protocolSection?.statusModule?.overallStatus ?? null,
      phases: study?.protocolSection?.designModule?.phases ?? [],
    })),
  };
}

async function scanFda() {
  const url = "https://api.fda.gov/drug/drugsfda.json?limit=50";
  const { json, latencyMs } = await fetchJson(url);
  const rows = Array.isArray(json?.results) ? json.results : [];
  return {
    latencyMs,
    sourceUrl: url,
    datasetLastUpdated: json?.meta?.last_updated ?? null,
    totalRecords: json?.meta?.results?.total ?? null,
    recordCount: rows.length,
    sample: rows.slice(0, 20).map((row) => ({
      applicationNumber: row.application_number ?? null,
      sponsor: row.sponsor_name ?? null,
      products: Array.isArray(row.products) ? row.products.slice(0, 3).map((product) => product.brand_name ?? product.active_ingredients?.[0]?.name ?? null) : [],
    })),
  };
}

const scanners = [
  ["finra-otc-daily-list", "FINRA OTC Daily List", scanFinra],
  ["usaspending", "USAspending.gov", scanUsaSpending],
  ["clinicaltrials", "ClinicalTrials.gov", scanClinicalTrials],
  ["fda", "U.S. Food and Drug Administration", scanFda],
];

await mkdir(RUNTIME_DIR, { recursive: true });
const previous = await readJson(OUTPUT, { sources: [] });
const previousById = new Map((previous.sources || []).map((source) => [source.id, source]));
const observedAt = nowIso();
const sources = [];

for (const [id, name, scanner] of scanners) {
  try {
    const detail = await scanner();
    sources.push({
      id,
      name,
      requiredForCoverage: true,
      status: "healthy",
      observedAt,
      lastSuccess: observedAt,
      lastFailure: previousById.get(id)?.lastFailure ?? null,
      ...detail,
    });
  } catch (error) {
    sources.push({
      id,
      name,
      requiredForCoverage: true,
      status: "failed",
      observedAt,
      lastSuccess: previousById.get(id)?.lastSuccess ?? null,
      lastFailure: observedAt,
      error: String(error?.message ?? error),
    });
  }
}

const required = sources.filter((source) => source.requiredForCoverage);
const healthy = required.filter((source) => source.status === "healthy").length;
const output = {
  version: 1,
  updatedAt: observedAt,
  coverageRatio: required.length ? healthy / required.length : 0,
  healthyRequiredSources: healthy,
  requiredSources: required.length,
  deferredSources: [
    { id: "sam-gov", reason: "Deferred by owner; no SAM.gov API key configured yet." },
  ],
  corroborativeNonGatingSources: [
    { id: "otc-markets-directory", reason: "Official-secondary corroboration; FINRA OTC Daily List is the primary automated OTC corporate-action source." },
  ],
  sources,
};

await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  automatedCoverage: output.coverageRatio,
  healthyRequiredSources: healthy,
  requiredSources: required.length,
  failed: sources.filter((source) => source.status !== "healthy").map((source) => source.id),
}, null, 2));
