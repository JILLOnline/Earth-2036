# Earth 2036 — Workgraph v2 Structured Evidence Contract

Workers write immutable structured evidence objects under `data/runtime/workgraph/evidence/`.

Minimum shape:

```json
{
  "version": 1,
  "ticker": "XYZ",
  "workId": "t0:XYZ",
  "perspective": "company-underwriting",
  "cycleKey": "20260916T1000Z",
  "generatedAt": "2026-09-16T10:22:00Z",
  "claims": [],
  "factors": [{"name":"financial-operating-momentum","evidence":"..."}],
  "sources": [{"id":"...","url":"...","primary":true,"originFingerprint":"..."}],
  "risks": [],
  "causalEdges": [],
  "contradictions": [],
  "unknowns": [],
  "gatingIssues": [],
  "confidence": 0
}
```

Rules:

- Evidence objects are additive; do not overwrite historical evidence to make a later conclusion look cleaner.
- One underlying factual origin is one event even if repeated by many articles.
- `gatingIssues` contains only locked-methodology/T0 defects. Optional detail and future uncertainty belong in `unknowns`.
- A contradiction is gating unless explicitly marked `gating:false` or `resolved:true` with lineage.
- `confidence` is conservative evidence confidence, not a stock recommendation.
- Promotion packets under `data/runtime/workgraph/packets/` are machine-generated and must not be hand-edited.
- `chief_ready` is machine-earned after packet preflight. Workers may recommend it but may not manufacture it.
