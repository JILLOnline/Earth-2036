import { createHash } from "node:crypto";

// Audit-plane interpretation of SEC filing review decisions.
// No filing is auto-exempt by form, ticker, perceived importance or age.
const OPEN_STATUSES = new Set(["pending", "open", "unresolved"]);
const ALLOWED_STATUSES = new Set([...OPEN_STATUSES, "resolved"]);
const DISPOSITIONS = new Set(["material_open", "non_gating", "resolved"]);
const HASH64 = /^[a-f0-9]{64}$/;

const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const asTime = (value) => {
  const n = Date.parse(value || "");
  return Number.isFinite(n) ? n : null;
};

export function parseEvidenceDispositionLedger(text) {
  return String(text || "").split(/\r?\n/).filter((row) => row.trim().length > 0).map((row, index) => {
    try { return JSON.parse(row); }
    catch { throw new Error("Invalid evidence-disposition JSONL at line " + (index + 1)); }
  });
}

export function evaluateEvidenceQualification(queue, reviews = [], asOf = new Date().toISOString(), reviewProofs = new Map()) {
  if (!queue || !Array.isArray(queue.items)) throw new Error("Evidence queue must include an items array");
  if (!Array.isArray(reviews)) throw new Error("Disposition ledger must be an array");
  if (!(reviewProofs instanceof Map)) throw new Error("SEC source review proof index must be a Map");
  const cutoff = asTime(asOf);
  if (cutoff === null) throw new Error("Invalid evidence-qualification audit time");

  const items = new Map();
  for (const item of queue.items) {
    if (!nonempty(item?.id) || !nonempty(item?.ticker) ||
        !nonempty(item?.accessionNumber) || !nonempty(item?.sourceUrl)) {
      throw new Error("Evidence queue entry lacks identifiable primary filing lineage");
    }
    if (!ALLOWED_STATUSES.has(item.status)) throw new Error("Unsupported queue status for " + item.id);
    if (item.id !== item.ticker + ":" + item.accessionNumber) throw new Error("Evidence queue identity mismatch for " + item.id);
    if (items.has(item.id)) throw new Error("Duplicate evidence queue item " + item.id);
    items.set(item.id, item);
  }

  const latestReviews = new Map();
  const reviewIds = new Set();
  for (const review of reviews) {
    if (!nonempty(review?.reviewId) || reviewIds.has(review.reviewId)) {
      throw new Error("Duplicate or missing disposition reviewId");
    }
    reviewIds.add(review.reviewId);
    const filing = items.get(review.itemId);
    if (!filing) throw new Error("Disposition targets unknown filing " + review.itemId);
    if (review.version !== 1 || !DISPOSITIONS.has(review.disposition)) {
      throw new Error("Invalid disposition contract for " + review.itemId);
    }
    if (review.ticker !== filing.ticker || review.accessionNumber !== filing.accessionNumber ||
        review.primarySourceUrl !== filing.sourceUrl) {
      throw new Error("Disposition identity/source mismatch for " + review.itemId);
    }
    if (!nonempty(review.reviewer) || review.reviewer.trim().length < 4 ||
        !nonempty(review.rationale) || review.rationale.trim().length < 40 ||
        !HASH64.test(review.sourceDocumentSha256 || "")) {
      throw new Error("Disposition lacks attributable reviewer, substantive reason, or primary-source content hash for " + review.itemId);
    }
    // A syntactically valid 64-character hash is NOT evidence that SEC source
    // bytes were ever fetched. Clearance requires independently re-read proof.
    if (review.disposition === "non_gating" || review.disposition === "resolved") {
      const proof = reviewProofs.get(review.reviewId);
      if (proof?.verified !== true || proof.sourceDocumentSha256 !== review.sourceDocumentSha256 ||
          proof.primarySourceUrl !== review.primarySourceUrl || !HASH64.test(proof.archiveDigest || "")) {
        throw new Error("Missing or mismatched authenticated SEC source archive for " + review.itemId);
      }
    }
    const at = asTime(review.reviewedAt);
    const detected = asTime(filing.detectedAt);
    if (at === null || detected === null || at < detected || at > cutoff) {
      throw new Error("Disposition has invalid review chronology for " + review.itemId);
    }
    const previous = latestReviews.get(review.itemId);
    if (previous) {
      if (review.supersedesReviewId !== previous.reviewId) {
        throw new Error("Superseding review must explicitly reference prior reviewId for " + review.itemId);
      }
      if (at < asTime(previous.reviewedAt)) {
        throw new Error("Disposition chronology cannot move backward for " + review.itemId);
      }
    } else if (nonempty(review.supersedesReviewId)) {
      throw new Error("First review may not supersede a nonexistent review for " + review.itemId);
    }
    latestReviews.set(review.itemId, review);
  }

  let pendingUnreviewed = 0, reviewedMaterialOpen = 0, reviewedNonGating = 0, reviewedResolved = 0;
  let rawPending = 0, legacyClosedWithoutReview = 0;
  for (const item of items.values()) {
    if (OPEN_STATUSES.has(item.status)) rawPending++;
    const disposition = latestReviews.get(item.id)?.disposition;
    if (disposition === "material_open") reviewedMaterialOpen++;
    else if (disposition === "non_gating") reviewedNonGating++;
    else if (disposition === "resolved") reviewedResolved++;
    else {
      pendingUnreviewed++;
      if (item.status === "resolved") legacyClosedWithoutReview++;
    }
  }
  // A raw SEC queue status alone is not an acceptable qualification disposition.
  // Every unreviewed or materially open filing stays blocking.
  const unresolvedMaterialOrUnreviewed = pendingUnreviewed + reviewedMaterialOpen;
  const byId = [...items.values()].map((item) => [
    item.id, item.ticker, item.accessionNumber, item.form, item.status, item.sourceUrl
  ]).sort((a,b) => a[0].localeCompare(b[0]));
  const reviewTrace = [...latestReviews.values()].map((review) => [
    review.itemId, review.reviewId, review.disposition, review.sourceDocumentSha256, review.reviewedAt,
    reviewProofs.get(review.reviewId)?.archiveDigest ?? null
  ]).sort((a,b) => a[0].localeCompare(b[0]));
  return {
    version: 1,
    contract: "earth2036-evidence-qualification-v1",
    auditedAt: asOf,
    policy: "no_form_exemptions; explicit_source_hashed_review_only; open_and_unreviewed_fail_closed",
    totalFilings: items.size,
    rawPending,
    pendingUnreviewed,
    reviewedMaterialOpen,
    reviewedNonGating,
    reviewedResolved,
    legacyClosedWithoutReview,
    reviewEvents: reviews.length,
    activeReviewedItems: latestReviews.size,
    unresolvedMaterialOrUnreviewed,
    gatePassed: unresolvedMaterialOrUnreviewed === 0,
    queueFingerprint: sha256(JSON.stringify(byId)),
    reviewFingerprint: sha256(JSON.stringify(reviewTrace)),
    reviewLedgerDigest: sha256(JSON.stringify(reviews.map((review,index) => [index,review]))),
  };
}

export function evidenceQualificationMatchesState(summary, state, reference) {
  return Boolean(
    summary?.contract === "earth2036-evidence-qualification-v1" &&
    reference?.contract === summary.contract &&
    summary.queueFingerprint === reference.queueFingerprint &&
    summary.reviewFingerprint === reference.reviewFingerprint &&
    summary.reviewLedgerDigest === reference.reviewLedgerDigest &&
    summary.unresolvedMaterialOrUnreviewed === reference.unresolvedMaterialOrUnreviewed &&
    Number(state?.unresolvedEvidence) === summary.unresolvedMaterialOrUnreviewed &&
    Number(state?.rawUnresolvedEvidence) === summary.rawPending
  );
}
