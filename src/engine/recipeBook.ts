import seeds from "../../data/recipes.json";
import type { Catalog, Recipe } from "./types";
import { recipeSchema } from "../validation";
export const starterRecipes: Recipe[] = seeds.map((r) => recipeSchema.parse(r));
export interface BookEntry {
  id: string;
  recipe: Recipe;
  collection: "starter" | "mine" | "draft";
  unsaved: boolean;
}
export function isCraftRecipe(r: Recipe) {
  return !!r.origin && r.origin.kind !== "original-starter";
}
export function recipeOriginLabel(r: Recipe) {
  return (
    {
      "published-adaptation": "BREWERY RECIPE · ADAPTED",
      "published-clone": "PUBLISHED CLONE · ADAPTED",
      "clone-inspired": "HOUSE CLONE · APPROXIMATE",
      "original-starter": "ORIGINAL STARTER",
    } as const
  )[r.origin?.kind ?? "original-starter"];
}
export function sameRecipe(a: Recipe, b: Recipe) {
  return (
    JSON.stringify(recipeSchema.parse(a)) ===
    JSON.stringify(recipeSchema.parse(b))
  );
}
export function recipeBookEntries(
  saved: Recipe[],
  drafts: Record<string, Recipe>,
): BookEntry[] {
  const starters = starterRecipes.map((recipe) => ({
    id: "starter:" + recipe.id,
    recipe,
    collection: "starter" as const,
    unsaved: false,
  }));
  const mine = saved.map((recipe) => {
    const draft = drafts[recipe.id];
    return {
      id: "mine:" + recipe.id,
      recipe: draft ?? recipe,
      collection: "mine" as const,
      unsaved: !!draft && !sameRecipe(draft, recipe),
    };
  });
  const ids = new Set(saved.map((r) => r.id));
  const unsaved = Object.values(drafts)
    .filter((r) => !ids.has(r.id))
    .map((recipe) => ({
      id: "draft:" + recipe.id,
      recipe,
      collection: "draft" as const,
      unsaved: true,
    }));
  return [...mine, ...unsaved, ...starters];
}
export function filterBook(
  entries: BookEntry[],
  c: Catalog,
  {
    query = "",
    collection = "all",
    styleId = "",
    brewery = "",
    originKind = "",
  }: {
    query?: string;
    collection?: string;
    styleId?: string;
    brewery?: string;
    originKind?: string;
  },
) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((e) => {
    if (collection === "craft") {
      if (e.collection !== "starter" || !isCraftRecipe(e.recipe)) return false;
    } else if (collection !== "all" && e.collection !== collection)
      return false;
    if (brewery && e.recipe.origin?.brewery !== brewery) return false;
    if (originKind && e.recipe.origin?.kind !== originKind) return false;
    if (styleId && e.recipe.styleId !== styleId) return false;
    const r = e.recipe;
    const ingredients = [
      ...r.grains.map(
        (g) => c.malts.find((m) => m.id === g.ingredientId)?.name ?? "",
      ),
      ...r.hops.map(
        (h) => c.hops.find((i) => i.id === h.ingredientId)?.name ?? "",
      ),
      c.yeasts.find((y) => y.id === r.yeastId)?.name ?? "",
    ];
    const text = [
      r.name,
      r.description ?? "",
      r.notes ?? "",
      ...(r.tags ?? []),
      c.styles.find((s) => s.id === r.styleId)?.name ?? "",
      ...ingredients,
      r.origin?.author ?? "",
      r.origin?.brewery ?? "",
      r.origin?.beer ?? "",
      r.origin?.title ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
export function copyBookRecipe(recipe: Recipe, id: string): Recipe {
  return {
    ...structuredClone(recipe),
    id,
    name: recipe.name.slice(0, 193) + " (copy)",
  };
}
export function readDraftBank(text: string | null): Record<string, Recipe> {
  try {
    const input = JSON.parse(text ?? "{}");
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    const result: Record<string, Recipe> = Object.create(null);
    for (const value of Object.values(input)) {
      const r = recipeSchema.safeParse(value);
      if (r.success) result[r.data.id] = r.data;
    }
    return result;
  } catch {
    return {};
  }
}
