import { createHash } from "node:crypto";

// GitHub Pages v1 public-input guard. Deliberately conservative: unknown paths
// always require publication, while *only* known operational-only files can
// be ignored. This never makes score, T0, worker, or observation decisions.
export const PUBLICATION_POLICY = "earth2036-phoenix-pages-publication-v1";
export const FULL_SHA = /^[a-f0-9]{40}$/;
const NONPUBLIC = [
  /^\.github\/(?!workflows\/earth2036-pages\.yml$)/,
  /^docs\//,
  /^test\//,
  /^data\/operations\//,
  /^scripts\/phoenix-(?:inspect|journal)\.mjs$/,
  /^scripts\/pages-publication-needed\.mjs$/,
  /^scripts\/lib\/phoenix-(?:control-plane|incident-journal)\.mjs$/,
  /^scripts\/lib\/pages-publication-policy\.mjs$/,
  /^README\.md$/,
  /^MIGRATION_SOURCE\.md$/,
  /^\.gitignore$/,
];
export const isPublicInput = file => typeof file !== "string" || !file ||
  !NONPUBLIC.some(re => re.test(file));

export function decidePublication({targetSha, manifest=null, changedPaths=null, diffVerified=false}) {
  if (!FULL_SHA.test(targetSha || "")) throw new Error("invalid_publication_target_sha");
  if (!manifest || typeof manifest !== "object") {
    return {needed:true, reason:"published_provenance_unavailable"};
  }
  const sourceSha=manifest.sourceSha;
  if (!FULL_SHA.test(sourceSha || "") ||
      manifest.sourceBranch !== "main" ||
      manifest.authority !== "JILLOnline/Earth-2036@main" ||
      manifest.host !== "github-pages") {
    return {needed:true,reason:"published_provenance_untrusted"};
  }
  if (targetSha === sourceSha) {
    return {needed:false,reason:"same_published_source_sha",publishedSha:sourceSha};
  }
  if (!diffVerified || !Array.isArray(changedPaths)) {
    return {needed:true,reason:"source_diff_unverified",publishedSha:sourceSha};
  }
  const relevant=changedPaths.filter(isPublicInput);
  return {
    needed: relevant.length > 0,
    reason: relevant.length ? "public_inputs_changed" : "operational_only_commits",
    publishedSha:sourceSha, relevantPaths:relevant.slice(0,12),
    changedPathCount:changedPaths.length,
    fingerprint:createHash("sha256").update(JSON.stringify(changedPaths)).digest("hex").slice(0,16),
  };
}

export function classifyPushChanges(paths) {
  if (!Array.isArray(paths) || paths.some(p=>typeof p !== "string"))
    return { needed:true, reason:"change_list_unverified" };
  return {needed:paths.some(isPublicInput),reason:paths.some(isPublicInput) ? "public_inputs_changed" : "operational_only_commits",changedPathCount:paths.length};
}
