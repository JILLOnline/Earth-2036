#!/usr/bin/env node
// No network, no source mutation, no forecast inference: stdout only.
import {readFile,readdir} from "node:fs/promises";
import path from "node:path";
import {buildTrialReviewReport} from "./lib/trial-review-report.mjs";
const root=process.cwd();
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const state=await read("data/runtime/system-state.json");
const manifest=await read("data/baselines/earth2036-official-t0-2026-09-12/manifest.json");
const dir=path.join(root,"data/runtime/ticks");
let files=[];
try {files=await readdir(dir,{withFileTypes:true})}catch(e){if(e.code!=="ENOENT")throw e}
const ticks=[];
for(const f of files){
 if(!f.isFile()||!/^\d{8}T\d{2}00Z\.json$/.test(f.name))throw Error("unexpected_tick_path:"+f.name);
 const tick=JSON.parse(await readFile(path.join(dir,f.name),"utf8"));
 if(tick.cycleKey+".json"!==f.name)throw Error("tick_identity_mismatch");
 ticks.push(tick);
}
const report=buildTrialReviewReport({manifest,state,ticks,generatedAt:new Date().toISOString()});
console.log(JSON.stringify(report,null,2));
if(!report.historyPassed)process.exitCode=1;
