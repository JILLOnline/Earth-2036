#!/usr/bin/env node
// Phoenix P6 is an accountability report, not a recovery command.
// Only committed immutable cycle-history references qualify its observations.
import {readFile,appendFile} from "node:fs/promises";
import {assessPhoenixContinuity} from "./lib/phoenix-continuity-acceptance.mjs";
const source=JSON.parse(await readFile("data/operations/hourly-reconciliation/latest.json","utf8"));
const result=assessPhoenixContinuity(source);
console.log(JSON.stringify({
  contract:result.contract,checkedAt:result.checkedAt,latestHour:result.latestHour,
  windows:result.windows,acceptance:result.acceptance,sourceFingerprint:result.sourceFingerprint,
  authority:result.authority
},null,2));
if(process.env.GITHUB_STEP_SUMMARY){
  const lines=[
    "## Phoenix P6 — original-observation endurance (nonexecuting)","",
    "| Window | Verified original observations | Verified as-of receipts | Observation gate | Fully audited gate |",
    "|---|---:|---:|---|---|",
    ...["6h","24h","72h"].map(key=>{
      const w=result.windows[key];
      return "| "+key+" | "+w.completeObservationHours+"/"+w.hours+" | "+
        w.completeAsOfHours+"/"+w.hours+" | "+w.observationGate+" | "+w.asOfGate+" |";
    }),
    "",
    "Latest included completed hour: `"+result.latestHour+"`. Source fingerprint: `"+result.sourceFingerprint+"`.",
    "Missing original hours are **never** reconstructed. This is not research progress, qualification for trial ticks, or approval to restart workers.",
  ];
  await appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join("\n")+"\n");
}
