import {createHash, createPublicKey, verify as verifySignature} from "node:crypto";

export const CHIEF_AUTHORITY_CONTRACT="earth2036-chief-adjudication-authority-v1";
export const CHIEF_DECISION_CONTRACT="earth2036-chief-adjudication-v1";
export const CHIEF_SIGNING_POLICY="signed-packet-specific-chief-adjudication-v1";
export const MAX_CHIEF_DECISION_AGE_MS=72*60*60*1000;
const hexSha=value=>typeof value==="string" && /^[a-f0-9]{64}$/.test(value);
const time=value=>{
  const parsed=Date.parse(value||"");
  return Number.isFinite(parsed)?parsed:null;
};
const deny=(reason)=>({approved:false,reason,approvalProof:null});
const identity=t=>typeof t==="string" && /^[A-Z][A-Z0-9.-]{0,11}$/.test(t);

export function chiefSignableFields(decision) {
  return {
    contract:CHIEF_DECISION_CONTRACT,
    version:1,
    role:"chief-earth",
    action:decision.action,
    ticker:decision.ticker,
    workId:decision.workId,
    packetSha256:decision.packetSha256,
    packetGeneratedAt:decision.packetGeneratedAt,
    approvedAt:decision.approvedAt,
    expiresAt:decision.expiresAt,
  };
}

export function authorizeChiefPromotion({packet,packetBytes,authority,decision,now}) {
  // Disable by default, including if config is missing/malformed or keys are absent.
  if (authority?.contract!==CHIEF_AUTHORITY_CONTRACT || authority?.version!==1 ||
      authority.enabled!==true || authority.role!=="chief-earth" ||
      authority.policy!==CHIEF_SIGNING_POLICY)
    return deny("chief_signing_authority_not_commissioned");
  if(typeof authority.keyId!=="string" || !authority.keyId.trim() ||
     typeof authority.publicKeyPem!=="string" || !authority.publicKeyPem.includes("BEGIN PUBLIC KEY"))
    return deny("chief_public_key_unavailable");
  if(!packet || !identity(packet.ticker) || typeof packet.workId!=="string" ||
     packet.preflight?.passed!==true || !packetBytes || typeof packetBytes!=="string")
    return deny("invalid_preflight_passed_packet");
  if(!decision)return deny("chief_signed_adjudication_missing");
  if(decision.contract!==CHIEF_DECISION_CONTRACT || decision.version!==1 ||
    decision.role!=="chief-earth" || decision.keyId!==authority.keyId ||
    !["accept","reject"].includes(decision.action) || !identity(decision.ticker) ||
    decision.ticker!==packet.ticker || decision.workId!==packet.workId)
    return deny("chief_decision_identity_or_action_mismatch");
  const digest=createHash("sha256").update(packetBytes,"utf8").digest("hex");
  if(!hexSha(decision.packetSha256) || digest!==decision.packetSha256 ||
     decision.packetGeneratedAt!==packet.generatedAt)
    return deny("chief_packet_digest_mismatch");
  const approved=time(decision.approvedAt), expires=time(decision.expiresAt),
        packetAt=time(packet.generatedAt), current=time(now);
  if([approved,expires,packetAt,current].some(v=>v===null) ||
     approved<packetAt || approved>current+60_000 || current>=expires ||
     expires<=approved || expires-approved>MAX_CHIEF_DECISION_AGE_MS ||
     current-approved>MAX_CHIEF_DECISION_AGE_MS)
    return deny("chief_decision_time_window_invalid");
  if(typeof decision.signature!=="string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(decision.signature) ||
     decision.signature.length>2048)
    return deny("chief_signature_missing_or_invalid");
  let valid=false;
  try{
    const pub=createPublicKey(authority.publicKeyPem);
    if(pub.asymmetricKeyType!=="ed25519")return deny("chief_signing_key_type_not_ed25519");
    const fields=chiefSignableFields(decision);
    valid=verifySignature(null,Buffer.from(JSON.stringify(fields),"utf8"),pub,Buffer.from(decision.signature,"base64"));
  }catch{return deny("chief_signature_verification_error");}
  if(!valid)return deny("chief_signature_verification_failed");
  if(decision.action!=="accept")return deny("chief_explicitly_rejected_packet");
  return {approved:true,reason:null,
    approvalProof:{
      contract:CHIEF_DECISION_CONTRACT,signingPolicy:CHIEF_SIGNING_POLICY,
      keyId:authority.keyId,role:"chief-earth",ticker:packet.ticker,
      workId:packet.workId,packetSha256:digest,
      approvedAt:decision.approvedAt,expiresAt:decision.expiresAt,
      decisionSha256:createHash("sha256").update(JSON.stringify(decision)).digest("hex")
    }};
}
