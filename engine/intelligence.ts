export type CausalNodeType =
  | "company"
  | "technology"
  | "resource"
  | "infrastructure"
  | "human_need"
  | "bottleneck"
  | "regulation"
  | "geography"
  | "market";

export type CausalRelationship =
  | "depends_on"
  | "enables"
  | "supplies"
  | "substitutes_for"
  | "competes_with"
  | "benefits_from"
  | "threatened_by"
  | "constrained_by"
  | "bottlenecks"
  | "serves_need"
  | "premiumizes"
  | "commoditizes";

export type CausalNode = {
  id: string;
  type: CausalNodeType;
  label: string;
  description?: string;
};

export type CausalEdge = {
  id: string;
  from: string;
  to: string;
  relationship: CausalRelationship;
  direction: -1 | 0 | 1;
  strength: number;
  confidence: number;
  evidenceTier: "Wood" | "Hay" | "Iron" | "Gold" | "Diamond";
  sourceIds: readonly string[];
  observedAt: string;
};

export type StructuralSignalKind =
  | "abundance"
  | "scarcity"
  | "substitution"
  | "premiumization"
  | "dependency"
  | "displacement"
  | "human_demand_shift";

export type StructuralSignal = {
  id: string;
  kind: StructuralSignalKind;
  subjectNodeId: string;
  affectedNodeIds: readonly string[];
  direction: -1 | 0 | 1;
  magnitude: number;
  confidence: number;
  timeHorizon: "0-12m" | "1-3y" | "3-5y" | "5-10y";
  sourceIds: readonly string[];
  observedAt: string;
  thesis: string;
  falsifier: string;
};

export type RoadmapMilestone = {
  id: string;
  year: number;
  theme: string;
  hypothesis: string;
  metric: string;
  targetOrTrigger: string;
  currentValue?: string;
  direction?: "ahead" | "on_track" | "behind" | "unknown";
  confidence: number;
  linkedNodeIds: readonly string[];
  sourceIds: readonly string[];
  lastUpdated: string;
};

export function validateCausalEdge(edge: CausalEdge) {
  if (edge.strength < 0 || edge.strength > 100) throw new Error(`Invalid causal strength: ${edge.strength}`);
  if (edge.confidence < 0 || edge.confidence > 100) throw new Error(`Invalid causal confidence: ${edge.confidence}`);
  if (!edge.sourceIds.length) throw new Error(`Causal edge ${edge.id} requires source evidence`);
  return edge;
}
