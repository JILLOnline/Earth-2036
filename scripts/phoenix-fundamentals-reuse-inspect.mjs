#!/usr/bin/env node
// P7A inventories only already-committed, audit-only SEC references. No fetch,
// Git write, research-task execution, score or canonical side effects.
import {readFile,appendFile} from "node:fs/promises";
import {assessFundamentalsReuse} from "./lib/phoenix-fundamentals-reuse.mjs";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const result=assessFundamentalsReuse({
  index:await read("data/runtime/workgraph/shadow/fundamentals-bridge-index.json"),
  health:await read("data/runtime/workgraph/shadow/fundamentals-bridge-health.json"),
  observations:await read("data/runtime/company-observations.json"),
  frontier:await read("data/runtime/workgraph/shadow/closure-frontier.json"),
  baseline:await read("data/baselines/earth2036-official-t0-2026-09-12/manifest.json"),
  systemState:await read("data/runtime/system-state.json"),
});
console.log(JSON.stringify({
  contract:result.contract,asOf:result.asOf,
  historicalEvidenceWindowEnd:result.historicalEvidenceWindowEnd,
  archiveTag:result.archiveTag,summary:result.summary,
  firstFrontierCandidates:result.rows.filter(r=>r.frontierSelected).slice(0,4).map(r=>({
    ticker:r.ticker,liveReferenceVerified:r.liveReferenceVerified,
    factEntries:r.existingFactEntries,
    historicalT0FactEligibility:r.historicalT0FactEligibility,
    remainingFailures:r.namedUnresolvedFailures,
  })),
  authority:result.authority
},null,2));
if(process.env.GITHUB_STEP_SUMMARY){
  const s=result.summary;
  const lines=[
    "## Phoenix P7A — Existing SEC source-reference reuse (audit-only)","",
    "| Measure | Value |","|---|---:|",
    "| Live archived SEC company references verified | "+s.verifiedLiveArchiveCompanies+"/"+s.totalLiveArchiveCompanies+" |",
    "| Remaining T0 backlog company identities | "+s.totalT0BacklogCandidates+" |",
    "| Backlog company SEC descriptors verified | "+s.liveSourceReferencesVerified+"/"+s.totalT0BacklogCandidates+" |",
    "| Existing raw fact entries referenced (not scored) | "+s.rawFactEntriesReferencedForBacklog+" |",
    "| Historically admissible T0 facts certified here | **0** |",
    "",
    "### Current closure frontier (source reuse only)",
    ...result.rows.filter(x=>x.frontierSelected).map(x=>
      "- "+x.ticker+": "+(x.liveReferenceVerified?"valid current SEC reference":"unverified reference")+
      ", historical Sep T0 reconstruction **not done**, "+x.namedUnresolvedFailures.length+" named failures"),
    "",
    "The latest SEC archive is newer than the historical baseline cutoff. This audit is **not a source-admission, changed-filing, Methodology score, task clearance, or canonical promotion**.",
    "No previously safety-rejected source input is retried, no worker is resumed, and no trial tick is qualified."
  ];
  await appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join("\n")+"\n");
}
