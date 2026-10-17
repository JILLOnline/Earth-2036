#!/usr/bin/env node
// Read-only persistence preflight, separate from the finalizer. No recovery writes.
import {readFile,readdir} from "node:fs/promises";
import path from "node:path";
import {auditTrialTickHistory} from "./lib/trial-tick-history-audit.mjs";
const root=process.cwd();
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const state=await read("data/runtime/system-state.json");
const manifest=await read("data/baselines/earth2036-official-t0-2026-09-12/manifest.json");
const dir=path.join(root,"data/runtime/ticks");
let names=[];
try {names=await readdir(dir,{withFileTypes:true})}catch(e){if(e.code!=="ENOENT")throw e}
const ticks=[];
for(const entry of names){
 if(!entry.isFile()||!/^\d{8}T\d{2}00Z\.json$/.test(entry.name))
  throw new Error("Unexpected immutable tick path: "+entry.name);
 const tick=JSON.parse(await readFile(path.join(dir,entry.name),"utf8"));
 if(tick.cycleKey+".json"!==entry.name)throw new Error("Immutable tick filename identity mismatch");
 ticks.push(tick);
}
const audit=auditTrialTickHistory({state,manifest,ticks});
console.log(JSON.stringify({contract:"earth2036-trial-persistence-preflight-v1",...audit}));
if(!audit.passed)process.exitCode=1;
