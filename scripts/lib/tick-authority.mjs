// All official hourly tick persistence is owned by finalize-qualified-tick.mjs.
// This guard prevents silent overwrites, duplicate increments, and count drift.
export function determineTickFinalization({ cycleKey, qualified, state, manifest, existingTick }) {
  if (!/^\d{8}T\d{2}00Z$/.test(cycleKey || "")) throw new Error("Invalid canonical tick cycle key");
  const stateCount = Number(state?.qualifiedTrialTicks ?? 0);
  const manifestCount = Number(manifest?.qualifiedTrialTicksAfterBaseline ?? 0);
  const previousCycle = state?.lastQualifiedCycleKey || null;
  if (!Number.isInteger(stateCount) || stateCount < 0 ||
      !Number.isInteger(manifestCount) || manifestCount < 0) {
    throw new Error("Invalid historical qualified tick counters");
  }
  if (existingTick !== null && existingTick !== undefined) {
    if (existingTick.cycleKey !== cycleKey ||
        !Number.isInteger(existingTick.tickNumber) ||
        existingTick.tickNumber < 1) {
      throw new Error("Existing immutable tick has conflicting identity");
    }
    if (previousCycle === cycleKey &&
        stateCount === existingTick.tickNumber &&
        manifestCount === existingTick.tickNumber) {
      return {action:"already_finalized",tickNumber:stateCount};
    }
    throw new Error("Existing immutable tick is not reconciled with authoritative counters");
  }
  if (previousCycle === cycleKey) {
    throw new Error("State claims qualified hour without immutable tick file");
  }
  if (stateCount !== manifestCount) {
    throw new Error("State and baseline manifest trial counts disagree");
  }
  if (!qualified) return {action:"not_qualified",tickNumber:stateCount};
  return {action:"finalize",tickNumber:stateCount+1};
}
