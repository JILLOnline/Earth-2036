import { createHash } from 'node:crypto';

export const EARTH_CONTROL_FLOOR = 0.51;
export const EXTERNAL_PROVIDER_CAP = 0.49;

export const AUTHORITY_WEIGHT = Object.freeze({
  primary: 1,
  'official-secondary': 0.9,
  'independent-secondary': 0.78,
  vendor: 0.68,
  social: 0.45,
  unknown: 0.35,
});

export const CONTROL_DOMAIN = Object.freeze({
  EARTH: 'earth',
  PUBLIC_PRIMARY: 'public_primary',
  EXTERNAL_VENDOR: 'external_vendor',
});

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const hash = (value) => createHash('sha256').update(String(value)).digest('hex');

function normalizeProviderId(value) {
  return String(value || 'unknown').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
}

function canonicalEventKey(record) {
  const parts = [
    record.ticker,
    record.category,
    record.eventType,
    record.eventDate,
    record.originId,
    record.primarySourceUrl,
  ].map((value) => String(value || '').trim().toLowerCase());
  return parts.join('|');
}

export function normalizeEvidence(record, now = new Date()) {
  const observedAt = record.observedAt || record.discoveredAt || record.eventDate || now.toISOString();
  const observedMs = Date.parse(observedAt);
  const maxAgeHours = Math.max(1, num(record.maxAgeHours, 24 * 30));
  const ageHours = Number.isFinite(observedMs) ? Math.max(0, (now.getTime() - observedMs) / 3_600_000) : Infinity;
  const freshness = Number.isFinite(ageHours) ? clamp01(1 - ageHours / maxAgeHours) : 0;
  const authority = AUTHORITY_WEIGHT[record.authority] ? record.authority : 'unknown';
  const providerId = normalizeProviderId(record.providerId || record.sourceId || 'unknown');
  const controlDomain = Object.values(CONTROL_DOMAIN).includes(record.controlDomain)
    ? record.controlDomain
    : authority === 'primary'
      ? CONTROL_DOMAIN.PUBLIC_PRIMARY
      : CONTROL_DOMAIN.EXTERNAL_VENDOR;
  const eventFingerprint = record.eventFingerprint || hash(record.originId || canonicalEventKey(record));
  const originFingerprint = record.originFingerprint || hash(record.originId || record.primarySourceUrl || eventFingerprint);
  const magnitude = clamp01(num(record.magnitude, 0.5));
  const confidence = clamp01(num(record.confidence, 0.5));
  const reliability = clamp01(num(record.reliability, AUTHORITY_WEIGHT[authority]));
  const direction = Math.max(-1, Math.min(1, num(record.direction, 0)));
  const weight = AUTHORITY_WEIGHT[authority] * reliability * confidence * Math.max(0.15, magnitude) * freshness;

  return {
    ...record,
    providerId,
    authority,
    controlDomain,
    observedAt,
    maxAgeHours,
    ageHours,
    freshness,
    eventFingerprint,
    originFingerprint,
    magnitude,
    confidence,
    reliability,
    direction,
    weight,
    stale: freshness <= 0,
  };
}

export function dedupeEvidence(records, now = new Date()) {
  const normalized = records.map((record) => normalizeEvidence(record, now));
  const byOrigin = new Map();
  for (const record of normalized) {
    const current = byOrigin.get(record.originFingerprint);
    if (!current || record.weight > current.weight) byOrigin.set(record.originFingerprint, record);
  }
  return [...byOrigin.values()];
}

export function computeInfluence(records, now = new Date()) {
  const active = dedupeEvidence(records, now).filter((record) => !record.stale && record.weight > 0);
  const total = active.reduce((sum, record) => sum + record.weight, 0);
  const providerWeights = new Map();
  let sovereignWeight = 0;
  let externalWeight = 0;
  let positiveWeight = 0;
  let negativeWeight = 0;

  for (const record of active) {
    if (record.controlDomain === CONTROL_DOMAIN.EXTERNAL_VENDOR) {
      externalWeight += record.weight;
      providerWeights.set(record.providerId, (providerWeights.get(record.providerId) || 0) + record.weight);
    } else {
      sovereignWeight += record.weight;
    }
    if (record.direction > 0) positiveWeight += record.weight * Math.abs(record.direction);
    if (record.direction < 0) negativeWeight += record.weight * Math.abs(record.direction);
  }

  const providerShares = Object.fromEntries([...providerWeights.entries()].map(([providerId, weight]) => [providerId, total ? weight / total : 0]));
  const maxExternalProviderShare = Math.max(0, ...Object.values(providerShares));
  const sovereignShare = total ? sovereignWeight / total : 0;
  const externalShare = total ? externalWeight / total : 0;
  const directionalTotal = positiveWeight + negativeWeight;
  const contradictionRatio = directionalTotal ? Math.min(positiveWeight, negativeWeight) / directionalTotal : 0;

  return {
    active,
    totalWeight: total,
    providerShares,
    maxExternalProviderShare,
    sovereignShare,
    externalShare,
    positiveWeight,
    negativeWeight,
    contradictionRatio,
  };
}

export function assessEvidenceBundle(records, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const minIndependentOrigins = options.minIndependentOrigins ?? 1;
  const maxContradictionRatio = options.maxContradictionRatio ?? 0.34;
  const requireFresh = options.requireFresh ?? true;
  const influence = computeInfluence(records, now);
  const independentOrigins = new Set(influence.active.map((record) => record.originFingerprint)).size;
  const independentFamilies = new Set(influence.active.map((record) => record.sourceFamily || record.category || record.authority)).size;
  const staleCount = records.map((record) => normalizeEvidence(record, now)).filter((record) => record.stale).length;
  const reasons = [];

  if (influence.totalWeight <= 0) reasons.push('no_active_evidence');
  if (independentOrigins < minIndependentOrigins) reasons.push('insufficient_independent_origins');
  if (influence.sovereignShare < EARTH_CONTROL_FLOOR) reasons.push('earth_control_below_51');
  if (influence.maxExternalProviderShare > EXTERNAL_PROVIDER_CAP) reasons.push('single_provider_above_49');
  if (influence.contradictionRatio > maxContradictionRatio) reasons.push('unresolved_material_contradiction');
  if (requireFresh && staleCount === records.length && records.length > 0) reasons.push('all_evidence_stale');

  return {
    passed: reasons.length === 0,
    reasons,
    independentOrigins,
    independentFamilies,
    staleCount,
    ...influence,
  };
}

export function sourceHealthScore(source, now = new Date()) {
  const freshnessHours = Math.max(1, num(source.freshnessSlaHours, 24));
  const lastSuccessMs = Date.parse(source.lastSuccess || 0);
  const ageHours = Number.isFinite(lastSuccessMs) ? Math.max(0, (now.getTime() - lastSuccessMs) / 3_600_000) : Infinity;
  const freshness = Number.isFinite(ageHours) ? clamp01(1 - ageHours / freshnessHours) : 0;
  const coverage = clamp01(source.coverage);
  const historicalReliability = clamp01(source.historicalReliability ?? 0.8);
  const disagreementPenalty = clamp01(source.disagreementRate ?? 0);
  const outagePenalty = source.status === 'failed' ? 1 : source.status === 'degraded' ? 0.35 : 0;
  const score = clamp01(
    coverage * 0.35 +
    freshness * 0.25 +
    historicalReliability * 0.30 +
    (1 - disagreementPenalty) * 0.10 -
    outagePenalty * 0.40,
  );
  return { score, coverage, freshness, historicalReliability, disagreementPenalty, ageHours };
}

export function detectOutlier(record, history = []) {
  const value = num(record.numericValue, NaN);
  const values = history.map((row) => num(row.numericValue, NaN)).filter(Number.isFinite);
  if (!Number.isFinite(value) || values.length < 5) return { outlier: false, z: 0, reason: 'insufficient_history' };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, item) => sum + (item - mean) ** 2, 0) / values.length;
  const stdev = Math.sqrt(variance);
  if (stdev === 0) return { outlier: value !== mean, z: value === mean ? 0 : Infinity, reason: value === mean ? 'stable' : 'zero_variance_jump' };
  const z = (value - mean) / stdev;
  return { outlier: Math.abs(z) >= 4, z, reason: Math.abs(z) >= 4 ? 'four_sigma_jump' : 'within_distribution' };
}

export function applyCorrection(history, correction) {
  return history.map((record) => record.id === correction.supersedesId
    ? { ...record, supersededAt: correction.observedAt, supersededBy: correction.id, active: false }
    : record).concat({ ...correction, active: true });
}

export function assessProviderDependency(records, now = new Date()) {
  const influence = computeInfluence(records, now);
  const rankedProviders = Object.entries(influence.providerShares).sort((a, b) => b[1] - a[1]);
  return {
    sovereignShare: influence.sovereignShare,
    externalShare: influence.externalShare,
    maxExternalProviderShare: influence.maxExternalProviderShare,
    dominantExternalProvider: rankedProviders[0]?.[0] ?? null,
    passed: influence.sovereignShare >= EARTH_CONTROL_FLOOR && influence.maxExternalProviderShare <= EXTERNAL_PROVIDER_CAP,
  };
}
