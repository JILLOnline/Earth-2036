import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("watchdog checks committed trial history before recovering missing scheduler slot",async()=>{
 const y=await readFile(new URL("../.github/workflows/earth2036-watchdog.yml",import.meta.url),"utf8");
 const audit=y.indexOf("node scripts/audit-trial-persistence.mjs");
 const recovery=y.indexOf("Recover a missing current-hour scheduler slot when idle");
 assert.ok(audit>0 && recovery>audit);
 assert.match(y,/id: trial_persistence[\s\S]*node scripts\/audit-trial-persistence\.mjs/);
 assert.match(y,/Recover a missing current-hour scheduler slot when idle\n        if: success\(\)/);
});
test("watchdog persistence check is read-only and cannot auto-override evidence holds",async()=>{
 const y=await readFile(new URL("../.github/workflows/earth2036-watchdog.yml",import.meta.url),"utf8");
 const segment=y.split("Verify committed trial persistence before automatic scheduler recovery")[1].split("Recover a missing current-hour scheduler slot when idle")[0];
 assert.doesNotMatch(segment,/gh workflow run|git push|git commit|writeFile|worker.restart/);
});
