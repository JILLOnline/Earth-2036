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


## 6. Security review findings — mandatory amendments (supersede weaker provisions above)

GitHub Codex finished its initial review on 2026-10-10 and identified three unresolved findings. These requirements are DOCUMENTATION ONLY; nothing below is implemented or approved for execution.

### P1: Enforce independent approval for every specific attempt
A manual GitHub Actions dispatch can be initiated by repository writers and a run can be retried. Manual activation alone is **not** trusted-actor enforcement. Before any separate activation is considered, require an independently enforced GitHub protected environment with designated reviewers and **no self-approval**, gating the fetch job before access. A distinct fail-closed authorization must bind the exact filing, both github.actor and github.triggering_actor, github.run_id, and github.run_attempt. All reruns must obtain a fresh valid approval; an old grant must not be silently reusable. The enforcement must be outside code editable by a proposed workflow contributor. If the repository cannot provide and verify this enforcement, do not activate the pilot.

### P1: Pin dispatch to the approved immutable source revision
GitHub manual dispatch accepts a ref selecting workflow/helper code on an alternate branch or tag. Merely putting a workflow on the default branch does not enforce its execution revision. A trusted gate independent of editable workflow content must require the exact separately reviewed default-branch SHA and expected ref before the request, and reject all alternate dispatch refs and unapproved reruns. If GitHub repository/environment policy cannot enforce and attest this, do not activate. Never treat the requestor-selected ref as proof of code provenance.

### P2: Prove Form 4 content, not merely status, hash and URL
The existing SEC archive byte verifier is **insufficient** to prove that a response is a Form 4: a status-200 HTML page or unrelated XML can be faithfully hashed. Any future pilot must explicitly check response type and securely parse the actual XML with DTD/external entities disabled; require an ownershipDocument root, mandatory issuer fields, and issuer CIK matching independently verified accession/issuer context. Accession-to-document identity must come from trusted SEC filing metadata rather than assumed XML accession fields. Reject unrelated XML, generic HTML/denial pages, missing fields, mismatched CIK, malformed XML and semantic spoofing. Add negative tests for each before review approval.

### Final decision criteria
The provisions above supersede the earlier weaker phrase "execution policies if available" and any suggestion that the existing byte verifier alone validates Form 4 content. Even a successful future source fetch cannot authorize filing disposition or T0 advancement. Security review remains advisory; the previous connected safety rejection is not bypassed. PR #57 stays on hold. This proposal adds no executable workflow, does not dispatch a run, and grants no background permission.


## 7. Second security-review amendments — additional mandatory no-go controls

The second Codex review (2026-10-10 01:37 UTC, reviewed SHA 58e583f) identified three more design omissions. The provisions below are requirements for any *future, separately security-approved activation*. They are not present in a deployed workflow or proven operational.

### P1: Explicitly prohibit GitHub administrator bypass of protected-environment approval

Designated reviewers and disabled self-review are **not sufficient** if repository administrators can bypass job approval. Verify and document that the protected environment has **"Prevent administrators from bypassing configured protection rules"** enabled. Where that option is unsupported, use an independently enforced and non-bypassable external approval gate; absent proof that neither a repository administrator nor a workflow author can skip it, **DENY the pilot**. Test the fail-closed behavior for initial runs, reruns and changes to `github.actor`/`github.triggering_actor`. Do not approve on a screenshot alone without settings provenance and an explicit authorized reviewer sign-off.

### P1: Pin the entire executable dependency graph by immutable full commit SHA

Verifying the Earth 2036 workflow/helper SHA is **not enough** if `uses:` actions or reusable workflows resolve to mutable tags or branches. Require every third-party and first-party action dependency and every reusable workflow called by the future implementation to be pinned to a **full-length reviewed immutable commit SHA**, never `@v5`, `@main`, mutable release tags or untrusted action forks. Security review must cover the actual pinned commits and transitive trust/dependency scopes, runner privileges, and any indirect script downloaded at runtime. Deny activation if any dependency cannot be pinned and reviewed or if the approved dependency set changes. This applies to checkout/setup actions as well as any future additions.

### P2: Validate exact ownership XML document type against queued SEC form

`ownershipDocument`, issuer fields and matching CIK alone do not distinguish Forms 3, 4 and 5. For the selected queued entry `MRVL:0001628280-26-065570`, require an XML `documentType` value of **exactly `4`**, matched to the already authenticated queue `form` and associated SEC filing metadata. Apply the corresponding official SEC ownership XML schema/constraints to distinguish the claimed filing type; reject missing, duplicate, ambiguous or substituted `documentType`, out-of-family forms, and invalid form-specific content. Add regression fixtures for valid Form 4 and negative Forms 3/5, missing `documentType`, mismatched queue form, forged issuer CIK, missing required data, XML parser/DTD/entity attack, malformed XML and status-200 unrelated documents. Do not rely on headers, regex over source text or the current byte-hash helper as a substitute for schema-aware semantic validation.

**End state:** All six reviewer findings are now written into the proposed acceptance contract. **That does not mean they have been implemented or that a security hold has been cleared.** PR #57 is still draft/held. This PR remains documentation-only; do not merge, dispatch or retrieve sources to demonstrate compliance with this proposal. Record independent approvals and verify all controls before considering any future activation.
