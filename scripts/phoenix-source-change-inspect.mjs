#!/usr/bin/env node
// P5A: deterministic GitHub read-only source delta review.
// This cannot activate workers, change closure status, or write canonical state.
import {readFile,appendFile} from "node:fs/promises";
import {buildSourceChangeReview} from "./lib/phoenix-source-change-review.mjs";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const inputs={
  sourceAudit:await read("data/runtime/adaptation/source-change-audit.json"),
  secContinuity:await read("data/runtime/adaptation/sec-accession-continuity.json"),
  frontier:await read("data/runtime/workgraph/shadow/closure-frontier.json"),
  assistBus:await read("data/runtime/workgraph/assist-bus.json"),
  reviewQueue:await read("data/runtime/evidence-review-queue.json"),
  observations:await read("data/runtime/company-observations.json"),
  sourceHoldCatalog:await read("config/phoenix-known-write-rejections.json"),
};
const report=buildSourceChangeReview(inputs);
console.log(JSON.stringify({contract:report.contract,mode:report.mode,summary:report.summary,
  signals:report.signals.slice(0,8),automaticWorkerActivation:false},null,2));
if(process.env.GITHUB_STEP_SUMMARY){
  const lines=[
    "## Phoenix P5A — source-change candidate review (read only)","",
    "| Source continuity | Result |","|---|---:|",
    "| SEC companies checked | "+report.summary.companiesChecked+" |",
    "| SEC continuity complete | "+report.summary.secContinuityComplete+" |",
    "| Current observed source deltas | "+report.summary.sourceAuditChangedCount+" |",
    "| Dormant assists not reactivated | "+report.summary.dormantAssistCount+" |",
    "| Stalled frontier not reset | "+report.summary.staleFrontierCount+" |",
    "| New candidate reviews | "+report.summary.newReviewSignals+" |",
    "",
    ...report.signals.slice(0,8).map(x=>"- "+x.ticker+" / "+x.accessionNumber+" — "+x.status),
    "",
    "**No task restart, rejected-write retry, factor score, Chief approval, historical backfill or canonical mutation.**",
  ];
  await appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join("\n")+"\n");
}
