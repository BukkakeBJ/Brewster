import type { Catalog, Prediction, Recipe, Style, Target } from "./types";
import { predict } from "./calculations";
import { recipeAtFixedWater } from "./builder";
import { waterSettings } from "./waterPlan";

/** Scale every fermentable by one factor until predicted ABV meets the target, keeping starting water fixed. */
export function matchTargetAbv(
  recipe: Recipe,
  catalog: Catalog,
  targetAbv: number,
): Recipe {
  if (!Number.isFinite(targetAbv) || targetAbv <= 0)
    throw new Error("Set a positive ABV target first.");
  if (!recipe.grains.some((g) => g.kg > 0))
    throw new Error("Add a malt before matching the ABV target.");
  const settings = waterSettings(recipe, catalog);
  const at = (factor: number) =>
    recipeAtFixedWater(
      {
        ...recipe,
        grains: recipe.grains.map((g) => ({ ...g, kg: g.kg * factor })),
      },
      catalog,
      settings.startingWaterL,
      settings.absorptionLPerKg,
    );
  let factor = 1;
  for (let i = 0; i < 8; i++) {
    const abv = predict(at(factor), catalog).abv;
    if (Math.abs(abv - targetAbv) < 0.01) break;
    factor *= targetAbv / abv;
  }
  return { ...at(factor), waterPlan: settings };
}

/** Scale boil additions so total Tinseth IBU meets the target; whirlpool and dry hops stay as entered. */
export function matchTargetIbu(
  recipe: Recipe,
  catalog: Catalog,
  targetIbu: number,
): Recipe {
  if (!Number.isFinite(targetIbu) || targetIbu < 0)
    throw new Error("Set an IBU target first.");
  if (!recipe.hops.some((h) => h.use === "boil" && h.grams > 0))
    throw new Error("Add a boil hop before matching the IBU target.");
  const total = predict(recipe, catalog).ibu;
  const other = predict(
    { ...recipe, hops: recipe.hops.filter((h) => h.use !== "boil") },
    catalog,
  ).ibu;
  if (targetIbu <= other)
    throw new Error(
      "Whirlpool hops already reach this IBU target. Lower them, or raise the target.",
    );
  const factor = (targetIbu - other) / (total - other);
  return {
    ...recipe,
    hops: recipe.hops.map((h) =>
      h.use === "boil" ? { ...h, grams: h.grams * factor } : h,
    ),
  };
}

export type TargetStatus = "low" | "ok" | "high";

/** Compare a predicted value with a goal, allowing a planning tolerance either side. */
export function targetStatus(
  value: number,
  goal: number | undefined,
  tolerance: number,
): TargetStatus | undefined {
  if (goal === undefined) return undefined;
  return value < goal - tolerance
    ? "low"
    : value > goal + tolerance
      ? "high"
      : "ok";
}

export const TOLERANCE = { abv: 0.3, ibu: 4, srm: 2 } as const;

export interface Tip {
  key: "abv" | "ibu" | "srm" | "fg";
  text: string;
}

/** Plain-language next steps, one per number that is away from its goal. */
export function guidance(
  p: Prediction,
  target: Pick<Target, "abv" | "ibu" | "srm">,
  style?: Style,
): Tip[] {
  const tips: Tip[] = [];
  const push = (key: Tip["key"], text: string) => tips.push({ key, text });
  const abv = targetStatus(p.abv, target.abv, TOLERANCE.abv);
  if (abv === "low")
    push(
      "abv",
      `Alcohol is ${(target.abv - p.abv).toFixed(1)}% under your goal. Add more base malt.`,
    );
  if (abv === "high")
    push(
      "abv",
      `Alcohol is ${(p.abv - target.abv).toFixed(1)}% over your goal. Use less base malt.`,
    );
  const ibu = targetStatus(p.ibu, target.ibu, TOLERANCE.ibu);
  if (ibu === "low")
    push(
      "ibu",
      `Bitterness is ${Math.round(target.ibu - p.ibu)} IBU under your goal. Add more hops early in the boil.`,
    );
  if (ibu === "high")
    push(
      "ibu",
      `Bitterness is ${Math.round(p.ibu - target.ibu)} IBU over your goal. Use fewer early-boil hops or move some later.`,
    );
  const srm = targetStatus(p.srm, target.srm, TOLERANCE.srm);
  if (srm === "low")
    push("srm", "Color is lighter than your goal. Add a little crystal or dark malt.");
  if (srm === "high")
    push("srm", "Color is darker than your goal. Reduce crystal, chocolate or roasted malt.");
  if (style && (p.fg < style.fg[0] - 0.002 || p.fg > style.fg[1] + 0.002))
    push(
      "fg",
      p.fg < style.fg[0]
        ? "It will finish drier than this style. Mash a little warmer or add some crystal malt for body."
        : "It will finish sweeter than this style. Mash a little cooler or use a more attenuative yeast.",
    );
  return tips;
}
