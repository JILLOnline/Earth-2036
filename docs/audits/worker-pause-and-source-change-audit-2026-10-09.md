# Earth 2036 — Scout/Beta safety triage and adaptation input audit

**Status:** Observational forensic findings, October 9, 2026. Do not treat as clearance or permission to restart paused tasks. No ChatGPT task definition was modified.

## Worker pause cross-check

| Task | Last ChatGPT task time (UTC) | Control-plane status | Last corroborating GitHub evidence and assessment |
|---|---|---|---|
| Earth Scout | 2026-10-09 16:01:12 | Disabled since 16:02:16 | `data/runtime/workgraph/receipts/AEVA-20261008T210501Z-earth-scout.json` records `evidence_write_blocked`: an AEVA denominator artifact was rejected by GitHub safety checks and **not committed**. The receipt predates the latest task run; the exact October 9 disablement cause is **unverified**. |
| Council Beta | 2026-10-09 22:26:57 | Disabled since 22:28:00 | `data/runtime/workgraph/receipts/AEVA-20261007T192620Z-council-beta.json` and `RIO-20261007T082005Z-council-beta.json` show valid no-duplicate decisions. There is no corroborated latest October 9 exception or deliberate pause reason in the checked repo receipts. **Unknown** is not the same as safety violation or recoverable failure. |
| Council Alpha | 2026-10-09 22:13:47 | Enabled | Latest task execution is not a new source-backed Workgraph role-run; useful research output still unverified. |
| Deep Resolver | 2026-10-09 22:37:42 | Enabled | No current actionable sourced contradiction verified in this audit. |
| Chief | 2026-10-09 22:54:34 | Enabled | Worker coordination task, not canonical/promotion authority. |

Automations service exposes schedule/enabled/last-run metadata but not the latest worker-run transcripts or shutdown/disable reason to this audit. The GitHub evidence directory and role-run receipts are a **different telemetry domain**. Neither worker was restarted or reassigned.

**Next safe intervention:** obtain direct evidence from the relevant last worker execution or pause event. Classify: explicit user pause; platform safety rejection; repository write/credential conflict; quota/infrastructure; or benign disable. Permit automatic recovery only if verified benign and authorized. For Scout, do not resubmit or repackage the previously rejected AEVA payload absent a truly new approved source path and review.

## Source-change signals as an audit-only prerequisite

`scripts/lib/source-delta-observation-audit.mjs` reports:
- new-to-observed-SEC-window accessions with form, filing and source address; not proof they were newly filed since the last cycle;
- existing window accessions merely aging out (12-entry cap), which do **not** represent new evidence;
- fetch failure, later recovery, and newly admitted ticker bootstrap, without automatic change attribution;
- contradictory unchanged fingerprints with differing accession sets, requiring scanner validation.

The report is stored at `data/runtime/adaptation/source-change-audit.json`. It **does not** create researcher tasks, reactivate dormant assists, clear preflight, write a score, authorize materiality, certify freshness of the wider filing archive, or change any safety hold. Old `value-allocator` / `assist-bus` dormancy signatures remain untouched. This is an independent audit foundation, not a bypass for the previously rejected source-activation patch.

## Remaining engineering gates

1. Verify latest Scout/Beta task-disable causes from actual run transcripts; classify independently.
2. Build full SEC accession history/cursor (current scanner uses a rolling window of 12). A newly visible accession may reflect old filing history. See issue #37.
3. Require independent source verification and an approved changed-input contract before considering any production worker reactivation; prove migration does not mass-wake deferred work.
4. Prove successful research write/receipt/packet-delta/Beast acceptance for one case (e.g., AEVA or MWA), not merely another task invocation.
5. Preserve GitHub-only canonical authority, T0 and tick fail-closed gates, and append-only evidence.

**No claim:** the source-delta report alone does not fix the 74-company canonical backlog or restore the two paused workers.
