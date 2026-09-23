import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function safeSegment(value){
  return String(value ?? "unknown").replace(/[^A-Za-z0-9._-]+/g,"_");
}

export function fundamentalsSnapshotPath(root, truth){
  return path.join(
    root,
    safeSegment(truth?.ticker),
    safeSegment(truth?.asOf),
    safeSegment(truth?.truthHash) + ".json"
  );
}

export async function writeImmutableFundamentalsSnapshot(root, truth){
  const file=fundamentalsSnapshotPath(root,truth);
  await mkdir(path.dirname(file),{recursive:true});
  try{
    await writeFile(file,JSON.stringify(truth,null,2)+"\n",{encoding:"utf8",flag:"wx"});
    return {file,written:true,reused:false};
  }catch(error){
    if(error?.code!=="EEXIST") throw error;
    const existing=JSON.parse(await readFile(file,"utf8"));
    if(existing?.truthHash!==truth?.truthHash){
      throw new Error("immutable fundamentals snapshot collision: "+file);
    }
    return {file,written:false,reused:true};
  }
}
