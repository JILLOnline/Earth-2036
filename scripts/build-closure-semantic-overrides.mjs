import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT=process.cwd();
const packetDir=path.join(ROOT,"data/runtime/workgraph/packets");
const outPath=path.join(ROOT,"data/runtime/workgraph/worker-view/semantic-overrides.json");
const files=(await readdir(packetDir)).filter(x=>x.endsWith(".json"));
const overrides=[];
const alphaTerms=/(underwriting|valuation|governance|capital allocation|score|component calibration|pricing power|supply.chain|factor evidence|confidence evidence|risk evidence)/i;
for(const file of files){
 const p=JSON.parse(await readFile(path.join(packetDir,file),"utf8"));
 const failures=p?.preflight?.failures||[];
 const routes=p?.preflight?.routing||[];
 const evidence=p?.scoreReadiness?.sourceAddressedEvidence||{};
 const gateConsumption=[];
 if(failures.includes("missing_data_confidence_evidence")&&evidence.dataConfidenceEvidenceComplete===true) gateConsumption.push("missing_data_confidence_evidence");
 if(failures.includes("missing_factor_evidence")&&evidence.factorEvidenceComplete===true) gateConsumption.push("missing_factor_evidence");
 if(failures.includes("missing_score_risk_evidence")&&evidence.riskEvidenceComplete===true) gateConsumption.push("missing_score_risk_evidence");
 const semanticInputs=[...(p.gatingIssues||[]),...(p.unknowns||[]).filter(u=>u?.gating===true).map(u=>typeof u==="string"?u:JSON.stringify(u))];
 const semanticAlpha=semanticInputs.filter(x=>alphaTerms.test(String(x)));
 const resolverOnly=routes.length>0&&routes.every(r=>r.owner==="deep-resolver");
 const material=(p.contradictions||[]).some(c=>c&&c.resolved!==true&&c.gating!==false&&c.material!==false&&!String(c.disposition||c.resolutionStatus||"").toLowerCase().startsWith("resolved"));
 if(gateConsumption.length|| (resolverOnly&&semanticAlpha.length&&!material)){
  overrides.push({
   ticker:p.ticker,
   state:p.sourceState,
   packetPath:`data/runtime/workgraph/packets/${p.ticker}.json`,
   gateConsumptionFaults:gateConsumption,
   semanticAlphaWork:semanticAlpha,
   suppressResolver:resolverOnly&&semanticAlpha.length>0&&!material,
   addAlpha:resolverOnly&&semanticAlpha.length>0&&!material,
   reason:gateConsumption.length?"packet_truth_conflicts_with_derived_preflight":"generic resolver gate masks Alpha-owned underwriting work",
   authority:"operational-routing-only; never canonical; never weakens a gate"
  });
 }
}
const report={version:1,contract:"earth2036-closure-semantic-overrides-v1",generatedAt:new Date().toISOString(),canonicalWriteAuthority:false,count:overrides.length,overrides};
await mkdir(path.dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(report,null,2)+"\n","utf8");
console.log(JSON.stringify(report,null,2));
