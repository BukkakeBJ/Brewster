import profiles from "../../data/style-ingredient-profiles.json";
import guide from "../../data/suggestions.json";
import type { Catalog, Target, Ingredient, Recipe } from "./types";
import { consensus } from "./flavor";
import { recipeFamily } from "./suggestions";
import { midpoint, predict } from "./calculations";
import { flavorPredict } from "./flavor";
import { hasBrewingSpecs } from "./yeast";
export type HopFocus = "bittering" | "flavor" | "aroma" | "dry hop";
export interface IngredientMatch {
  id: string;
  name: string;
  score: number;
  reasons: string[];
  descriptors: {
    id: string;
    label: string;
    intensity: number;
    descriptorIds: string[];
  }[];
}
export function styleIngredientProfile(styleId: string) {
  return (
    profiles as Record<
      string,
      {
        referenceRecipe: string;
        maltIds: string[];
        hopIds: string[];
        yeastIds: string[];
        grist: { ingredientId: string; percent: number }[];
      }
    >
  )[styleId];
}
export function hopUsage(focus: HopFocus = "aroma") {
  return {
    use:
      focus === "dry hop"
        ? "dry hop"
        : focus === "aroma"
          ? "whirlpool"
          : "boil",
  };
}
/** Editorial ranking, not a measured suitability or commercial popularity score. */
export function ingredientMatches(t: Target, c: Catalog, userWeight = 1) {
  const profile = styleIngredientProfile(t.styleId),
    family = recipeFamily(t.styleId);
  const labels = new Map(c.vocabulary.map((v) => [v.id, v.label]));
  const hopTargets = c.vocabulary
    .filter((v) => v.parent === "hops" && (t.flavors[v.id] ?? 0) > 0)
    .map((v) => v.id);
  const descriptorIndex = new Map<string, typeof c.descriptors>();
  for (const d of c.descriptors)
    descriptorIndex.set(d.ingredientId, [
      ...(descriptorIndex.get(d.ingredientId) ?? []),
      d,
    ]);
  const allowed = (i: Ingredient) =>
    !t.exclude.includes(i.id) && (!t.onHand.length || t.onHand.includes(i.id));
  const rank = (i: Ingredient): IngredientMatch => {
    const malt = c.malts.find((m) => m.id === i.id),
      yeast = c.yeasts.find((y) => y.id === i.id);
    const usage =
      i.kind === "hop"
        ? hopUsage(t.hopFocus)
        : i.kind === "malt"
          ? { percent: malt?.type === "base" ? 90 : 5 }
          : { tempC: yeast!.tempC ? midpoint(yeast!.tempC) : undefined };
    const ds = consensus(descriptorIndex.get(i.id) ?? [], usage, userWeight);
    const descriptors = ds.map((d) => ({
      id: d.descriptor,
      label: labels.get(d.descriptor) ?? d.descriptor,
      intensity: d.intensity,
      descriptorIds: d.rows.map((row) => row.id),
    }));
    let score = ds.reduce(
      (sum, d) =>
        sum +
        ((t.flavors[d.descriptor] ?? 0) * d.intensity) / 5 +
        (t.must.includes(d.descriptor) ? 5 : 0) -
        (t.avoid.includes(d.descriptor) ? d.intensity * 8 : 0),
      0,
    );
    if (i.kind === "hop" && hopTargets.length) {
      const totalDesire = hopTargets.reduce(
        (sum, id) => sum + t.flavors[id],
        0,
      );
      const supportedDesire = hopTargets.reduce(
        (sum, id) =>
          sum +
          (descriptors.some((d) => d.id === id && d.intensity >= 0.5)
            ? t.flavors[id]
            : 0),
        0,
      );
      score += (12 * supportedDesire) / totalDesire;
      const strongest = Math.max(...hopTargets.map((id) => t.flavors[id]));
      if (
        descriptors.some(
          (d) => t.flavors[d.id] === strongest && hopTargets.includes(d.id),
        )
      )
        score += 4;
    }
    const reasons: string[] = [];
    const styleMatch = (
      i.kind === "hop"
        ? profile?.hopIds
        : i.kind === "malt"
          ? profile?.maltIds
          : profile?.yeastIds
    )?.includes(i.id);
    if (styleMatch) {
      score += i.kind === "yeast" ? 14 : 6;
      reasons.push("Used in a house recipe for the selected style.");
    }
    const curated = (i.kind === "hop" ? guide.hops : guide.malts).find(
      (x) => x.ingredientId === i.id,
    );
    if (i.kind !== "yeast" && curated?.families.includes(family)) {
      score += 3;
      reasons.push(`Editorial ${family} starting point.`);
    }
    const desired = descriptors
      .filter((d) => (t.flavors[d.id] ?? 0) > 0)
      .sort(
        (a, b) =>
          (t.flavors[b.id] ?? 0) * b.intensity -
          (t.flavors[a.id] ?? 0) * a.intensity,
      )
      .slice(0, 3);
    if (desired.length)
      reasons.push(
        `Descriptor evidence matches ${desired.map((d) => d.label.toLowerCase()).join(", ")} in this usage context.`,
      );
    else
      reasons.push(
        "Limited matching sensory evidence; review the reference and run a small trial.",
      );
    if (malt && malt.type !== "base") {
      if (t.srm !== undefined)
        score -= Math.abs(malt.lovibond - Math.max(2, t.srm * 3)) * 0.03;
      reasons.push(
        t.srm === undefined
          ? `Any color: no color-target penalty; respect the ${malt.maxPercent}% grist limit.`
          : `Color role evaluated against your ${t.srm} SRM target; respect the ${malt.maxPercent}% grist limit.`,
      );
    }
    if (i.kind === "hop") {
      const h = c.hops.find((h) => h.id === i.id)!;
      if (t.hopFocus === "bittering") score += midpoint(h.alpha) * 0.7;
      reasons.push(
        t.hopFocus === "bittering"
          ? "Higher alpha acids can reduce the mass needed for kettle bitterness."
          : `Aroma selection is separate from your ${t.ibu} IBU target; the solver adjusts timing and amounts.`,
      );
    }
    if (yeast) {
      const lager =
        /lager|pils|bock|helles|dunkel|schwarz|oktober|vienna|baltic/.test(
          t.styleId,
        ) && !/weizen|dunkelweizen/.test(t.styleId);
      if ((yeast.type.toLowerCase() === "lager") === lager) score += 5;
      reasons.push(
        yeast.alcoholTolerance === null
          ? `Alcohol tolerance is unknown; verify suitability for ${t.abv}% ABV with the lab.`
          : `Reference tolerance ${yeast.alcoholTolerance}% covers the ${t.abv}% ABV target; wort and attenuation determine actual alcohol.`,
      );
    }
    return { id: i.id, name: i.name, score, reasons, descriptors };
  };
  const sorted = (items: Ingredient[]) =>
    items
      .filter(allowed)
      .map(rank)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const malts = sorted(
    c.malts.filter((m) => m.ppg > 15 && !/hull|acid|lactose/i.test(m.name)),
  );
  const hops = sorted(c.hops).filter(
    (h) =>
      !t.matchHopFlavor ||
      !hopTargets.length ||
      h.descriptors.some(
        (d) => hopTargets.includes(d.id) && d.intensity >= 0.5,
      ),
  );
  const yeasts = sorted(
    c.yeasts
      .filter(hasBrewingSpecs)
      .filter(
        (y) =>
          ["ale", "lager", "wheat", "belgian", "kveik"].includes(
            y.type.toLowerCase(),
          ) &&
          (t.yeastForm === "any" || y.form === t.yeastForm) &&
          (t.budget !== "economy" || y.form === "dry") &&
          (y.alcoholTolerance === null || y.alcoholTolerance >= t.abv),
      ),
  );
  return { malts, hops, yeasts, profile };
}
/** A visible style starting point; caller decides when to replace personal flavor targets. */
export function styleFlavorBrief(scores: Record<string, number>, c: Catalog) {
  return Object.fromEntries(
    c.vocabulary
      .filter((v) => v.axis || (scores[v.id] ?? 0) >= 1)
      .map((v) => [v.id, scores[v.id] ?? 0]),
  );
}

export function recipeDesignBrief(
  recipe: Recipe,
  c: Catalog,
  defaults: Target,
  userWeight = 1,
): Target {
  const p = predict(recipe, c);
  return {
    ...structuredClone(defaults),
    styleId: recipe.styleId,
    batchL: recipe.batchL,
    efficiency: recipe.efficiency,
    abv: +p.abv.toFixed(2),
    ibu: +p.ibu.toFixed(1),
    srm: +p.srm.toFixed(1),
    flavors: styleFlavorBrief(
      flavorPredict(recipe, c, p, userWeight).scores,
      c,
    ),
    equipment: {
      boilMinutes: recipe.boilMinutes,
      boilOffLPerHour: recipe.boilOffLPerHour,
      lossL: recipe.lossL,
    },
    hopChoices: [],
    baseMaltChoice: undefined,
    yeastChoice: undefined,
    onHand: [],
    exclude: [],
    must: [],
    avoid: [],
  };
}
