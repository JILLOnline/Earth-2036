import { ACTIVE_UNIVERSE_SIZE, TRIAL_TICKS_REQUIRED } from "../engine/methodology";
import { additionalContenderSeeds } from "./universe-expansion";

export type ResearchDivision =
  | "AI Compute / Interconnect"
  | "AI Platforms / Software"
  | "Semiconductors"
  | "Semiconductors / Equipment"
  | "Compute Hardware / Photonics"
  | "Robotics / Autonomy"
  | "Robotics / Autonomy / Mobility"
  | "Robotics / Automation"
  | "Power / Grid"
  | "Power / Grid / Nuclear"
  | "Power / Grid / Utilities"
  | "Nuclear / Power"
  | "Nuclear / Fuel"
  | "Data Centers"
  | "Data Centers / Power"
  | "Digital Infrastructure"
  | "Space / Defense"
  | "Space / Geospatial"
  | "Quantum"
  | "Enabling Technologies"
  | "Strategic Materials / Processing"
  | "Energy Storage / Clean Power"
  | "Cyber / Identity / Trust"
  | "Water / Thermal / Resilience"
  | "Biotech / Health / Longevity"
  | "Communications / Connectivity"
  | "Advanced Manufacturing / Industrial"
  | "Agriculture / Bio Systems"
  | "Financial / Digital Infrastructure"
  | "Energy / Gas Infrastructure"
  | "Human Platforms / Experience";

export type UniverseSeed = {
  ticker: string;
  company: string;
  division: ResearchDivision;
  lane: string;
  status: "active";
  scoreStatus: "pending_baseline" | "scored";
};

export const RESEARCH_UNIVERSE_TARGET = ACTIVE_UNIVERSE_SIZE;
export { TRIAL_TICKS_REQUIRED };
export const EXTERNAL_DISCOVERY_POOL_POLICY = "unbounded" as const;

// The first ten companies are retained only as neutral members of the active
// universe. Their former prototype ranks/scores/forecasts have no authority in
// methodology 1.0 and are intentionally absent from this seed definition.
const originalUniverseSeeds: UniverseSeed[] = [
  { ticker: "RKLB", company: "Rocket Lab USA", division: "Space / Defense", lane: "Launch / space systems", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "CRDO", company: "Credo Technology", division: "AI Compute / Interconnect", lane: "High-speed connectivity / SerDes", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "ALAB", company: "Astera Labs", division: "AI Compute / Interconnect", lane: "Data-center connectivity / CXL", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "GEV", company: "GE Vernova", division: "Power / Grid", lane: "Generation / grid infrastructure", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "NBIS", company: "Nebius Group", division: "Data Centers", lane: "AI cloud / infrastructure", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "PL", company: "Planet Labs", division: "Space / Geospatial", lane: "Earth observation / geospatial intelligence", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "OKLO", company: "Oklo", division: "Nuclear / Power", lane: "Advanced nuclear generation", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "BTDR", company: "Bitdeer Technologies", division: "Data Centers / Power", lane: "Powered digital infrastructure / compute", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "IONQ", company: "IonQ", division: "Quantum", lane: "Trapped-ion quantum computing", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "SYM", company: "Symbotic", division: "Robotics / Automation", lane: "Warehouse robotics / automation", status: "active", scoreStatus: "pending_baseline" },
];

const foundationUniverseSeeds: UniverseSeed[] = [
  { ticker: "NVDA", company: "NVIDIA", division: "Semiconductors", lane: "AI accelerators / systems", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "AMD", company: "Advanced Micro Devices", division: "Semiconductors", lane: "AI accelerators / CPUs", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "AVGO", company: "Broadcom", division: "AI Compute / Interconnect", lane: "Custom AI silicon / networking", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "MRVL", company: "Marvell Technology", division: "AI Compute / Interconnect", lane: "Custom silicon / optical interconnect", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "ANET", company: "Arista Networks", division: "AI Compute / Interconnect", lane: "AI networking", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "COHR", company: "Coherent", division: "AI Compute / Interconnect", lane: "Optical components / photonics", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "LITE", company: "Lumentum", division: "AI Compute / Interconnect", lane: "Optical networking", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "MU", company: "Micron Technology", division: "Semiconductors", lane: "HBM / memory", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "ARM", company: "Arm Holdings", division: "Semiconductors", lane: "Compute architecture", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "MPWR", company: "Monolithic Power Systems", division: "Semiconductors", lane: "Power management silicon", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "VRT", company: "Vertiv", division: "Enabling Technologies", lane: "Data-center power / cooling", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "CLS", company: "Celestica", division: "Enabling Technologies", lane: "AI hardware manufacturing", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "APH", company: "Amphenol", division: "Enabling Technologies", lane: "High-speed connectors", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "TER", company: "Teradyne", division: "Robotics / Autonomy", lane: "Industrial robotics / test", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "ROK", company: "Rockwell Automation", division: "Robotics / Autonomy", lane: "Factory automation", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "MBLY", company: "Mobileye Global", division: "Robotics / Autonomy", lane: "Autonomous driving", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "SERV", company: "Serve Robotics", division: "Robotics / Autonomy", lane: "Autonomous delivery", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "AUR", company: "Aurora Innovation", division: "Robotics / Autonomy", lane: "Autonomous trucking", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "ETN", company: "Eaton", division: "Power / Grid / Nuclear", lane: "Electrical infrastructure", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "PWR", company: "Quanta Services", division: "Power / Grid / Nuclear", lane: "Grid construction", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "POWL", company: "Powell Industries", division: "Power / Grid / Nuclear", lane: "Electrical distribution equipment", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "CEG", company: "Constellation Energy", division: "Power / Grid / Nuclear", lane: "Nuclear generation", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "VST", company: "Vistra", division: "Power / Grid / Nuclear", lane: "Power generation / retail", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "BE", company: "Bloom Energy", division: "Power / Grid / Nuclear", lane: "Distributed power / fuel cells", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "SMR", company: "NuScale Power", division: "Power / Grid / Nuclear", lane: "Small modular reactors", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "CCJ", company: "Cameco", division: "Power / Grid / Nuclear", lane: "Nuclear fuel / services", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "CRWV", company: "CoreWeave", division: "Data Centers", lane: "AI cloud", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "APLD", company: "Applied Digital", division: "Data Centers", lane: "AI data-center infrastructure", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "IREN", company: "IREN", division: "Data Centers", lane: "AI cloud / powered data centers", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "ORCL", company: "Oracle", division: "Data Centers", lane: "Cloud infrastructure / AI capacity", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "ASTS", company: "AST SpaceMobile", division: "Space / Defense", lane: "Direct-to-device satellite", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "RDW", company: "Redwire", division: "Space / Defense", lane: "Space infrastructure", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "LUNR", company: "Intuitive Machines", division: "Space / Defense", lane: "Lunar infrastructure", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "BKSY", company: "BlackSky Technology", division: "Space / Defense", lane: "Geospatial intelligence", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "KTOS", company: "Kratos Defense & Security Solutions", division: "Space / Defense", lane: "Defense autonomy / propulsion", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "AVAV", company: "AeroVironment", division: "Space / Defense", lane: "Autonomous defense systems", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "FLY", company: "Firefly Aerospace", division: "Space / Defense", lane: "Launch / lunar systems", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "RGTI", company: "Rigetti Computing", division: "Quantum", lane: "Superconducting quantum computing", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "QBTS", company: "D-Wave Quantum", division: "Quantum", lane: "Quantum annealing", status: "active", scoreStatus: "pending_baseline" },
  { ticker: "INFQ", company: "Infleqtion", division: "Quantum", lane: "Neutral-atom quantum / sensing", status: "active", scoreStatus: "pending_baseline" },
];

const expansionUniverseSeeds: UniverseSeed[] = additionalContenderSeeds.map((seed) => ({
  ticker: seed.ticker,
  company: seed.company,
  division: seed.division as ResearchDivision,
  lane: seed.lane,
  status: "active",
  scoreStatus: "pending_baseline",
}));

export const activeUniverseSeeds: UniverseSeed[] = [
  ...originalUniverseSeeds,
  ...foundationUniverseSeeds,
  ...expansionUniverseSeeds,
];

export const researchUniverseSize = activeUniverseSeeds.length;

if (researchUniverseSize !== RESEARCH_UNIVERSE_TARGET) {
  throw new Error(`Earth 2036 research universe must contain exactly ${RESEARCH_UNIVERSE_TARGET} companies; found ${researchUniverseSize}.`);
}

const duplicateTicker = activeUniverseSeeds
  .map((candidate) => candidate.ticker)
  .find((ticker, index, tickers) => tickers.indexOf(ticker) !== index);

if (duplicateTicker) {
  throw new Error(`Duplicate Earth 2036 universe ticker: ${duplicateTicker}`);
}
