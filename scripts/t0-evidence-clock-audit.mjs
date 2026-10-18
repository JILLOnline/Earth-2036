#!/usr/bin/env node
// Human audit only: never make any admission or clearance decision from dates.
import {readFile,appendFile} from "node:fs/promises";
import {auditT0EvidenceClocks} from "./lib/t0-evidence-clock-audit.mjs";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const [manifest,queue,qualification,frontier]=await Promise.all([
  read("data/baselines/earth2036-official-t0-2026-09-12/manifest.json"),
  read("data/runtime/evidence-review-queue.json"),
  read("data/runtime/evidence-qualification.json"),
  read("data/runtime/workgraph/worker-view/closure-frontier.json")
]);
const report=auditT0EvidenceClocks({manifest,queue,qualification,frontier});
console.log(JSON.stringify(report,null,2));
if(process.env.GITHUB_STEP_SUMMARY){
  const c=report.clocks;
  const lines=["## T0 historical cutoff vs rolling SEC review — read only","",
    "Fixed evidence cutoff: `"+report.historicalCutoff+"` (explicit UTC offset).",
    "| Scope | Filings |","|---|---:|",
    "| Filed after historical T0 date | "+c.definitivelyFiledAfterT0+" |",
    "| On/before historical T0 date; still unverified | "+c.filedOnOrBeforeCutoffDayButStillUnverified+" |",
    "| Currently formally unreviewed | "+c.formalUnreviewed+" |",
    "| Material-open formal reviews | "+c.formalOpenMaterial+" |",
    "| Automatically admitted historical evidence | 0 |","",
    "### Current frontier filings",
    ...report.frontier.originalSecSourceAddressedButUnreviewed.map(x=>"- "+x.ticker+" / "+x.form+" / "+x.filingDate+" / "+x.itemId+" — "+x.clock),
    "",
    "**Governance required:** "+(report.governanceDecisionRequired||"No temporal split detected.") ,
    "This diagnostic does NOT change the existing evidence or trial gate, classify materiality, create a review, or restart a worker.",""];
  await appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join("\n"));
}
