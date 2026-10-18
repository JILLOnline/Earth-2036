import {createHash} from "node:crypto";

// Canonical, deterministic serialization of immutable trial tick bytes.
// Used only for audit integrity; does not grant evidence or score authority.
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value && typeof value==="object"){
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
 }
 return value;
}
export function trialTickHash(record){
 const payload={...record};
 delete payload.tickRecordHash;
 return createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex");
}
export function sealTrialTick(record,previousTickHash=null){
 if(record?.tickRecordHash!==undefined)throw Error("presealed_tick_record_forbidden");
 if(previousTickHash!==null && !/^[a-f0-9]{64}$/.test(previousTickHash))
  throw Error("invalid_previous_tick_seal");
 const payload={...record,previousTickHash};
 return {...payload,tickRecordHash:trialTickHash(payload)};
}
export function validateTrialTickSeal(record,expectedPreviousHash){
 if(!record || typeof record!=="object" || 
  !/^[a-f0-9]{64}$/.test(record.tickRecordHash||""))
  return "missing_or_invalid_tick_seal";
 if(record.previousTickHash!==expectedPreviousHash)
  return "trial_tick_hash_chain_break";
 if(trialTickHash(record)!==record.tickRecordHash)
  return "trial_tick_content_hash_mismatch";
 return null;
}
