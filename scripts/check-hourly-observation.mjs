#!/usr/bin/env node
// Read-only guard: a completed or partial genuine UTC observation already
// persisted in append-only cycle-history must not be fabricated or rerun.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const FORMAT=/^\d{8}T\d{2}00Z$/;
export function classifyPersistedHourlyObservation(history, hourKey) {
  if (!FORMAT.test(hourKey)) throw new Error('invalid_hour_key');
  const hour=Number(hourKey.slice(9,11));
  const reconstructed=new Date(hourKey.slice(0,4)+'-'+hourKey.slice(4,6)+'-'+hourKey.slice(6,8)+'T'+hourKey.slice(9,11)+':00:00.000Z');
  if(!Number.isFinite(reconstructed.getTime())||reconstructed.getUTCHours()!==hour||
      reconstructed.toISOString().slice(0,13).replace(/[-:]/g,'')+'00Z'!==hourKey)throw new Error('invalid_utc_hour');
  const matches=[];
  for (const [index,line] of String(history).split(/\r?\n/).entries()){
    if(!line.trim())continue;
    let row;try{row=JSON.parse(line)}catch{throw new Error('corrupt_cycle_history_line_'+(index+1))}
    if(!row||typeof row.cycleKey!=='string')throw new Error('invalid_cycle_history_line_'+(index+1));
    if(row.cycleKey===hourKey)matches.push({status:row.cycleStatus??null,observedAt:row.lastCycleAt??null,line:index+1});
  }
  if(matches.length>1)throw new Error('duplicate_immutable_observation_for_hour');
  return matches.length?{shouldRun:false,reason:'persisted_original_observation_exists',observation:matches[0]}
   :{shouldRun:true,reason:'no_original_observation_record',observation:null};
}
async function main(){
  const hourKey=process.argv[2];
  const file=resolve('data/runtime/cycle-history.jsonl');
  const history=await readFile(file,'utf8'); // Missing history is not proof of safety.
  const outcome=classifyPersistedHourlyObservation(history,hourKey);
  console.log(JSON.stringify({hourKey,...outcome}));
  // returns 0 for existing observation, 2 for missing, 1 for invalid/corrupt.
  process.exitCode=outcome.shouldRun?2:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
main().catch(e=>{console.error('hourly_observation_guard_failed:'+e.message);process.exitCode=1});
}
