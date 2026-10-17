#!/usr/bin/env node
// P3B worker lease accounting is an operational projection only.
// Reuses existing independent hourly account commit; never runs or restarts tasks.
import {readFile,readdir,mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import path from "node:path";
import {buildWorkforceObligations,WORKFORCE_ROLES} from "./lib/phoenix-workforce-obligations.mjs";
import {advanceWorkerLeaseLedger} from "./lib/phoenix-worker-lease.mjs";

const read=async (file,optional=false)=>{
  try{return JSON.parse(await readFile(file,"utf8"));}
  catch(e){if(optional && e.code==="ENOENT")return null;throw new Error("phoenix_lease_missing_or_invalid_input:"+file+":"+e.message);}
};
const workerView="data/runtime/workgraph/worker-view";
const assistViews={},routingViews={};
for(const role of WORKFORCE_ROLES.filter(x=>x!=="chief-earth")){
  [assistViews[role],routingViews[role]]=await Promise.all([
    read(workerView+"/assist/"+role+".json"),read(workerView+"/routing/"+role+".json")
  ]);
}
const dependency=await read("data/runtime/workgraph/source-dependency-handoffs.json");
const reconciliation=await read("data/operations/hourly-reconciliation/latest.json");
const now=reconciliation.checkedAt;
const obligations=buildWorkforceObligations({
  assistViews,routingViews,sourceDependencyHandoffs:dependency,generatedAt:dependency.generatedAt,
});
const root="data/operations/phoenix";
const acknowledgmentDir=path.join(root,"worker-acks");
const files=await readdir(acknowledgmentDir,{withFileTypes:true}).catch(e=>{
  if(e.code==="ENOENT")return [];throw e;
});
if(files.length>1000)throw new Error("phoenix_ack_receipt_count_overflow");
const ackRecords=[];
for(const entry of files.sort((a,b)=>a.name.localeCompare(b.name))){
  if(!entry.isFile()||!entry.name.endsWith(".json"))throw new Error("phoenix_unsafe_ack_entry:"+entry.name);
  const name=path.join(acknowledgmentDir,entry.name);
  const raw=await readFile(name,"utf8");
  if(raw.length>32_768)throw new Error("phoenix_ack_receipt_too_large:"+entry.name);
  ackRecords.push({data:JSON.parse(raw),
    origin:{path:name.replaceAll("\\","/"),byteSha256:createHash("sha256").update(raw).digest("hex")}});
}
const old=await read(root+"/worker-leases.json",true);
const report=advanceWorkerLeaseLedger(obligations,old,ackRecords,now);
const out=JSON.stringify(report,null,2)+"\n";
if(out!== (old?JSON.stringify(old,null,2)+"\n":null)){
  await mkdir(root,{recursive:true});
  await writeFile(root+"/worker-leases.json",out,"utf8");
}
console.log(JSON.stringify({
  contract:report.contract,mode:report.mode,at:report.observedAt,
  total:report.count,byStatus:report.byStatus,
  note:"No task state assertions, source approvals, worker restarts or canonical writes."
}));
