import type { Catalog, Recipe, Prediction } from "./types";
import { flavorPredict } from "./flavor";
export function recipeProfile(
  recipe: Recipe,
  catalog: Catalog,
  prediction: Prediction,
) {
  const flavor = flavorPredict(recipe, catalog, prediction);
  const hops = [...new Set(recipe.hops.map((h) => h.ingredientId))]
    .map((id) => ({
      id,
      name: catalog.hops.find((h) => h.id === id)?.name ?? id,
      additions: recipe.hops
        .filter((h) => h.ingredientId === id && h.grams > 0)
        .map((h) => ({
          grams: h.grams,
          timing:
            h.use === "dry hop"
              ? `Dry hop · ${(h.minutes / 1440).toFixed(1)} days`
              : h.use === "whirlpool"
                ? `Whirlpool · ${h.minutes} min`
                : h.minutes === 0
                  ? "Flameout"
                  : `Boil · ${h.minutes} min`,
        })),
    }))
    .filter((h) => h.additions.length > 0);
  const descriptors = catalog.vocabulary
    .filter(
      (v) => v.parent !== "structure" && (flavor.scores[v.id] ?? 0) >= 0.25,
    )
    .map((v) => ({ id: v.id, label: v.label, score: flavor.scores[v.id] }))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 4);
  return { hops, descriptors, flavor };
}
