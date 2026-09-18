import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const RUNTIME_DIR = path.join(ROOT, "data", "runtime");

async function readJson(name, fallback) {
  try { return JSON.parse(await readFile(path.join(RUNTIME_DIR, name), "utf8")); }
  catch { return fallback; }
}

async function writeJson(name, value) {
  await writeFile(path.join(RUNTIME_DIR, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isDirectoryFooter(value) {
  return String(value ?? "").trim().toUpperCase().startsWith("FILE CREATION TIME");
}

function isValidListing(row) {
  return Boolean(row && row.symbol && !isDirectoryFooter(row.symbol));
}

function isValidDiscovery(row) {
  if (!row || !row.ticker || isDirectoryFooter(row.ticker)) return false;
  if (row.detectionSource === "official-symbol-directory" && (!String(row.company ?? "").trim() || !String(row.exchange ?? "").trim())) return false;
  return true;
}

const listing = await readJson("listing-snapshot.json", null);
const discovery = await readJson("discovery-pool.json", null);
let removedListings = 0;
let removedDiscoveries = 0;

if (listing && Array.isArray(listing.symbols)) {
  const clean = listing.symbols.filter(isValidListing);
  removedListings = listing.symbols.length - clean.length;
  if (removedListings) await writeJson("listing-snapshot.json", { ...listing, symbols: clean });
}

if (discovery && Array.isArray(discovery.items)) {
  const clean = discovery.items.filter(isValidDiscovery);
  removedDiscoveries = discovery.items.length - clean.length;
  if (removedDiscoveries) await writeJson("discovery-pool.json", { ...discovery, items: clean });
}

console.log(JSON.stringify({ removedListings, removedDiscoveries }));
