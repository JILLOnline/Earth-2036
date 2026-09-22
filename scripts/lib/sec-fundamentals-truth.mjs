import { createHash } from "node:crypto";
import { FUNDAMENTAL_METRICS } from "./fundamental-metric-map.mjs";

const ALLOWED_FORMS = new Set([
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

function isoDayMs(value) {
  if (!value) return null;
  const source = String(value);
  const ms = Date.parse(source.length === 10 ? source + "T23:59:59.999Z" : source);
  return Number.isFinite(ms) ? ms : null;
}

function daySpan(start, end) {
  const a = isoDayMs(start);
  const b = isoDayMs(end);
  return a == null || b == null ? null : Math.round((b - a) / 86400000);
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
    fact.taxonomy, fact.tag, fact.unit, fact.val, fact.start, fact.end,
    fact.filed, fact.accn, fact.form, fact.fy, fact.fp, fact.frame
  ].join("|");
}

function contextKey(fact) {
  return [fact.taxonomy, fact.tag, fact.unit, fact.start, fact.end, fact.fy, fact.fp].join("|");
}

function periodKey(fact) {
  return [fact.unit, fact.start ?? "", fact.end ?? ""].join("|");
}

function sortFactVersions(a, b) {
  return String(a.filed ?? "").localeCompare(String(b.filed ?? "")) ||
    String(a.accn ?? "").localeCompare(String(b.accn ?? ""));
}

function sourceEligible(fact, asOfMs) {
  const filedMs = isoDayMs(fact?.filed);
  return filedMs != null && filedMs <= asOfMs && ALLOWED_FORMS.has(String(fact?.form ?? ""));
}

export function extractMetricFacts(companyFacts, metricName, asOf) {
  const spec = FUNDAMENTAL_METRICS[metricName];
  if (!spec) throw new Error("Unknown fundamental metric: " + metricName);
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs)) throw new Error("Invalid fundamentals asOf: " + asOf);

  const facts = [];
  const seen = new Set();

  for (const [taxonomy, tag] of spec.concepts) {
    const concept = companyFacts?.facts?.[taxonomy]?.[tag];
    if (!concept?.units || typeof concept.units !== "object") continue;

    for (const [unit, values] of Object.entries(concept.units)) {
      for (const raw of Array.isArray(values) ? values : []) {
        const fact = compactFact({
          taxonomy,
          tag,
          label: concept.label,
          description: concept.description,
          unit,
          fact: raw
        });
        if (!sourceEligible(fact, asOfMs)) continue;
        const key = exactFactKey(fact);
        if (seen.has(key)) continue;
        seen.add(key);
        facts.push(fact);
      }
    }
  }

  facts.sort((a, b) =>
    String(a.end ?? "").localeCompare(String(b.end ?? "")) ||
    String(a.start ?? "").localeCompare(String(b.start ?? "")) ||
    sortFactVersions(a, b)
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
    list.sort(sortFactVersions);
    current.push(list.at(-1));
    superseded.push(...list.slice(0, -1).map((fact) => ({
      ...fact,
      supersededBy: list.at(-1)?.accn ?? null,
      supersededByFiled: list.at(-1)?.filed ?? null,
    })));
  }
  return { current, superseded };
}

function classifyDuration(fact) {
  const days = daySpan(fact.start, fact.end);
  if (days == null) return "unknown";
  if (days >= 270 && days <= 410) return "annual";
  if (days >= 60 && days <= 120) return "quarter";
  if (days >= 121 && days <= 300) return "year_to_date";
  return "other_duration";
}

function resolvePeriodBucket(facts) {
  if (!facts.length) return { status: "missing", selected: null, facts: [] };

  const distinct = new Map();
  for (const fact of facts) {
    const valueKey = typeof fact.val + ":" + String(fact.val);
    const list = distinct.get(valueKey) ?? [];
    list.push(fact);
    distinct.set(valueKey, list);
  }

  if (distinct.size !== 1) {
    return { status: "ambiguous_concepts", selected: null, facts };
  }

  const sameValue = [...distinct.values()].flat();
  sameValue.sort(sortFactVersions);
  return { status: "resolved", selected: sameValue.at(-1), facts };
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

  if (byPeriod.size !== 1) {
    return { status: "ambiguous_periods", selected: null, facts: latest };
  }
  return resolvePeriodBucket([...byPeriod.values()][0]);
}

export function normalizeMetric(companyFacts, metricName, asOf) {
  const spec = FUNDAMENTAL_METRICS[metricName];
  const allEligibleFacts = extractMetricFacts(companyFacts, metricName, asOf);
  const { current, superseded } = latestContextVersions(allEligibleFacts);

  const periodBuckets = new Map();
  for (const fact of current) {
    const key = periodKey(fact);
    const list = periodBuckets.get(key) ?? [];
    list.push(fact);
    periodBuckets.set(key, list);
  }

  const periods = [...periodBuckets.entries()].map(([key, facts]) => {
    const resolved = resolvePeriodBucket(facts);
    return {
      key,
      kind: spec.periodType === "instant" ? "instant" : classifyDuration(facts[0]),
      start: facts[0]?.start ?? null,
      end: facts[0]?.end ?? null,
      unit: facts[0]?.unit ?? null,
      ...resolved,
    };
  }).sort((a, b) => String(a.end ?? "").localeCompare(String(b.end ?? "")));

  const latest = spec.periodType === "instant"
    ? { instant: latestResolvedPeriod(current, "instant") }
    : {
        annual: latestResolvedPeriod(current, "annual"),
        quarter: latestResolvedPeriod(current, "quarter"),
        yearToDate: latestResolvedPeriod(current, "year_to_date"),
      };

  return {
    metric: metricName,
    periodType: spec.periodType,
    status: allEligibleFacts.length ? "observed" : "missing",
    allEligibleFacts,
    currentFacts: current,
    supersededFacts: superseded,
    periods,
    latest,
    factsHash: truthHash(allEligibleFacts),
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
    if (!b || a.unit !== b.unit) continue;
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
        { metric: leftMetric.metric, taxonomy: a.taxonomy, tag: a.tag, accn: a.accn, filed: a.filed, unit: a.unit, val: a.val },
        { metric: rightMetric.metric, taxonomy: b.taxonomy, tag: b.tag, accn: b.accn, filed: b.filed, unit: b.unit, val: b.val }
      ]
    });
  }

  return { metric: name, derived: true, observations, observationsHash: truthHash(observations) };
}

function resolvedInstantPeriods(metric) {
  return (metric?.periods ?? [])
    .filter((period) => period.kind === "instant" && period.status === "resolved" && period.selected);
}

function deriveTotalDebt(currentDebt, noncurrentDebt) {
  const byEnd = new Map();

  for (const period of resolvedInstantPeriods(currentDebt)) {
    const key = String(period.end) + "|" + String(period.unit);
    byEnd.set(key, { current: period.selected, noncurrent: null });
  }

  for (const period of resolvedInstantPeriods(noncurrentDebt)) {
    const key = String(period.end) + "|" + String(period.unit);
    const row = byEnd.get(key) ?? { current: null, noncurrent: null };
    row.noncurrent = period.selected;
    byEnd.set(key, row);
  }

  const observations = [];
  for (const [key, row] of byEnd) {
    if (!row.current || !row.noncurrent || row.current.unit !== row.noncurrent.unit) continue;
    const a = Number(row.current.val);
    const b = Number(row.noncurrent.val);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;

    observations.push({
      key,
      end: row.current.end,
      unit: row.current.unit,
      value: a + b,
      inputs: [
        { metric: "debt_current", taxonomy: row.current.taxonomy, tag: row.current.tag, accn: row.current.accn, filed: row.current.filed, unit: row.current.unit, val: row.current.val },
        { metric: "debt_noncurrent", taxonomy: row.noncurrent.taxonomy, tag: row.noncurrent.tag, accn: row.noncurrent.accn, filed: row.noncurrent.filed, unit: row.noncurrent.unit, val: row.noncurrent.val }
      ]
    });
  }

  return { metric: "total_debt", derived: true, observations, observationsHash: truthHash(observations) };
}

export function buildFundamentalsTruth(companyFacts, options = {}) {
  const { ticker, cik, asOf, retrievedAt = new Date().toISOString(), sourceUrl = null } = options;
  if (!ticker) throw new Error("ticker is required");
  if (!asOf || !Number.isFinite(Date.parse(asOf))) throw new Error("valid asOf is required");

  const metrics = {};
  for (const name of Object.keys(FUNDAMENTAL_METRICS)) {
    metrics[name] = normalizeMetric(companyFacts, name, asOf);
  }

  const derived = {
    free_cash_flow: deriveBinary("free_cash_flow", metrics.operating_cash_flow, metrics.capital_expenditures, (a, b) => a - Math.abs(b)),
    gross_margin: deriveBinary("gross_margin", metrics.gross_profit, metrics.revenue, (a, b) => b === 0 ? NaN : a / b),
    operating_margin: deriveBinary("operating_margin", metrics.operating_income, metrics.revenue, (a, b) => b === 0 ? NaN : a / b),
    net_margin: deriveBinary("net_margin", metrics.net_income, metrics.revenue, (a, b) => b === 0 ? NaN : a / b),
    total_debt: deriveTotalDebt(metrics.debt_current, metrics.debt_noncurrent),
  };

  const companyCik = cik ?? (companyFacts?.cik != null ? String(companyFacts.cik).padStart(10, "0") : null);
  const truthCore = {
    ticker,
    cik: companyCik,
    entityName: companyFacts?.entityName ?? null,
    asOf,
    sourceCutoff: asOf,
    sourceUrl,
    sourceTaxonomies: Object.keys(companyFacts?.facts ?? {}).sort(),
    metrics,
    derived,
  };

  const ambiguityCount = Object.values(metrics)
    .flatMap((metric) => metric.periods ?? [])
    .filter((period) => String(period.status).startsWith("ambiguous")).length;

  return {
    version: 1,
    contract: "earth2036-fundamentals-truth-v1",
    canonicalWriteAuthority: false,
    learningSource: "observed-source-facts",
    earthContextIncluded: false,
    retrievedAt,
    ...truthCore,
    audit: {
      metricCount: Object.keys(metrics).length,
      observedMetricCount: Object.values(metrics).filter((metric) => metric.status === "observed").length,
      missingMetricCount: Object.values(metrics).filter((metric) => metric.status === "missing").length,
      ambiguousPeriodCount: ambiguityCount,
      sourceFactCount: Object.values(metrics).reduce((sum, metric) => sum + metric.allEligibleFacts.length, 0),
      derivedObservationCount: Object.values(derived).reduce((sum, metric) => sum + metric.observations.length, 0),
    },
    truthHash: truthHash(truthCore),
  };
}

export function validateFundamentalsTruth(record) {
  const errors = [];
  if (record?.canonicalWriteAuthority !== false) errors.push("fundamentals truth must not have canonical write authority");
  if (record?.earthContextIncluded !== false) errors.push("Earth context must not be included in fundamentals truth");
  if (!record?.ticker) errors.push("ticker missing");
  if (!record?.asOf || !Number.isFinite(Date.parse(record.asOf))) errors.push("invalid asOf");
  if (record?.sourceCutoff !== record?.asOf) errors.push("source cutoff must equal asOf");

  const asOfMs = Date.parse(record?.asOf ?? "");
  for (const metric of Object.values(record?.metrics ?? {})) {
    for (const fact of metric?.allEligibleFacts ?? []) {
      for (const field of ["taxonomy", "tag", "unit", "filed", "accn", "form"]) {
        if (fact?.[field] == null || fact?.[field] === "") {
          errors.push(metric.metric + " source fact missing " + field);
        }
      }
      const filedMs = isoDayMs(fact?.filed);
      if (!Number.isFinite(filedMs) || filedMs > asOfMs) {
        errors.push(metric.metric + " contains future-filed fact");
      }
    }
  }

  const truthCore = {
    ticker: record?.ticker,
    cik: record?.cik,
    entityName: record?.entityName,
    asOf: record?.asOf,
    sourceCutoff: record?.sourceCutoff,
    sourceUrl: record?.sourceUrl,
    sourceTaxonomies: record?.sourceTaxonomies,
    metrics: record?.metrics,
    derived: record?.derived,
  };

  if (!record?.truthHash || record.truthHash !== truthHash(truthCore)) {
    errors.push("fundamentals truth hash mismatch");
  }
  return errors;
}
