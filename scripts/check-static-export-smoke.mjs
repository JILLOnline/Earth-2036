import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "out");
const BASE = "/Earth-2036/";

async function exists(file) {
  try { await stat(file); return true; } catch { return false; }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

function internalTarget(url) {
  if (!url.startsWith(BASE)) return null;
  const clean = url.slice(BASE.length).split(/[?#]/, 1)[0];
  if (!clean) return path.join(OUT, "index.html");
  const target = path.join(OUT, clean);
  return clean.endsWith("/") ? path.join(target, "index.html") : target;
}

const required = [
  "index.html",
  "contenders/index.html",
  "discovery/index.html",
  "system/index.html",
  "ledger/index.html",
  "live/system-state.json",
  "live/current-ranking.json",
  "live/source-health.json",
  "live/intelligence-integrity.json",
  "live/score-state.json",
];
const errors = [];
for (const relative of required) {
  if (!await exists(path.join(OUT, relative))) errors.push(`missing_required_export:${relative}`);
}

const all = await walk(OUT);
const htmlFiles = all.filter((file) => file.endsWith(".html"));
const companyPages = htmlFiles.filter((file) => /\/company\/[^/]+\/index\.html$/.test(file));
if (companyPages.length !== 250) errors.push(`company_page_count:${companyPages.length}/250`);

let internalRefs = 0;
for (const file of htmlFiles) {
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const target = internalTarget(match[1]);
    if (!target) continue;
    internalRefs += 1;
    if (!await exists(target)) {
      errors.push(`missing_internal_ref:${path.relative(OUT, file)}->${match[1]}`);
      if (errors.length > 50) break;
    }
  }
  if (errors.length > 50) break;
}
if (internalRefs < 1000) errors.push(`suspicious_internal_ref_count:${internalRefs}`);

const home = await readFile(path.join(OUT, "index.html"), "utf8");
for (const route of ["contenders/", "discovery/", "system/", "ledger/"]) {
  if (!home.includes(`${BASE}${route}`)) errors.push(`home_navigation_missing:${route}`);
}

const system = await readFile(path.join(OUT, "system/index.html"), "utf8");
if (!/TRAJECTORY FUNDAMENTALS/i.test(system)) errors.push("system_fundamentals_panel_missing");

const jsFiles = all.filter((file) => file.endsWith(".js"));
let jsText = "";
for (const file of jsFiles) {
  const text = await readFile(file, "utf8");
  if (/show more|back to top|scrollTo/i.test(text)) jsText += "\n" + text;
}
if (!/show more/i.test(jsText)) errors.push("progressive_list_show_more_missing");
if (!/back to top/i.test(jsText)) errors.push("back_to_top_label_missing");
if (!/scrollTo/i.test(jsText)) errors.push("back_to_top_scroll_behavior_missing");

const report = {
  contract: "earth2036-static-export-smoke-v1",
  passed: errors.length === 0,
  htmlFiles: htmlFiles.length,
  companyPages: companyPages.length,
  internalRefs,
  requiredRoutes: required.slice(0, 5),
  errors,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
