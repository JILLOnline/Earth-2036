import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("scheduler runs independent tick history preflight before committing canonical data",async()=>{
 const file=await readFile(new URL("../.github/workflows/earth2036-scheduler.yml",import.meta.url),"utf8");
 const preflight=file.indexOf("node scripts/audit-trial-persistence.mjs");
 const commit=file.indexOf('git add data');
 assert.ok(preflight>0&&commit>preflight);
});
test("persistence preflight makes no evidence or canonical writes",async()=>{
 const file=await readFile(new URL("../scripts/audit-trial-persistence.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(file,/writeFile|appendFile|spawn\(|execFile\(/);
 assert.match(file,/auditTrialTickHistory/);
});
