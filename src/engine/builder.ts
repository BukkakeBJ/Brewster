import type { Catalog, Recipe, Target } from "./types";
import { midpoint, predict, hopIbu } from "./calculations";
import { ingredientMatches, type HopFocus } from "./recommendations";
import { hopRoles } from "./library";

export const builderSteps = [
  {
    id: "water",
    label: "Water",
    title: "How much water are you brewing with?",
    description:
      "Everything else is sized from your water: malts, hops and yeast scale automatically.",
  },
  {
    id: "goals",
    label: "Goals",
    title: "What beer do you want to make?",
    description:
      "Pick a style, then set the alcohol, bitterness and flavors you're aiming for.",
  },
  {
    id: "malts",
    label: "Malts",
    title: "Build your grain bill",
    description:
      "Malts give the beer its alcohol, color and body. Watch the numbers update as you go.",
  },
  {
    id: "hops",
    label: "Hops",
    title: "Plan your hops",
    description:
      "Early boil hops add bitterness. Late, whirlpool and dry hops add flavor and aroma.",
  },
  {
    id: "yeast",
    label: "Yeast",
    title: "Choose your yeast",
    description:
      "Yeast decides how dry the beer finishes and adds its own fruity or clean character.",
  },
  {
    id: "summary",
    label: "Review",
    title: "Review and save",
    description:
      "Name your beer, check the full recipe, add any extras and save it to your Recipe Book.",
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
