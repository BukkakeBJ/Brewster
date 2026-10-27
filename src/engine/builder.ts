import type { Catalog, Recipe, Target } from "./types";
import { midpoint, predict, hopIbu } from "./calculations";
import { ingredientMatches, type HopFocus } from "./recommendations";
import { hopRoles } from "./library";

export const builderSteps = [
  {
    id: "water",
    label: "Water",
    description: "Choose your starting water and equipment losses.",
  },
  {
    id: "goals",
    label: "Beer goals",
    description:
      "Set flavor, alcohol, bitterness and an optional color target.",
  },
  {
    id: "malts",
    label: "Malt build",
    description: "Build the color, malt character and fermentable foundation.",
  },
  {
    id: "hops",
    label: "Hops",
    description:
      "Choose bittering, flavor and aroma hops that fit your profile.",
  },
  {
    id: "yeast",
    label: "Yeast",
    description:
      "Choose fermentation character and review the resulting alcohol estimate.",
  },
  {
    id: "additives",
    label: "Additives",
    description: "Plan optional additions and exactly when to use them.",
  },
  {
    id: "summary",
    label: "Recipe summary",
    description: "Review the full recipe, add notes, name your beer and save.",
  },
] as const;
export type BuilderStep = (typeof builderSteps)[number]["id"];
export const isBuilderStep = (value: string | null): value is BuilderStep =>
  builderSteps.some((s) => s.id === value);

/** Hold water fixed when a brewer explicitly edits grain mass; never undo that edit by rescaling it. */
export function recipeAtFixedWater(
  recipe: Recipe,
  catalog: Catalog,
  waterL: number,
  absorption = 0.8,
): Recipe {
  if (
    !Number.isFinite(waterL) ||
    waterL <= 0 ||
    !Number.isFinite(absorption) ||
    absorption < 0
  )
    throw new Error("Enter a valid starting water amount and absorption rate.");
  if (
    ![recipe.boilMinutes, recipe.boilOffLPerHour, recipe.lossL].every(
      (value) => Number.isFinite(value) && value >= 0,
    )
  )
    throw new Error("Enter valid boil and transfer-loss settings.");
  const mashKg = recipe.grains.reduce((total, grain) => {
    const malt = catalog.malts.find((m) => m.id === grain.ingredientId);
    if (!malt || !Number.isFinite(grain.kg) || grain.kg < 0)
      throw new Error("Choose a valid malt and amount.");
    return total + (malt.requiresMash ? grain.kg : 0);
  }, 0);
  const batchL =
    waterL -
    (recipe.boilOffLPerHour * recipe.boilMinutes) / 60 -
    mashKg * absorption;
  if (batchL < 0.5 || batchL <= recipe.lossL)
    throw new Error(
      "This grain bill and boil use more water than is available. Reduce grain or losses, or increase starting water.",
    );
  return { ...recipe, batchL };
}

export function suggestedHopGroups(
  target: Target,
  catalog: Catalog,
  userWeight = 1,
) {
  return (["aroma", "bittering", "flavor"] as const).map((role) => ({
    role,
    matches: ingredientMatches(
      { ...target, hopFocus: role },
      catalog,
      userWeight,
    )
      .hops.filter((match) =>
        hopRoles(catalog.hops.find((h) => h.id === match.id)!).includes(
          role === "flavor"
            ? "Flavor"
            : role === "aroma"
              ? "Aroma"
              : "Bittering",
        ),
      )
      .slice(0, 3)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/** Add a starting dose, expressed per liter; bittering fills the remaining Tinseth IBU target. */
export function addSuggestedHop(
  recipe: Recipe,
  catalog: Catalog,
  id: string,
  role: HopFocus,
  targetIbu: number,
): Recipe {
  const hop = catalog.hops.find((h) => h.id === id);
  if (!hop) throw new Error("Choose a known hop.");
  const use =
    role === "aroma" ? "whirlpool" : role === "dry hop" ? "dry hop" : "boil";
  const minutes =
    role === "bittering"
      ? Math.min(60, recipe.boilMinutes)
      : role === "flavor"
        ? Math.min(10, recipe.boilMinutes)
        : role === "dry hop"
          ? 4320
          : 20;
  if (use === "boil" && recipe.boilMinutes <= 0)
    throw new Error("Set a positive boil duration before adding a kettle hop.");
  let grams =
    recipe.batchL * (role === "aroma" ? 1 : role === "dry hop" ? 1.5 : 0.75);
  if (role === "bittering") {
    const prediction = predict(recipe, catalog);
    const singleGram = hopIbu(
      { ingredientId: id, grams: 1, use: "boil", minutes },
      midpoint(hop.alpha),
      (prediction.og + prediction.preBoilGravity) / 2,
      recipe.batchL,
    );
    const remaining = Math.max(0, targetIbu - prediction.ibu);
    if (remaining <= 0)
      throw new Error(
        "The recipe already meets the IBU target. Lower an existing hop dose first, or add a manual addition.",
      );
    if (singleGram <= 0)
      throw new Error("This hop has no calculated bittering utilization.");
    grams = remaining / singleGram;
  }
  return {
    ...recipe,
    hops: [...recipe.hops, { ingredientId: id, grams, use, minutes }],
  };
}
