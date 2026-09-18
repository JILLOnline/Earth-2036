export function normalizeTicker(value) {
  return String(value ?? "").trim().toUpperCase().replace(/\./g, "-");
}

export function parseUniverseSeeds(source) {
  const out = [];
  const regex = /\{\s*ticker:\s*"([^"]+)",\s*company:\s*"([^"]+)",\s*division:\s*"([^"]+)",\s*lane:\s*"([^"]+)"/g;
  for (const match of source.matchAll(regex)) {
    out.push({
      ticker: normalizeTicker(match[1]),
      company: match[2],
      division: match[3],
      lane: match[4],
      seedClass: "active_universe",
    });
  }
  return out;
}

export function parseExpansionContenders(source) {
  const out = [];
  const groupRegex = /seedGroup\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*\[([\s\S]*?)\]\s*\)/g;
  for (const group of source.matchAll(groupRegex)) {
    const division = group[1];
    const lane = group[2];
    const members = group[3];
    const memberRegex = /\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g;
    for (const member of members.matchAll(memberRegex)) {
      out.push({
        ticker: normalizeTicker(member[1]),
        company: member[2],
        division,
        lane,
        seedClass: "active_universe",
      });
    }
  }
  return out;
}

export function buildUniverse({ universeSource, expansionSource, expectedSize = 250 }) {
  const directSeeds = parseUniverseSeeds(universeSource);
  const expansion = parseExpansionContenders(expansionSource);
  const combined = [...directSeeds, ...expansion];
  const byTicker = new Map();

  for (const candidate of combined) {
    if (byTicker.has(candidate.ticker)) {
      throw new Error(`Duplicate universe ticker ${candidate.ticker}`);
    }
    byTicker.set(candidate.ticker, candidate);
  }

  if (combined.length !== expectedSize) {
    throw new Error(`Expected ${expectedSize} universe companies, parsed ${combined.length}`);
  }

  return combined;
}
