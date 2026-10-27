import type { ProcessNotes } from "./processNotes";
export type Range = [number, number];
export interface Source {
  title: string;
  url: string;
  accessed: string;
  note?: string;
}
export interface Ingredient {
  id: string;
  kind: "malt" | "hop" | "yeast";
  name: string;
  source: Source;
}
export interface Malt extends Ingredient {
  kind: "malt";
  maltster: string | null;
  type: string;
  lovibond: number;
  ebc: number;
  ppg: number;
  extractPercent: number;
  diastaticPower: number | null;
  requiresMash: boolean;
  maxPercent: number;
  maxPercentIsEstimate?: boolean;
  fermentabilityNotes: string;
  bodyContribution: "low" | "medium" | "high";
}
export interface Hop extends Ingredient {
  kind: "hop";
  origin: string;
  purpose: string;
  alpha: Range;
  beta: Range | null;
  cohumulone: number | null;
  totalOil: number | null;
  oils: Record<string, number | null>;
  substitutes: string[];
}
export interface Yeast extends Ingredient {
  kind: "yeast";
  lab: string;
  code: string;
  form: string;
  type: string;
  attenuation: Range | null;
  flocculation: string;
  tempC: Range | null;
  alcoholTolerance: number | null;
  pof: boolean | null;
  diastaticus: boolean | null;
}
export interface Vocabulary {
  id: string;
  parent: string;
  label: string;
  axis: boolean;
}
export interface Descriptor {
  id: string;
  ingredientId: string;
  descriptor: string;
  intensity: number;
  context: {
    medium?: "beer" | "wine";
    use?: string;
    minPercent?: number;
    maxPercent?: number;
    minTempC?: number;
    maxTempC?: number;
  };
  usageContext: string;
  sourceType: "manufacturer" | "literature" | "community" | "user";
  confidence: "low" | "medium" | "high";
  note: string;
  source: Source;
}
export interface Catalog {
  malts: Malt[];
  hops: Hop[];
  yeasts: Yeast[];
  descriptors: Descriptor[];
  vocabulary: Vocabulary[];
  styles: Style[];
}
export interface Style {
  id: string;
  name: string;
  og: Range;
  fg: Range;
  abv: Range;
  ibu: Range;
  srm: Range;
  source: Source;
}
export interface Grain {
  ingredientId: string;
  kg: number;
}
export interface HopAddition {
  ingredientId: string;
  grams: number;
  use: "boil" | "whirlpool" | "dry hop";
  minutes: number;
  alpha?: number;
}
export interface RecipeOrigin {
  kind:
    | "original-starter"
    | "published-adaptation"
    | "published-clone"
    | "clone-inspired";
  brewery?: string;
  beer?: string;
  referenceSpecs?: {
    abv?: number;
    ibu?: number;
    ibuAtLeast?: number;
    og?: number;
    fg?: number;
    srm?: number;
  };
  title: string;
  author: string;
  url?: string;
  accessed?: string;
  adaptations?: string;
}
export interface Recipe {
  designTargets?: Target;
  waterPlan?: {
    startingWaterL: number;
    absorptionLPerKg: number;
    packagingLossL: number;
    bottleMl: number;
    dryCellsBillionPerG: number;
    liquidCellsBillionPerPack: number;
    dryPackGrams: number;
  };
  additives?: import("./additives").AdditiveAddition[];
  processNotes?: ProcessNotes;
  id: string;
  name: string;
  styleId: string;
  description?: string;
  notes?: string;
  tags?: string[];
  origin?: RecipeOrigin;
  batchL: number;
  efficiency: number;
  mashC: number;
  mashMinutes: number;
  fermentC: number;
  boilMinutes: number;
  boilOffLPerHour: number;
  lossL: number;
  whirlpoolFactor: number;
  carbonation: number;
  pitchMultiplier: number;
  yeastId: string;
  grains: Grain[];
  hops: HopAddition[];
}
export interface Prediction {
  og: number;
  fg: number;
  abv: number;
  abvStandard: number;
  ibu: number;
  srm: number;
  ebc: number;
  bugu: number;
  attenuation: number;
  calories12oz: number;
  calories330: number;
  preBoilL: number;
  fermenterL: number;
  preBoilGravity: number;
  postBoilL: number;
  pitchBillion: number;
  warnings: string[];
}
export interface Contribution {
  ingredientId: string;
  ingredient: string;
  score: number;
  descriptor: string;
  descriptorIds: string[];
  reason: string;
}
export interface Flavor {
  scores: Record<string, number>;
  contributions: Record<string, Contribution[]>;
}
export interface Target {
  waterPlan?: Recipe["waterPlan"];
  hopFocus?: import("./recommendations").HopFocus;
  matchHopFlavor?: boolean;
  hopChoices?: string[];
  baseMaltChoice?: string;
  yeastChoice?: string;
  og?: Range;
  fg?: Range;
  abv: number;
  ibu: number;
  srm?: number;
  batchL: number;
  efficiency: number;
  styleId: string;
  flavors: Record<string, number>;
  must: string[];
  avoid: string[];
  onHand: string[];
  exclude: string[];
  yeastForm: "any" | "dry" | "liquid";
  budget: "any" | "economy";
  equipment: { boilMinutes: number; boilOffLPerHour: number; lossL: number };
  weights: { flavor: number; numbers: number; style: number };
}
export interface BrewLog {
  id: string;
  date: string;
  recipe: Recipe;
  predicted: Prediction;
  predictedFlavor: Record<string, number>;
  actualOg: number;
  actualFg: number;
  actualVolumeL: number;
  actualTempC: number;
  tasting: Record<string, number>;
  notes: string;
  descriptors: Descriptor[];
}
