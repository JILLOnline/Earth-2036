#!/usr/bin/env node
// Operator-only GitHub snapshot, never task supervision or proof of ChatGPT enablement.
import {readFile,appendFile} from "node:fs/promises";
import {buildWorkforceObligations,WORKFORCE_ROLES} from "./lib/phoenix-workforce-obligations.mjs";
const read=async name=>JSON.parse(await readFile(name,"utf8"));
const view="data/runtime/workgraph/worker-view";
const assistViews={},routingViews={};
for(const role of WORKFORCE_ROLES.filter(r=>r!=="chief-earth")) {
  [assistViews[role],routingViews[role]]=await Promise.all([
    read(view+"/assist/"+role+".json"),
    read(view+"/routing/"+role+".json"),
  ]);
}
const deps=await read("data/runtime/workgraph/source-dependency-handoffs.json");
const report=buildWorkforceObligations({
  assistViews,routingViews,sourceDependencyHandoffs:deps,
  generatedAt:deps.generatedAt,
});
console.log(JSON.stringify({contract:report.contract,total:report.total,
  byStatus:report.byStatus,sourceDependencies:report.selected.filter(x=>x.kind==="deferred_source_dependency"),
  selected:report.selected.map(x=>({ticker:x.ticker,owner:x.owner,kind:x.kind,status:x.status,requestId:x.requestId}))},null,2));

const lines=[
  "## Phoenix P3A — non-executing workforce obligation shadow","",
  "Research queue requests are not actual ChatGPT task executions.",
  "GitHub cannot attest task enablement; all unverified owners require external review.","",
  "| Type | Count |","|---|---:|",
  ...Object.entries(report.byStatus).sort((a,b)=>a[0].localeCompare(b[0])).map(([status,n])=>"| "+status+" | "+n+" |"),
  "",
  "### First 8 unmet obligations",
  ...report.selected.slice(0,8).map(x=>"- "+x.ticker+" — "+x.owner+" · "+x.kind+" · "+x.status),
  "",
  "No restarts, no evidence writes, no fabricated claim pairs, no canonical or T0 changes.",
];
if(process.env.GITHUB_STEP_SUMMARY)
  await appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join("\n")+"\n");
