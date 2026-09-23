import { truthHash, buildFundamentalsTruth, validateFundamentalsTruth } from "./sec-fundamentals-truth.mjs";

export const FUNDAMENTALS_BRIDGE_CONTRACT = "earth2036-fundamentals-trajectory-bridge-v1";
export const FUNDAMENTALS_BRIDGE_VERSION = "1.0.0";
const HASH = /^[a-f0-9]{64}$/;
const REFERENCE_FIELDS = [
  "status", "learningEligible", "reason", "ticker", "cik", "asOf",
  "truthHash", "rawFactsHash", "sourcePayloadHash", "rawFactCount",
  "sourceTaxonomies", "projectionHash", "recordHash", "rawCurrentCount",
  "rawSupersededCount", "reconstructionContract",
];

export function normalizeBridgeCik(value) {
  if (value == null || value === "") return null;
  const digits = String(value);
  return /^\d{1,10}$/.test(digits) ? digits.padStart(10, "0") : null;
}

function descriptor(core) {
  return { ...core, descriptorHash: truthHash(core) };
}

function emptyReference({ ticker, observation, asOf, status, reasons }) {
  return descriptor({
    status, learningEligible: false, reason: [...new Set(reasons)].sort(),
    ticker: ticker ?? null, cik: normalizeBridgeCik(observation?.cik),
    asOf: asOf ?? null, truthHash: null, rawFactsHash: null,
    sourcePayloadHash: null, rawFactCount: null, sourceTaxonomies: [],
    projectionHash: null, recordHash: null, rawCurrentCount: null,
    rawSupersededCount: null, reconstructionContract: null,
  });
}

export function unknownFundamentalsBridge({ ticker, observation = null, asOf, reason = "company_facts_unavailable" }) {
  return emptyReference({ ticker, observation, asOf, status: "unknown", reasons: [reason] });
}

export function invalidFundamentalsBridge({ ticker, observation = null, asOf, reasons = ["bridge_index_invalid"] }) {
  return emptyReference({ ticker, observation, asOf, status: "invalid", reasons });
}

/** Validate the entire immutable #10 record BEFORE returning even one trusted reference. */
export function bridgeFundamentalsTruth({ ticker, asOf, observation = null, fundamentalsTruth = null }) {
  if (!fundamentalsTruth) return unknownFundamentalsBridge({ ticker, observation, asOf });
  const errors = [];
  const trajectoryCik = normalizeBridgeCik(observation?.cik);
  const sourceCik = normalizeBridgeCik(fundamentalsTruth?.cik);
  if (!ticker || ticker !== fundamentalsTruth?.ticker) errors.push("ticker_mismatch");
  if (!trajectoryCik || !sourceCik || trajectoryCik !== sourceCik) errors.push("cik_mismatch");
  if (!Number.isFinite(Date.parse(asOf ?? "")) || fundamentalsTruth?.asOf !== asOf) errors.push("asof_mismatch");
  if (!Number.isFinite(Date.parse(fundamentalsTruth?.sourceCutoff ?? "")) ||
      Date.parse(fundamentalsTruth.sourceCutoff) > Date.parse(asOf ?? "")) errors.push("future_source_cutoff");
  const integrity = validateFundamentalsTruth(fundamentalsTruth);
  if (integrity.length) errors.push(...integrity.map((error) => "fundamentals:" + error));
  if (fundamentalsTruth?.rawTruth?.factCount === 0 && errors.length === 0) {
    return unknownFundamentalsBridge({ ticker, observation, asOf, reason: "no_eligible_raw_facts" });
  }
  if (errors.length) return emptyReference({ ticker, observation, asOf, status: "invalid", reasons: errors });

  const reconstructionContract = {
    source: "SEC_COMPANY_FACTS",
    cik: sourceCik,
    cutoff: asOf,
    builderContract: "earth2036-fundamentals-truth-v1",
    expectedTruthHash: fundamentalsTruth.truthHash,
    expectedRawFactsHash: fundamentalsTruth.rawTruth.factsHash,
    expectedSourcePayloadHash: fundamentalsTruth.sourcePayloadHash,
    expectedProjectionHash: fundamentalsTruth.projectionHash,
  };
  return descriptor({
    status: "valid", learningEligible: true, reason: [],
    ticker, cik: sourceCik, asOf,
    truthHash: fundamentalsTruth.truthHash,
    rawFactsHash: fundamentalsTruth.rawTruth.factsHash,
    sourcePayloadHash: fundamentalsTruth.sourcePayloadHash,
    rawFactCount: fundamentalsTruth.rawTruth.factCount,
    sourceTaxonomies: [...fundamentalsTruth.sourceTaxonomies],
    projectionHash: fundamentalsTruth.projectionHash,
    recordHash: fundamentalsTruth.recordHash,
    rawCurrentCount: fundamentalsTruth.rawTruth.currentFacts.length,
    rawSupersededCount: fundamentalsTruth.rawTruth.supersededFacts.length,
    reconstructionContract,
  });
}

/** Validate a compact reference independently of any producer or sidecar index. */
export function validateFundamentalsBridgeDescriptor(value, { ticker = null, cik = null, asOf = null } = {}) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["descriptor_missing"];
  const actual = Object.keys(value);
  const unexpected = actual.filter((key) => ![...REFERENCE_FIELDS, "descriptorHash"].includes(key));
  if (unexpected.length) errors.push("unexpected_descriptor_fields:" + unexpected.join(","));
  if (value.ticker !== (ticker ?? value.ticker) || !value.ticker) errors.push("descriptor_ticker_mismatch");
  if (!value.asOf || !Number.isFinite(Date.parse(value.asOf)) || (asOf != null && value.asOf !== asOf)) errors.push("descriptor_asof_mismatch");
  if (cik != null && normalizeBridgeCik(value.cik) !== normalizeBridgeCik(cik)) errors.push("descriptor_cik_mismatch");
  if (!["valid", "invalid", "unknown"].includes(value.status)) errors.push("invalid_descriptor_status");
  if (!Array.isArray(value.reason) || value.reason.some((r) => typeof r !== "string")) errors.push("invalid_reason");
  if (!Array.isArray(value.sourceTaxonomies) || value.sourceTaxonomies.some((t) => typeof t !== "string")) errors.push("invalid_taxonomies");
  const { descriptorHash, ...core } = value;
  if (!HASH.test(descriptorHash ?? "") || descriptorHash !== truthHash(core)) errors.push("descriptor_hash_mismatch");

  if (value.status !== "valid") {
    if (value.learningEligible !== false) errors.push("nonvalid_reference_became_learning_eligible");
    for (const name of ["truthHash", "rawFactsHash", "sourcePayloadHash", "projectionHash", "recordHash", "reconstructionContract"]) {
      if (value[name] != null) errors.push("nonvalid_reference_has_" + name);
    }
  } else {
    if (value.learningEligible !== true) errors.push("valid_reference_not_learning_eligible");
    for (const name of ["truthHash", "rawFactsHash", "sourcePayloadHash", "projectionHash", "recordHash"]) {
      if (!HASH.test(value[name] ?? "")) errors.push("invalid_" + name);
    }
    if (!Number.isSafeInteger(value.rawFactCount) || value.rawFactCount < 1) errors.push("invalid_raw_fact_count");
    if (!Number.isSafeInteger(value.rawCurrentCount) || !Number.isSafeInteger(value.rawSupersededCount) ||
        value.rawCurrentCount + value.rawSupersededCount !== value.rawFactCount) errors.push("invalid_context_counts");
    const r = value.reconstructionContract;
    if (r?.source !== "SEC_COMPANY_FACTS" || r?.builderContract !== "earth2036-fundamentals-truth-v1" ||
        r?.cik !== value.cik || r?.cutoff !== value.asOf ||
        r?.expectedTruthHash !== value.truthHash || r?.expectedRawFactsHash !== value.rawFactsHash ||
        r?.expectedSourcePayloadHash !== value.sourcePayloadHash || r?.expectedProjectionHash !== value.projectionHash) {
      errors.push("invalid_reconstruction_contract");
    }
    if (JSON.stringify(value.sourceTaxonomies) !== JSON.stringify([...new Set(value.sourceTaxonomies)].sort())) {
      errors.push("nondeterministic_taxonomy_set");
    }
  }
  return errors;
}

/** Metadata only: never copy normalized metric values or raw facts into tick JSON. */
export function fundamentalsAuditProjection(fundamentalsTruth, reference) {
  if (reference?.status !== "valid") return {
    learningEligible: false, status: reference?.status ?? "unknown",
    reason: reference?.reason ?? ["company_facts_unavailable"], projectionHash: null,
  };
  return {
    learningEligible: false, status: "audit-only",
    projectionHash: reference.projectionHash,
    observedNamedMetrics: fundamentalsTruth?.audit?.normalizedObservedMetricCount ?? null,
    missingNamedMetrics: fundamentalsTruth?.audit?.normalizedMissingMetricCount ?? null,
    ambiguousPeriods: fundamentalsTruth?.audit?.normalizedAmbiguousPeriodCount ?? null,
  };
}

/** PIT raw identity is authoritative; detect later convenience-map drift separately. */
export function reconstructFundamentalsBridge(reference, companyFacts) {
  const descriptorErrors = validateFundamentalsBridgeDescriptor(reference);
  if (descriptorErrors.length || reference.status !== "valid" || !companyFacts) {
    return { status: "historical_truth_unrecoverable", reason: descriptorErrors.length ? descriptorErrors : ["missing_source_or_reference"] };
  }
  const payloadCik = normalizeBridgeCik(companyFacts?.cik);
  if (!payloadCik || payloadCik !== reference.cik) {
    return { status: "historical_truth_unrecoverable", reason: ["cik_mismatch"] };
  }
  try {
    const rebuilt = buildFundamentalsTruth(companyFacts, {
      ticker: reference.ticker, cik: reference.cik, asOf: reference.asOf,
      retrievedAt: new Date(0).toISOString(), sourceUrl: null,
    });
    const errors = validateFundamentalsTruth(rebuilt);
    for (const [name, expected, actual] of [
      ["truth_hash_drift", reference.truthHash, rebuilt.truthHash],
      ["raw_hash_drift", reference.rawFactsHash, rebuilt.rawTruth.factsHash],
      ["source_hash_drift", reference.sourcePayloadHash, rebuilt.sourcePayloadHash],
    ]) if (expected !== actual) errors.push(name);
    const projectionStatus = reference.projectionHash === rebuilt.projectionHash ? "exact" : "drift";
    return errors.length
      ? { status: "historical_truth_unrecoverable", reason: errors, projectionStatus }
      : {
          status: "reconstructed", reason: [], rawFactCount: rebuilt.rawTruth.factCount,
          truthHash: rebuilt.truthHash, projectionStatus,
          historicalProjectionHash: reference.projectionHash,
          rebuiltProjectionHash: rebuilt.projectionHash,
        };
  } catch (error) {
    return { status: "historical_truth_unrecoverable", reason: [String(error?.message ?? error)] };
  }
}

export function fundamentalsBridgeHealth(refs) {
  const rows = Array.isArray(refs) ? refs : Object.values(refs ?? {});
  const values = rows.map((r) => r?.truthState?.fundamentals ?? r);
  return {
    companies: values.length,
    valid: values.filter((r) => r?.status === "valid").length,
    unknown: values.filter((r) => r?.status === "unknown").length,
    invalid: values.filter((r) => r?.status === "invalid").length,
    rawFactsReferenced: values.reduce((n, r) => n + (r?.status === "valid" ? r.rawFactCount : 0), 0),
    uniqueFactStates: new Set(values.filter((r) => r?.status === "valid").map((r) => r.rawFactsHash)).size,
    cikMismatches: values.filter((r) => r?.reason?.some((v) =>
      String(v).toLowerCase().replace(/[\s-]+/g, "_").includes("cik_mismatch"))).length,
    hashFailures: values.filter((r) => r?.reason?.some((v) =>
      String(v).toLowerCase().replace(/[\s-]+/g, "_").includes("hash_mismatch"))).length,
    projectionAuthority: 0, canonicalWrites: 0,
  };
}
