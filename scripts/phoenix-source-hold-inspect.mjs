#!/usr/bin/env node
// Source-layer audit: only reads known persisted rejection bytes.
// It never resumes ChatGPT tasks, writes worker research, retries denied payloads,
// or derives disable reasons from GitHub receipts.
import {readFile,appendFile} from "node:fs/promises";
import {buildWorkforceObligations,WORKFORCE_ROLES} from "./lib/phoenix-workforce-obligations.mjs";
import {deriveSourceWriteHolds} from "./lib/phoenix-source-hold-triage.mjs";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const catalog=await read("config/phoenix-known-write-rejections.json");
const sourceFiles={};
for(const row of catalog.records)sourceFiles[row.sourcePath]=await readFile(row.sourcePath,"utf8");
const assistViews={},routingViews={};
for(const role of WORKFORCE_ROLES.filter(x=>x!=="chief-earth")){
  [assistViews[role],routingViews[role]]=await Promise.all([
    read("data/runtime/workgraph/worker-view/assist/"+role+".json"),
    read("data/runtime/workgraph/worker-view/routing/"+role+".json")
  ]);
}
const sourceDependencyHandoffs=await read("data/runtime/workgraph/source-dependency-handoffs.json");
const obligations=buildWorkforceObligations({assistViews,routingViews,sourceDependencyHandoffs});
const result=deriveSourceWriteHolds({catalog,sourceFiles,obligations});
console.log(JSON.stringify({
  contract:result.contract,
  exactCurrentRequestHolds:result.currentExactRequestHolds,
  historicalOther:result.historicalOrUnattributedRejections,
  anyWorkerResumeAuthorized:false,
},null,2));
if(process.env.GITHUB_STEP_SUMMARY){
  const lines=[
    "## Phoenix P3C — source write safety review",
    "",
    "Historical source write rejections do not establish why ChatGPT disabled tasks.",
    "An exact rejected request must not be automatically retried if its signature persists or changes.",
    "",
    ...result.findings.map(x=>"- "+x.role+" / "+x.ticker+" / "+x.scope+
      ": "+x.disposition+" · "+x.currentMatchingObligationIds.length+
      " current matching obligation(s) · original source `"+x.sourcePath+"`"),
    "",
    "External task-disable cause remains unverified. No restart granted.",
  ];
  await appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join("\n")+"\n");
}
