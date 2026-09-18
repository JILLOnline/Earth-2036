# Earth 2036 — Decision Ladder 1.0

This contract separates **live rank truth** from **frozen decision truth**. It does not alter Earth Score 1.0, rubric weights, scoring formulas, or T0 publication gates.

## Live ladder

After official T0 only:

- **#1–10 — Championship Board**
- **#11–250 — Contenders**
- **Outside #250 — Discovery / Challengers**

Before T0, seed order and provisional score order are research/workbench order only. They must not render as official ranks, Championship, Contenders, or Top-3 winners.

## Frozen decision cohorts

Frozen cohorts are separate from the live ladder and preserve their own as-of evidence, rank, score, confidence, risk, execution state, and reason.

- **Weekly** — up to 10 selections from qualified/reconciled history. Fewer than 10 is valid.
- **Monthly** — up to 5 selections from Weekly finalists after re-underwriting. Fewer than 5 is valid.
- **Quarterly** — up to 3 selections from Monthly finalists after re-underwriting. Fewer than 3 is valid.
- **Annual** — the year's locked candidate cohort is formed only from the four frozen Quarterly Top-3 cohorts: Q1 Top 3 + Q2 Top 3 + Q3 Top 3 + Q4 Top 3, for a target of 12 earned annual slots. Annual does not pull replacements directly from Weekly, Monthly, or the live ladder. If a quarterly slot is not legitimately earned under the gates, it is not force-filled.

A company may hold a current live rank that differs from a historical frozen Weekly/Monthly/Quarterly/Annual rank. Both truths must remain visible and immutable.

## Eligibility

Rank alone never overrides data quality. A frozen promotion requires all applicable existing Earth gates to be defensible, including identity, tradability, publishability, evidence completeness, source freshness/capability, causal support, Data Confidence, unresolved evidence, and council reconciliation. No new numeric scoring threshold is introduced by this contract.

## Persistence and churn

One-hour score movement cannot retroactively alter a frozen decision. Period selections must use qualified history rather than a one-shot snapshot. Promotion, demotion, quarantine, replacement, and omission reasons are preserved. Excessive cohort turnover is a calibration signal, not something to hide.

## Historical record schema

Every frozen selection should preserve at minimum:

- period ID and as-of timestamp;
- ticker and company name;
- frozen cohort rank;
- frozen Earth Score, Data Confidence, and Risk;
- exchange/division and entity/tradability state at decision time;
- Action State / execution decision when applicable;
- concise selection or omission reason;
- exact evidence / tick / council lineage sufficient to reconstruct the decision.

Current pointers live in `data/decisions/index.json`. Future immutable period records should be appended under period-specific history paths and never rewritten.

## UI rules

The Universe screen is the single visual surface for:

`LIVE 250 · CHAMPIONSHIP · CONTENDERS · WEEKLY · MONTHLY · QUARTERLY · ANNUAL`

Only actual data is displayed. If a cohort has not yet been earned, the view is explicitly pending/empty.

The Annual view is exempt from staged 10 → 50 → all pagination. It always renders the full earned annual cohort at once; under the normal four-quarter path that is 12 annual slots. The footer may offer Back to Top, but Annual must never hide two of the 12 behind Show More.

Top-3 visual emphasis is allowed only when the rank is official: either an official live rank after T0 or a rank inside a frozen decision record. Pre-T0 workbench ordering never receives podium treatment.
