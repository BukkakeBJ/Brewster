import type { Catalog, Recipe } from "./types";
import { predict, scaleRecipe, volumes } from "./calculations";
/** Starting mash + sparge water required by an existing recipe's current amounts. */
export function waterForRecipe(
  recipe: Recipe,
  catalog: Catalog,
  absorptionLPerKg = 0.8,
) {
  if (!Number.isFinite(absorptionLPerKg) || absorptionLPerKg < 0)
    throw new Error("Invalid grain absorption");
  const volume = volumes(
    recipe.batchL,
    recipe.boilMinutes,
    recipe.boilOffLPerHour,
    recipe.lossL,
  );
  const mashKg = recipe.grains.reduce((sum, g) => {
    if (!Number.isFinite(g.kg) || g.kg < 0)
      throw new Error("Invalid fermentable weight");
    const malt = catalog.malts.find((m) => m.id === g.ingredientId);
    if (!malt) throw new Error("Unknown fermentable");
    return sum + (malt.requiresMash ? g.kg : 0);
  }, 0);
  return volume.preBoilL + mashKg * absorptionLPerKg;
}
/** Water budget ignores water supplied by ingredients and assumes no top-up or shrinkage. */
export function planFromWater(
  recipe: Recipe,
  catalog: Catalog,
  waterL: number,
  absorptionLPerKg = 0.8,
  packagingLossL = 0.5,
  bottleMl = 330,
  cellsPerUnitBillion = 10,
) {
  for (const [name, n] of Object.entries({
    waterL,
    absorptionLPerKg,
    packagingLossL,
    bottleMl,
    cellsPerUnitBillion,
  })) {
    if (
      !Number.isFinite(n) ||
      n < 0 ||
      (["waterL", "bottleMl", "cellsPerUnitBillion"].includes(name) && n === 0)
    )
      throw new Error(`Invalid ${name}`);
  }
  const evaporationL = (recipe.boilOffLPerHour * recipe.boilMinutes) / 60;
  const mashKg = recipe.grains.reduce(
    (sum, g) =>
      sum +
      (catalog.malts.find((m) => m.id === g.ingredientId)?.requiresMash
        ? g.kg
        : 0),
    0,
  );
  const batchL =
    (waterL - evaporationL) / (1 + (mashKg / recipe.batchL) * absorptionLPerKg);
  if (batchL < 0.5)
    throw new Error(
      "Water must cover evaporation and at least 0.5 L of post-boil wort.",
    );
  const scaled = scaleRecipe(recipe, batchL, recipe.efficiency, catalog);
  const prediction = predict(scaled, catalog);
  const packagedL = Math.max(0, prediction.fermenterL - packagingLossL);
  return {
    recipe: scaled,
    evaporationL,
    absorbedL: ((mashKg * batchL) / recipe.batchL) * absorptionLPerKg,
    packagedL,
    bottles: Math.floor((packagedL * 1000 + 1e-7) / bottleMl),
    pitchBillion: prediction.pitchBillion,
    yeastUnits: prediction.pitchBillion / cellsPerUnitBillion,
  };
}
