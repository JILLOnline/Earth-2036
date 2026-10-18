// Read-only reconciliation before canonical trial finalization.
// The GitHub scheduler persists all data/ changes in one Git commit, but a
// partial local process failure must never be mistaken for a qualified tick.
export function auditTrialTickHistory({state,manifest,ticks=[]}={}){
 const errors=[];
 const sc=state?.qualifiedTrialTicks,mc=manifest?.qualifiedTrialTicksAfterBaseline;
 if(!Number.isInteger(sc)||!Number.isInteger(mc)||sc<0||mc<0||sc>1000||mc>1000||sc!==mc)
   errors.push("authoritative_trial_count_mismatch");
 if(sc>0 && manifest?.published!==true)
   errors.push("unpublished_baseline_has_qualified_ticks");
 if(sc>0 && state?.phase==="official_t0_baseline")
   errors.push("qualified_ticks_while_still_in_baseline_phase");
 const seenNumbers=new Set(),seenCycles=new Set();
 const sorted=[...ticks].sort((a,b)=>(a.tickNumber??0)-(b.tickNumber??0));
 for(const [i,tick] of sorted.entries()){
  if(!Number.isInteger(tick?.tickNumber)||tick.tickNumber!==i+1 ||
    tick.tickNumber>1000)errors.push("tick_number_gap_or_overflow");
  if(typeof tick?.cycleKey!=="string"||!/^\d{8}T\d{2}00Z$/.test(tick.cycleKey)||
    seenCycles.has(tick.cycleKey))errors.push("invalid_or_duplicate_cycle");
  if(seenNumbers.has(tick?.tickNumber))errors.push("duplicate_tick_number");
  if(i>0&&sorted[i-1].cycleKey>=tick.cycleKey)errors.push("nonmonotonic_trial_cycle");
  seenNumbers.add(tick?.tickNumber);seenCycles.add(tick?.cycleKey);
 }
 if(ticks.length!==sc)errors.push("immutable_tick_file_count_mismatch");
 if(sc>0 && sorted.at(-1)?.cycleKey!==state?.lastQualifiedCycleKey)
   errors.push("last_qualified_cycle_mismatch");
 if(sc===0 && state?.lastQualifiedCycleKey)errors.push("zero_count_with_qualified_cycle");
 if(sc===1000 && (state?.phase!=="trial_complete_awaiting_review" ||
   manifest?.trialStatus!=="complete_awaiting_review")) errors.push("trial_terminal_phase_inconsistent");
 if(sc<1000 && state?.phase==="trial_complete_awaiting_review")
   errors.push("trial_completed_prematurely");
 return {passed:errors.length===0,errors:[...new Set(errors)],qualifiedTicks:sc,
  immutableTickFiles:ticks.length,canonicalWriteAuthorized:false};
}
