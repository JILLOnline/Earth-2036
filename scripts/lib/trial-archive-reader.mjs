// Shared, bounded, read-only loader for production and isolated trial rehearsals.
// A --root override is explicit and never changes GitHub canonical authority.
import {readFile,readdir,stat} from "node:fs/promises";
import path from "node:path";

export function trialArchiveRoot(argv=process.argv.slice(2),cwd=process.cwd()){
 if(argv.length===0)return cwd;
 if(argv.length===2&&argv[0]==="--root"&&argv[1]&&argv[1]!=="--root")
  return path.resolve(argv[1]);
 throw new Error("Usage: node <trial-audit-or-report> [--root <isolated-checkout>]");
}

export async function readTrialArchive(root){
 const read=async name=>JSON.parse(await readFile(path.join(root,name),"utf8"));
 const [state,manifest]=await Promise.all([
  read("data/runtime/system-state.json"),
  read("data/baselines/earth2036-official-t0-2026-09-12/manifest.json"),
 ]);
 const dir=path.join(root,"data/runtime/ticks");
 let files=[];
 try {files=await readdir(dir,{withFileTypes:true})}
 catch(e){if(e.code!=="ENOENT")throw e}
 if(files.length>1000)throw Error("immutable_tick_archive_exceeds_trial_limit");
 const ticks=[];
 for(const file of files){
  if(!file.isFile()||!/^\d{8}T\d{2}00Z\.json$/.test(file.name))
   throw Error("unexpected_immutable_tick_path:"+file.name);
  const filename=path.join(dir,file.name);
  if((await stat(filename)).size>16*1024*1024)
   throw Error("immutable_tick_payload_too_large:"+file.name);
  const tick=JSON.parse(await readFile(filename,"utf8"));
  if(tick?.cycleKey+".json"!==file.name)
   throw Error("immutable_tick_filename_identity_mismatch:"+file.name);
  ticks.push(tick);
 }
 return {state,manifest,ticks};
}
