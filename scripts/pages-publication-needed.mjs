#!/usr/bin/env node
// Fail-open for publication ONLY: an unavailable manifest or Git input can
// request a Pages build but can NEVER approve research/scoring/history.
import { execFileSync } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { classifyPushChanges, decidePublication, FULL_SHA, PUBLICATION_POLICY } from "./lib/pages-publication-policy.mjs";

const args = process.argv.slice(2);
const option = name => { const i=args.indexOf("--"+name); return i>=0?args[i+1]:""; };
const run = (cmd,argv) => execFileSync(cmd,argv,{encoding:"utf8",timeout:25000,maxBuffer:1024*1024}).trim();
const resolve = value => run("git",["rev-parse","--verify",value+"^{commit}"]);
const changed = (a,b) => run("git",["diff","--name-only","--no-ext-diff",a,b]).split("\n").filter(Boolean);
const mode=option("mode");
let decision, target=null;
if(mode==="push") {
  try { decision=classifyPushChanges(changed(option("base")||"HEAD^",option("target")||"HEAD")); }
  catch (error) { decision={needed:true,reason:"push_change_diff_unavailable",error:String(error.message).slice(0,150)}; }
} else if(mode==="live") {
  target=option("target");
  if(!FULL_SHA.test(target||"")) throw new Error("invalid_main_sha_for_pages");
  const site=option("pages-url");
  let manifest=null;
  try {
    if(!site || !/^https:\/\//.test(site)) throw new Error("github_pages_url_unavailable");
    const url=new URL("earth2036-deploy.json",site.endsWith("/")?site:site+"/");
    const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{"cache-control":"no-cache"}});
    if(!response.ok) throw new Error("published_manifest_http_"+response.status);
    const raw=await response.text();
    if(raw.length>8192)throw new Error("oversized_published_manifest");
    manifest=JSON.parse(raw);
  } catch(e) {
    console.error("Phoenix Pages provenance unavailable; conservatively publish: "+String(e.message).slice(0,200));
  }
  let paths=null, verified=false;
  if(manifest && FULL_SHA.test(manifest.sourceSha||"") && manifest.sourceSha!==target) {
    try {
      for(const sha of [target,manifest.sourceSha]){
        try {resolve(sha);} catch {run("git",["fetch","--no-tags","--depth=1","origin",sha]);resolve(sha);}
      }
      paths=changed(manifest.sourceSha,target);
      verified=true;
    } catch(e) {
      console.error("Phoenix source diff unavailable; conservatively publish: "+String(e.message).slice(0,200));
    }
  }
  decision=decidePublication({targetSha:target,manifest,changedPaths:paths,diffVerified:verified});
} else throw new Error("expected_--mode_push_or_live");

const summary={contract:PUBLICATION_POLICY,mode,target, ...decision,
  warning:"No authority to write scores, research evidence, qualified ticks or historical observations."};
console.log(JSON.stringify(summary));
if(process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT,"needed="+String(decision.needed)+"\nreason="+decision.reason+"\n","utf8");
}
