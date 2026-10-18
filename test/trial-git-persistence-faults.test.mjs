import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,writeFile,rm,chmod} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";

function git(cwd,...args){
 const r=spawnSync("git",args,{cwd,encoding:"utf8",timeout:10000});
 if(r.error||r.status!==0)throw Error("git "+args.join(" ")+" failed: "+(r.stderr||r.error));
 return r.stdout.trim();
}
function attempt(cwd,...args){
 return spawnSync("git",args,{cwd,encoding:"utf8",timeout:10000});
}
async function setup(){
 const root=await mkdtemp(path.join(tmpdir(),"earth2036-push-race-"));
 const remote=path.join(root,"origin.git"),seed=path.join(root,"seed");
 const writer=path.join(root,"writer"),competitor=path.join(root,"competitor");
 await mkdir(seed);
 git(root,"init","--bare","--initial-branch=main",remote);
 git(seed,"init","--initial-branch=main");
 git(seed,"config","user.name","Earth2036 Synthetic Test");
 git(seed,"config","user.email","synthetic-test@example.invalid");
 await writeFile(path.join(seed,"seed.txt"),"initial\n");
 git(seed,"add",".");git(seed,"commit","-m","bootstrap");
 git(seed,"remote","add","origin",remote);
 git(seed,"push","-u","origin","main");
 git(root,"clone","--branch","main",remote,writer);
 git(root,"clone","--branch","main",remote,competitor);
 for(const cwd of [writer,competitor]){
  git(cwd,"config","user.name","Earth2036 Synthetic Test");
  git(cwd,"config","user.email","synthetic-test@example.invalid");
 }
 return {root,remote,writer,competitor};
}
async function writeTick(dir,text){
 const target=path.join(dir,"data","runtime","synthetic-tick.json");
 await mkdir(path.dirname(target),{recursive:true});await writeFile(target,JSON.stringify({cycleKey:"20261017T2200Z",text})+"\n");
 git(dir,"add","data");
 git(dir,"commit","-m","synthetic machine cycle");
}
async function rivalUpdate(dir,tag){
 const target=path.join(dir,"data","operations","competing-write.json");
 await mkdir(path.dirname(target),{recursive:true});
 await writeFile(target,JSON.stringify({tag})+"\n");
 git(dir,"add","data");
 git(dir,"commit","-m","independent competitor");
 git(dir,"push","origin","HEAD:main");
}
test("pre-commit remote movement causes recompute without losing concurrent records",{timeout:30000},async()=>{
 const s=await setup();
 try{
  const base=git(s.writer,"rev-parse","HEAD");
  await writeTick(s.writer,"discarded-local-cycle");
  await rivalUpdate(s.competitor,"worker-reconcile");
  git(s.writer,"fetch","origin","main");
  const remote=git(s.writer,"rev-parse","origin/main");
  assert.notEqual(base,remote);
  git(s.writer,"reset","--hard","origin/main");
  assert.equal(attempt(s.writer,"ls-files","data/runtime/synthetic-tick.json").stdout.trim(),"");
  await writeTick(s.writer,"recomputed");
  git(s.writer,"push","origin","HEAD:main");
  assert.match(git(s.writer,"show","HEAD:data/operations/competing-write.json"),/worker-reconcile/);
  assert.match(git(s.writer,"show","HEAD:data/runtime/synthetic-tick.json"),/recomputed/);
 }finally{await rm(s.root,{recursive:true,force:true})}
});
test("non-fast-forward push is rejected; reset-and-recompute succeeds",{timeout:30000},async()=>{
 const s=await setup();
 try{
  await writeTick(s.writer,"first-attempt");
  await rivalUpdate(s.competitor,"late-race");
  const blocked=attempt(s.writer,"push","origin","HEAD:main");
  assert.notEqual(blocked.status,0,"stale writer unexpectedly overwrote main");
  git(s.writer,"fetch","origin","main");
  git(s.writer,"reset","--hard","origin/main");
  await writeTick(s.writer,"replayed-from-new-truth");
  git(s.writer,"push","origin","HEAD:main");
  assert.match(git(s.writer,"show","HEAD:data/operations/competing-write.json"),/late-race/);
  assert.match(git(s.writer,"show","HEAD:data/runtime/synthetic-tick.json"),/replayed-from-new-truth/);
 }finally{await rm(s.root,{recursive:true,force:true})}
});
test("rejected remote write leaves canonical branch unchanged",{timeout:30000},async()=>{
 const s=await setup();
 try{
  const before=git(s.writer,"ls-remote","origin","refs/heads/main").split(/\s+/)[0];
  const hook=path.join(s.remote,"hooks","pre-receive");
  await writeFile(hook,"#!/bin/sh\necho synthetic-write-denial >&2\nexit 1\n");
  await chmod(hook,0o755);
  await writeTick(s.writer,"blocked-write");
  const denial=attempt(s.writer,"push","origin","HEAD:main");
  assert.notEqual(denial.status,0);
  const after=git(s.writer,"ls-remote","origin","refs/heads/main").split(/\s+/)[0];
  assert.equal(after,before);
 }finally{await rm(s.root,{recursive:true,force:true})}
});
