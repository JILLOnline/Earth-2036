# Earth 2036 — SEC primary-source verification, read-only security-review proposal

**Status:** PROPOSED ONLY · **Owner approval received to prepare this document, not to execute it** · 2026-10-09 ET

**Related:** [Draft PR #57](https://github.com/JILLOnline/Earth-2036/pull/57) (existing privilege/safety hold), [#46](https://github.com/JILLOnline/Earth-2036/issues/46) (byte authentication), [#47](https://github.com/JILLOnline/Earth-2036/issues/47) (filing disposition and materiality). This document is an **inert review artifact**. No executable workflow, new SEC fetch, repository credential, background task, or source write is introduced by this change.

## 1. Exact security boundary

The proposed first exercise would read **at most one existing, already-queued primary SEC document** solely to verify access, exact URL/CIK/accession identity, returned bytes, SHA-256, byte size, and structured Form 4 document markers. It would not decide source materiality, approve an analyst, or create an evidence disposition. No rankings, score, company packets, Workgraph evidence, canonical status, T0, or tick counters may change.

A positive source-fetch result proves only transient access to bytes at a given time. **A SHA printed in a job log is not an immutable source archive and is not sufficient to clear an SEC review gate.** Existing finalizer safeguards must continue to reject filings without independently persisted and authenticated source bytes plus independently approved review.

## 2. Threat comparison: PR #57 versus proposed read-only scope

| Control | PR #57 draft | Read-only proposal |
|---|---|---|
| Trigger | Push to main upon workflow change **or** manual dispatch | **Manual dispatch only**, after security and platform clearance; no schedule, push or pull_request trigger for acquisition |
| Installation | Executable file under `.github/workflows/` | **None** in this PR; only this Markdown review document |
| Job permissions | `contents: write` | `contents: read` maximum; all other `GITHUB_TOKEN` scopes `none` |
| Checkout credentials | `persist-credentials: true` | `persist-credentials: false` |
| Git mutations | New branch, commit, and `git push` | **Prohibited** |
| Output | Raw SEC bytes committed in public repository | No repository file, Actions artifact, cache, gist, issue comment, upload, new branch or external storage; **digest-only console summary** on success |
| Fetch frequency | One run after push, plus dispatch | **One bounded, explicitly approved manual attempt**; never unattended or retried after access denial |
| Review power | No review approval | No review approval |
| Qualification power | None | None |
| Prior safety rejection | Blocked workflow merge | **Not overruled**; activation/dispatch is not authorized by approval to prepare this document |

## 3. Candidate workflow properties — not deployable yet

If and only if an independent reviewer and execution safety controls later authorize an implementation, its contract must enforce all of the following:

1. **Manual-only activation** using `workflow_dispatch` on the repository default branch, restricted to a trusted actor via GitHub Actions execution policies if available. GitHub requires a manual-dispatch workflow to exist on the default branch; review/approval is required *before* any future activation PR. No `push`, `schedule`, `pull_request_target`, or automation that indirectly dispatches it.
2. **Read-only GitHub identity.** Explicit `permissions: { contents: read }` (other scopes none), no credentials persisted by checkout, no personal access token, no SSH deploy key, no Git push, no API writes and no artifact upload or cache write.
3. **Single allowlisted source identity** from the real canonical `data/runtime/evidence-review-queue.json`, exact ticker, CIK, accession and primary URL; never let untrusted input supply a new hostname or arbitrary URL. Intended smoke target: `MRVL:0001628280-26-065570`, subject to re-validation of queue membership at activation time.
4. **SEC fair-access boundaries.** Declare an organization and approved contact User-Agent, request only the document needed, perform **one request with zero automatic retries**, use 12-second timeout and strict 2-MiB response-byte cap. Any 403, 429, unknown content, redirect, timeout, missing access, invalid SEC identity, incorrect digest or content marker is a **failed test**. No rotating credentials/proxies or changing source identity to get around denial.
5. **Memory-only source proof.** Use the existing `fetchSecDocumentArtifact` and independent `verifySecDocumentArchive` functions in the same ephemeral run. Do **not** invoke `scripts/archive-sec-primary.mjs` or `persistSecDocumentArtifact`, because those write a local archive that a later step might accidentally commit. Do not log or upload raw content/base64. Output only allowlisted filing ID, source response category, retrieval instant, total byte count and SHA-256 if genuinely verified; logs are **non-authoritative** and cannot clear the queue.
6. **Approval separation.** No GitHub bot or reviewer identity inferred from the workflow actor; a later materiality disposition requires an independently authenticated reviewer under governance #47. No automatic "non_gating", "resolved", or score/Workgraph/tick edits.
7. **Explicit no-go conditions.** Reject the attempt if PR #57's earlier safety restriction remains applicable, SEC forbids the run, the default-branch source has drifted, GitHub actor execution policy is not established, or an independent reviewer has not authorized the precise new design. Stop instead of switching to a different account, pipeline, connector or execution service.

### Illustrative permission and event policy (plain documentation only)

```yaml
# NOT an executable Earth 2036 workflow.
# Only after a separate security-reviewed activation decision:
name: Earth 2036 SEC Single-Source Read-Only Audit
on:
  workflow_dispatch:
permissions:
  contents: read
# Other token scopes are none.
# checkout would use persist-credentials: false.
# No git push, upload-artifact, repository writes, score writes, or review decisions.
```

## 4. Review evidence and acceptance

**Security review must record:** reviewer identity and authorization; disposition of the previously rejected PR #57 workflow; separate approval of manual dispatch and exact GitHub identity; SEC usage/contact identity; accepted non-persistence/logging requirements; data-retention/visibility implications; failure response; and a rollback/disable procedure. A green CI run is **not** security approval.

**Static acceptance (allowed now):** verify this PR changes only documentation, registers **no executable workflow**, and changes no task automation or canonical runtime. Verify the candidate's requested controls in a proposed diff, but do not dispatch it.

**Live acceptance (not allowed yet):** only after the above authorizations, a *separate* reviewed activation PR and explicit execution clearance may perform one live fetch. Inspect the real response and logs; fail closed on any source/permission error. Even a pass does not satisfy archival provenance or ledger reviewer authentication.

**Follow-on dependency:** any immutable archive/read-rehash and reviewer-authentication implementation is a separate trust decision, outside this read-only probe. Review backlog, T0, Council/Beast and official tick finalizer remain blocked as before.

## 5. Sources and governance

- SEC fair-access guidance: https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data (identified User-Agent and moderate access; general published cap 10 req/s is **not** a target rate)
- SEC developer resources: https://www.sec.gov/about/developer-resources
- GitHub workflow dispatch requirements: https://docs.github.com/actions/managing-workflow-runs/manually-running-a-workflow
- GitHub Actions workflow token permission model: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- GitHub Actions execution-policy protections: https://docs.github.com/en/actions/concepts/about-actions-policies

### Decision requested from security reviewer

Choose **APPROVE DESIGN FOR A SEPARATE ACTIVATION REVIEW**, **REVISE**, or **DENY**. Approval of this Markdown document alone cannot activate or run the SEC pilot.
