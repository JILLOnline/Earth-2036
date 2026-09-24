import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSourceArchiveManifest, validateBootstrapPublication } from "./lib/fundamentals-bootstrap-publication.mjs";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback;
};
const cacheDir = path.resolve(ROOT, arg("--cache-dir", "data/lab/bridge"));
const archiveFile = path.resolve(ROOT, arg("--archive-file"));
const bulkZip = arg("--bulk-zip") ? path.resolve(ROOT, arg("--bulk-zip")) : null;
const releaseTag = arg("--release-tag");
const assetName = arg("--asset-name");
const sourceUrl = arg("--source-url", "https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip");
if (!archiveFile || !releaseTag || !assetName) throw new Error("--archive-file, --release-tag and --asset-name are required");

async function json(file) { return JSON.parse(await readFile(file, "utf8")); }
async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}
async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

const [index, healthBase, cacheManifest, registry, observations] = await Promise.all([
  json(path.join(cacheDir, "current-index.json")),
  json(path.join(ROOT, "data/runtime/workgraph/shadow/fundamentals-bridge-health.json")),
  json(path.join(cacheDir, "cache-manifest.json")),
  json(path.join(ROOT, "data/runtime/entity-registry.json")),
  json(path.join(ROOT, "data/runtime/company-observations.json")),
]);
const archiveSha256 = await sha256(archiveFile);
const bulkZipSha256 = bulkZip ? await sha256(bulkZip) : null;
const archiveManifest = buildSourceArchiveManifest({
  asOf: index.asOf,
  index,
  cacheManifest,
  releaseTag,
  assetName,
  archiveSha256,
  bulkZipSha256,
  sourceUrl,
});
const health = {
  ...healthBase,
  status: "live-bootstrap-verified",
  source: "github-release-archived-verified-bridge-index",
  canonicalWriteAuthority: false,
  sourceArchive: {
    contract: archiveManifest.contract,
    releaseTag,
    assetName,
    archiveSha256,
    sourceSetHash: archiveManifest.sourceSetHash,
    bulkZipSha256,
  },
};
const errors = validateBootstrapPublication({ index, health, archiveManifest, registry, observations });
if (errors.length) {
  console.error(JSON.stringify({ contract: "earth2036-fundamentals-bootstrap-validation-v1", passed: false, errors }, null, 2));
  process.exit(1);
}
await writeJson(path.join(ROOT, "data/runtime/workgraph/shadow/fundamentals-bridge-index.json"), index);
await writeJson(path.join(ROOT, "data/runtime/workgraph/shadow/fundamentals-bridge-health.json"), health);
await writeJson(path.join(ROOT, "data/runtime/workgraph/shadow/fundamentals-source-archive.json"), archiveManifest);
console.log(JSON.stringify({
  contract: "earth2036-fundamentals-bootstrap-validation-v1",
  passed: true,
  asOf: index.asOf,
  companies: health.companies,
  valid: health.valid,
  unknown: health.unknown,
  invalid: health.invalid,
  indexHash: index.indexHash,
  sourceSetHash: archiveManifest.sourceSetHash,
  releaseTag,
  assetName,
  archiveSha256,
}, null, 2));
