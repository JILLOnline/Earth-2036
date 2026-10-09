# Earth 2036 — Evidence Integrity and Qualification 1.0

**Authority:** One GitHub canonical runtime; Methodology 1.0, Beast integrity, original 250-company T0 and all qualified-tick gates remain authoritative.

## Why this exists

The SEC ingestion loop records new filings in `data/runtime/evidence-review-queue.json` with status `pending`.
The older T0 gate consumed `unresolved` as one undifferentiated integer. The Workgraph command summary also grouped filings by **frontier scheduling urgency**, which is *not* a source-backed materiality review. Neither a Form 4/144 classification nor a non-frontier company is grounds to waive the evidence gate.

This release **does not mark any historical filing reviewed**. It adds an independent, append-only, evidence-addressed disposition contract. All unreviewed filings and explicitly material-open filings continue to block T0 and every qualifying trial tick.

## Three non-interchangeable numbers

- `rawUnresolvedEvidence`: source queue entries with status `pending`, `open` or `unresolved`, regardless of review. Preserved for historical audit; it is never erased by a disposition.
- `unresolvedEvidence`: genuinely unresolved for the qualification contract, equal to **unreviewed + source-reviewed material-open**. In the absence of legitimate reviews, this remains as large as the raw queue and all gates stay locked.
- `reviewedNonGating` / `reviewedResolved`: filings that have an attributable, source-hashed review giving a defensible reason that they do not represent an unresolved material question for this methodology and evidence window. These are not deleted from history.

The machine writes `data/runtime/evidence-qualification.json` each cycle with totals, audit time, queue fingerprint and latest-review fingerprint. The finalizer recomputes those values from the original queue and independent append-only review ledger before allowing its normal T0/tick gates to run; a mismatch is a **hard stop**.

## Append-only review contract

File: `data/operations/evidence-dispositions.jsonl` (empty at inception).

One JSON object per line, UTF-8. The object must contain:

- `version: 1`; globally unique `reviewId`
- exact `itemId`, `ticker`, `accessionNumber` from the SEC queue
- `disposition: "material_open" | "non_gating" | "resolved"`
- attributable `reviewer` and UTC `reviewedAt` not before filing detection
- exact `primarySourceUrl` matching the original filing's source URL
- `sourceDocumentSha256` computed from the **actual retrieved primary document bytes**, not from the URL, an assistant guess, or an unrelated artifact
- `rationale` describing the source facts and why the filing is material/open or safely dispositioned

A follow-up correction must be a **new line** with a new review ID, and `supersedesReviewId` matching the previous review for that filing. Do not edit, remove, or reorder prior lines. A superseding `material_open` review immediately makes the filing blocking again. No decision is implicitly generated from form type, age, ranking, frontier status, route, or a superficial title.

**Important:** Runtime checks verify declared primary URL, hash syntax, chronology, and reviewer attribution, but do not authenticate the external document bytes or the correctness of the reviewer's reasoning. The reviewing lane must verify and preserve its retrieval evidence; audit sampling must test claims against the actual original document. Unauthorized, inaccessible, or safety-rejected evidence stays pending.

## Raw example (synthetic only; NOT to add as a real review)

```json
{"version":1,"reviewId":"synthetic-001","itemId":"TEST:00000000-00-000001","ticker":"TEST","accessionNumber":"00000000-00-000001","disposition":"material_open","reviewer":"council-alpha:reviewer","reviewedAt":"2026-10-09T23:00:00Z","primarySourceUrl":"https://www.sec.gov/Archives/edgar/data/1234/000000000000000001/filing.htm","sourceDocumentSha256":"<64 lowercase SHA-256 hex characters from retrieved primary document>","rationale":"The primary filing contains an unresolved material operating or capital-structure claim and therefore remains blocking pending evidenced reconciliation."}
```

## Release acceptance

1. Existing unreviewed 1,588-entry snapshot stays blocking; nothing is auto-closed.
2. A source-reviewed material-open filing stays blocking.
3. A complete, attributable non-gating or resolved decision changes **only** that filing's qualified blocker status; the original queue record remains pending.
4. A new filing ID automatically enters the pending/unreviewed count and blocks unless explicitly reviewed.
5. Bad source identity, short/generic rationale, missing source-document hash, future-dated review, fake supersession, missing queue, or altered fingerprint fails closed.
6. T0 remains locked until **all the other preexisting gates** also pass, including 250 source-backed scores, source coverage, discovery, Council, mathematical integrity, and immutable full-universe snapshot.
7. Post-T0 hours store true observations even when qualification fails; no synthetic ticks or missed-hour backfills.

## Operations follow-up

Create a source-review worker flow using primary SEC document retrieval and source byte hashing, explicit dated claims, materiality criteria tied to Methodology 1.0 factors, and an independent spot-check before granting non-gating decisions. Do not add a sixth ChatGPT workforce task merely to work the queue; attach bounded evidence review to existing appropriate lanes and maintain the original five-role limit. Until this has been tested, the backlog does not automatically shrink.

The Workgraph `evidenceBacklog.buckets` remain **scheduling priority**; `evidenceBacklog.qualification` is the separate formal reviewed/unreviewed breakdown. Never equate `supporting` with approved `non_gating`.

## Governance note

This release clarifies the scope of the unresolved-evidence input. It does not alter Earth Score weights, scoring formulas, authenticity requirements, or the locked 250-company methodology. If review policy needs broader exemptions, that requires an explicit methodology/governance decision and versioning—not a hidden code shortcut.
