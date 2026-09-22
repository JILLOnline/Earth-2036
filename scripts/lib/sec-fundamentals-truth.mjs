import { createHash } from "node:crypto";
import { FUNDAMENTAL_METRICS } from "./fundamental-metric-map.mjs";

const NORMALIZED_FORMS = new Set([
  "10-K","10-K/A","10-Q","10-Q/A","20-F","20-F/A","40-F","40-F/A","6-K","6-K/A"
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function stableJson(value) {
  return JSON.stringify(stable(value));
}

export function truthHash(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function filedAvailabilityMs(value) {
  if (!value) return null;
  const source = String(value);
  const ms = Date.parse(source.length === 10 ? source + "T23:59:59.999Z" : source);
  return Number.isFinite(ms) ? ms : null;
}

function dayMs(value) {
  if (!value) return null;
  const source = String(value);
  const ms = Date.parse(source.length === 10 ? source + "T00:00:00.000Z" : source);
  return Number.isFinite(ms) ? ms : null;
}

function daySpan(start, end) {
  const a = dayMs(start);
  const b = dayMs(end);
  return a == null || b == null ? null : Math.round((b - a) / 86400000);
}

function calendarDayAge(asOf, value) {
  const a = dayMs(String(asOf || "").slice(0, 10));
  const b = dayMs(String(value || "").slice(0, 10));
  if (a == null || b == null) return null;
  return Math.floor((a - b) / 86400000);
}

function compactFact({ taxonomy, tag, label, description, unit, fact }) {
  return {
    taxonomy,
    tag,
    label: label ?? null,
    description: description ?? null,
    unit,
    val: fact?.val ?? null,
    start: fact?.start ?? null,
    end: fact?.end ?? null,
    filed: fact?.filed ?? null,
    accn: fact?.accn ?? null,
    form: fact?.form ?? null,
    fy: fact?.fy ?? null,
    fp: fact?.fp ?? null,
    frame: fact?.frame ?? null,
  };
}

function exactFactKey(fact) {
  return [
    fact.taxonomy, fact.tag, fact.unit, typeof fact.val, String(fact.val),
    fact.start, fact.end, fact.filed, fact.accn, fact.form, fact.fy, fact.fp, fact.frame
  ].join("|");
}

function contextKey(fact) {
  return [fact.taxonomy, fact.tag, fact.unit, fact.start ?? "", fact.end ?? ""].join("|");
}

function periodKey(fact) {
  return [fact.unit, fact.start ?? "", fact.end ?? ""].join("|");
}

function sortVersions(a, b) {
  return String(a.filed ?? "").localeCompare(String(b.filed ?? "")) ||
    String(a.accn ?? "").localeCompare(String(b.accn ?? ""));
}

function sourceEligible(fact, asOfMs) {
  const filedMs = filedAvailabilityMs(fact?.filed);
  return filedMs != null && filedMs <= asOfMs;
}

export function extractAllStandardFacts(companyFacts, asOf) {
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs)) throw new Error("Invalid fundamentals asOf: " + asOf);

  const facts = [];
  const seen = new Set();

  for (const [taxonomy, concepts] of Object.entries(companyFacts?.facts ?? {})) {
    if (!concepts || typeof concepts !== "object") continue;
    for (const [tag, concept] of Object.entries(concepts)) {
      if (!concept?.units || typeof concept.units !== "object") continue;
      for (const [unit, values] of Object.entries(concept.units)) {
        for (const raw of Array.isArray(values) ? values : []) {
          const fact = compactFact({
            taxonomy, tag, label: concept.label, description: concept.description, unit, fact: raw
          });
          if (!sourceEligible(fact, asOfMs)) continue;
          const key = exactFactKey(fact);
          if (seen.has(key)) continue;
          seen.add(key);
          facts.push(fact);
        }
      }
    }
  }

  facts.sort((a, b) =>
    String(a.taxonomy).localeCompare(String(b.taxonomy)) ||
    String(a.tag).localeCompare(String(b.tag)) ||
    String(a.unit).localeCompare(String(b.unit)) ||
    String(a.end ?? "").localeCompare(String(b.end ?? "")) ||
    String(a.start ?? "").localeCompare(String(b.start ?? "")) ||
    sortVersions(a, b)
  );
  return facts;
}

export function latestContextVersions(facts) {
  const groups = new Map();
  for (const fact of facts) {
    const key = contextKey(fact);
    const list = groups.get(key) ?? [];
    list.push(fact);
    groups.set(key, list);
  }

  const current = [];
  const superseded = [];
  for (const list of groups.values()) {
    list.sort(sortVersions);
    const winner = list.at(-1);
    current.push(winner);
    for (const fact of list.slice(0, -1)) {
      superseded.push({
        ...fact,
        supersededBy: winner?.accn ?? null,
        supersededByFiled: winner?.filed ?? null,
      });
    }
  }

  current.sort((a,b) => contextKey(a).localeCompare(contextKey(b)));
  superseded.sort((a,b) => contextKey(a).localeCompare(contextKey(b)) || sortVersions(a,b));
  return { current, superseded };
}

function classifyDuration(fact) {
  const days = daySpan(fact.start, fact.end);
  if (days == null) return "unknown";
  const form = String(fact.form ?? "").replace(/\/A$/, "");

  if (["10-K","20-F","40-F"].includes(form)) return "annual";
  if (["10-Q","6-K"].includes(form)) {
    if (days >= 60 && days <= 120) return "quarter";
    if (days > 120 && days <= 300) return "year_to_date";
    return "other_duration";
  }

  if (days >= 330 && days <= 410) return "annual";
  if (days >= 60 && days <= 120) return "quarter";
  if (days > 120 && days <= 300) return "year_to_date";
  return "other_duration";
}

export function extractMetricFacts(companyFacts, metricName, asOf) {
  const spec = FUNDAMENTAL_METRICS[metricName];
  if (!spec) throw new Error("Unknown fundamental metric: " + metricName);
  const all = extractAllStandardFacts(companyFacts, asOf);
  const conceptKeys = new Set(spec.concepts.map(([taxonomy, tag]) => taxonomy + ":" + tag));
  return all.filter((fact) =>
    conceptKeys.has(fact.taxonomy + ":" + fact.tag) &&
    NORMALIZED_FORMS.has(String(fact.form ?? ""))
  );
}

function resolvePeriodBucket(facts) {
  if (!facts.length) return { status: "missing", selected: null, facts: [] };

  const distinctValues = new Map();
  for (const fact of facts) {
    const key = typeof fact.val + ":" + String(fact.val);
    const list = distinctValues.get(key) ?? [];
    list.push(fact);
    distinctValues.set(key, list);
  }

  if (distinctValues.size !== 1) {
    return { status: "ambiguous_concepts", selected: null, facts };
  }
  const same = [...distinctValues.values()].flat().sort(sortVersions);
  return { status: "resolved", selected: same.at(-1), facts };
}

function latestResolvedPeriod(currentFacts, kind) {
  const eligible = currentFacts.filter((fact) => {
    if (kind === "instant") return !fact.start && Boolean(fact.end);
    return classifyDuration(fact) === kind;
  });
  if (!eligible.length) return { status: "missing", selected: null, facts: [] };

  const latestEnd = eligible.map((fact) => fact.end).filter(Boolean).sort().at(-1);
  const latest = eligible.filter((fact) => fact.end === latestEnd);
  const byPeriod = new Map();
  for (const fact of latest) {
    const key = periodKey(fact);
    const list = byPeriod.get(key) ?? [];
    list.push(fact);
    byPeriod.set(key, list);
  }
  if (byPeriod.size !== 1) return { status: "ambiguous_periods", selected: null, facts: latest };
  return resolvePeriodBucket([...byPeriod.values()][0]);
}

function freshness(currentFacts, asOf) {
  const ends = currentFacts.map((fact) => fact.end).filter(Boolean).sort();
  const filed = currentFacts.map((fact) => fact.filed).filter(Boolean).sort();
  const latestPeriodEnd = ends.at(-1) ?? null;
  const latestFiledDate = filed.at(-1) ?? null;
  return {
    latestPeriodEnd,
    periodEndAgeDays: calendarDayAge(asOf, latestPeriodEnd),
    latestFiledDate,
    filedAgeDays: calendarDayAge(asOf, latestFiledDate),
  };
}

export function normalizeMetric(companyFacts, metricName, asOf) {
  const spec = FUNDAMENTAL_METRICS[metricName];
  const eligible = extractMetricFacts(companyFacts, metricName, asOf);
  const { current, superseded } = latestContextVersions(eligible);

  const buckets = new Map();
  for (const fact of current) {
    const key = periodKey(fact);
    const list = buckets.get(key) ?? [];
    list.push(fact);
    buckets.set(key, list);
  }

  const periods = [...buckets.entries()].map(([key, facts]) => ({
    key,
    kind: spec.periodType === "instant" ? "instant" : classifyDuration(facts[0]),
    start: facts[0]?.start ?? null,
    end: facts[0]?.end ?? null,
    unit: facts[0]?.unit ?? null,
    ...resolvePeriodBucket(facts),
  })).sort((a,b) => String(a.end ?? "").localeCompare(String(b.end ?? "")));

  const latest = spec.periodType === "instant"
    ? { instant: latestResolvedPeriod(current, "instant") }
    : {
        annual: latestResolvedPeriod(current, "annual"),
        quarter: latestResolvedPeriod(current, "quarter"),
        yearToDate: latestResolvedPeriod(current, "year_to_date"),
      };

  return {
    metric: metricName,
    learningAuthority: false,
    periodType: spec.periodType,
    status: eligible.length ? "observed" : "missing",
    allEligibleFacts: eligible,
    currentFacts: current,
    supersededFacts: superseded,
    periods,
    latest,
    freshness: freshness(current, asOf),
    factsHash: truthHash(eligible),
  };
}

function selectedPeriods(metric) {
  return new Map((metric?.periods ?? [])
    .filter((period) => period.status === "resolved" && period.selected)
    .map((period) => [period.key, period.selected]));
}

function deriveBinary(name, leftMetric, rightMetric, op) {
  const left = selectedPeriods(leftMetric);
  const right = selectedPeriods(rightMetric);
  const observations = [];

  for (const [key, a] of left) {
    const b = right.get(key);
    if (!b || a.unit !== b.unit || !a.accn || a.accn !== b.accn) continue;
    const av = Number(a.val);
    const bv = Number(b.val);
    if (!Number.isFinite(av) || !Number.isFinite(bv)) continue;
    const value = op(av, bv);
    if (!Number.isFinite(value)) continue;
    observations.push({
      key,
      start: a.start ?? null,
      end: a.end ?? null,
      unit: name.includes("margin") ? "ratio" : a.unit,
      value,
      inputs: [
        { metric:leftMetric.metric, taxonomy:a.taxonomy, tag:a.tag, accn:a.accn, filed:a.filed, unit:a.unit, val:a.val },
        { metric:rightMetric.metric, taxonomy:b.taxonomy, tag:b.tag, accn:b.accn, filed:b.filed, unit:b.unit, val:b.val },
      ],
    });
  }

  return {
    metric:name,
    derived:true,
    learningAuthority:false,
    observations,
    observationsHash:truthHash(observations),
  };
}

export function buildFundamentalsTruth(companyFacts, options = {}) {
  const { ticker, cik, asOf, retrievedAt = new Date().toISOString(), sourceUrl = null } = options;
  if (!ticker) throw new Error("ticker is required");
  if (!asOf || !Number.isFinite(Date.parse(asOf))) throw new Error("valid asOf is required");

  const rawFacts = extractAllStandardFacts(companyFacts, asOf);
  const { current: currentRawFacts, superseded: supersededRawFacts } = latestContextVersions(rawFacts);

  const metrics = {};
  for (const name of Object.keys(FUNDAMENTAL_METRICS)) {
    metrics[name] = normalizeMetric(companyFacts, name, asOf);
  }

  const derived = {
    free_cash_flow: deriveBinary("free_cash_flow", metrics.operating_cash_flow, metrics.capital_expenditures, (a,b) => a - Math.abs(b)),
    gross_margin: deriveBinary("gross_margin", metrics.gross_profit, metrics.revenue, (a,b) => b === 0 ? NaN : a / b),
    operating_margin: deriveBinary("operating_margin", metrics.operating_income, metrics.revenue, (a,b) => b === 0 ? NaN : a / b),
    net_margin: deriveBinary("net_margin", metrics.net_income, metrics.revenue, (a,b) => b === 0 ? NaN : a / b),
  };

  const companyCik = cik ?? (companyFacts?.cik != null ? String(companyFacts.cik).padStart(10,"0") : null);
  const sourcePayloadHash = truthHash(companyFacts);
  const rawFactsHash = truthHash(rawFacts);
  const truthCore = {
    ticker,
    cik:companyCik,
    entityName:companyFacts?.entityName ?? null,
    asOf,
    sourceCutoff:asOf,
    sourceUrl,
    sourcePayloadHash,
    sourceTaxonomies:Object.keys(companyFacts?.facts ?? {}).sort(),
    rawTruth:{
      learningAuthority:true,
      factCount:rawFacts.length,
      currentFactCount:currentRawFacts.length,
      supersededFactCount:supersededRawFacts.length,
      factsHash:rawFactsHash,
      facts:rawFacts,
      currentFacts:currentRawFacts,
      supersededFacts:supersededRawFacts,
    },
    normalizedProjection:{
      learningAuthority:false,
      metrics,
      derived,
    },
  };

  const ambiguous = Object.values(metrics)
    .flatMap((metric) => metric.periods ?? [])
    .filter((period) => String(period.status).startsWith("ambiguous")).length;

  return {
    version:1,
    contract:"earth2036-fundamentals-truth-v1",
    canonicalWriteAuthority:false,
    learningSource:"observed-source-facts",
    primaryLearningAuthority:"rawTruth.facts",
    earthContextIncluded:false,
    retrievedAt,
    ...truthCore,
    audit:{
      rawFactCount:rawFacts.length,
      rawCurrentFactCount:currentRawFacts.length,
      rawSupersededFactCount:supersededRawFacts.length,
      taxonomyCount:Object.keys(companyFacts?.facts ?? {}).length,
      normalizedMetricCount:Object.keys(metrics).length,
      normalizedObservedMetricCount:Object.values(metrics).filter((m)=>m.status==="observed").length,
      normalizedMissingMetricCount:Object.values(metrics).filter((m)=>m.status==="missing").length,
      normalizedAmbiguousPeriodCount:ambiguous,
      derivedObservationCount:Object.values(derived).reduce((sum,m)=>sum+m.observations.length,0),
    },
    truthHash:truthHash(truthCore),
  };
}

export function validateFundamentalsTruth(record) {
  const errors=[];
  if (record?.canonicalWriteAuthority !== false) errors.push("fundamentals truth must not have canonical write authority");
  if (record?.earthContextIncluded !== false) errors.push("Earth context must not be included in fundamentals truth");
  if (record?.primaryLearningAuthority !== "rawTruth.facts") errors.push("raw truth must be the primary learning authority");
  if (record?.rawTruth?.learningAuthority !== true) errors.push("raw truth learning authority missing");
  if (record?.normalizedProjection?.learningAuthority !== false) errors.push("normalized projection must not be primary learning authority");
  if (!record?.ticker) errors.push("ticker missing");
  if (!record?.asOf || !Number.isFinite(Date.parse(record.asOf))) errors.push("invalid asOf");
  if (record?.sourceCutoff !== record?.asOf) errors.push("source cutoff must equal asOf");

  const asOfMs=Date.parse(record?.asOf ?? "");
  for (const fact of record?.rawTruth?.facts ?? []) {
    for (const field of ["taxonomy","tag","unit","filed","accn","form"]) {
      if (fact?.[field] == null || fact?.[field] === "") errors.push("raw source fact missing " + field);
    }
    const filedMs=filedAvailabilityMs(fact?.filed);
    if (!Number.isFinite(filedMs) || filedMs > asOfMs) errors.push("raw truth contains future-filed fact");
  }

  if (record?.rawTruth?.factCount !== (record?.rawTruth?.facts ?? []).length) errors.push("raw fact count mismatch");
  if (record?.rawTruth?.factsHash !== truthHash(record?.rawTruth?.facts ?? [])) errors.push("raw facts hash mismatch");
  if (record?.sourcePayloadHash == null) errors.push("source payload hash missing");

  const truthCore={
    ticker:record?.ticker,
    cik:record?.cik,
    entityName:record?.entityName,
    asOf:record?.asOf,
    sourceCutoff:record?.sourceCutoff,
    sourceUrl:record?.sourceUrl,
    sourcePayloadHash:record?.sourcePayloadHash,
    sourceTaxonomies:record?.sourceTaxonomies,
    rawTruth:record?.rawTruth,
    normalizedProjection:record?.normalizedProjection,
  };
  if (!record?.truthHash || record.truthHash !== truthHash(truthCore)) errors.push("fundamentals truth hash mismatch");
  return errors;
}
