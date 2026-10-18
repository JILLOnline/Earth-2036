import { evaluateEvidenceQualification, parseEvidenceDispositionLedger } from "./evidence-qualification.mjs";
import { loadVerifiedSecReviewProofs } from "./sec-review-archive.mjs";

// Keep Workgraph's noncanonical routing live without allowing a malformed
// review ledger or unauthenticated SEC archive to clear any qualification gate.
// Engine and finalizer independently perform the same original-byte validation.
export async function qualifyEvidenceForWorkgraph({ queue, ledgerText, archiveRoot, asOf }) {
  try {
    const reviews = parseEvidenceDispositionLedger(ledgerText);
    const proofs = await loadVerifiedSecReviewProofs(queue, reviews, archiveRoot, asOf);
    return evaluateEvidenceQualification(queue, reviews, asOf, proofs);
  } catch (error) {
    // Engine's fail-closed observation path likewise retains raw pending items.
    // Only independent finalizer checks can authorize canonical T0 / trial ticks.
    const fallback = evaluateEvidenceQualification(queue, [], asOf);
    return {
      ...fallback,
      gatePassed: false,
      archiveIntegrityError: String(error?.message || error).slice(0, 240),
    };
  }
}
