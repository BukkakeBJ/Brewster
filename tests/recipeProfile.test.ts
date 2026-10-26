import { it, expect } from "vitest";
import { catalog as c } from "../src/catalog";
import { defaultRecipe as r } from "../src/defaults";
import { predict } from "../src/engine/calculations";
import { recipeProfile } from "../src/engine/recipeProfile";
it("lists actual hop uses and doses while keeping flavor scores separate from measurable specs", () => {
  const recipe = {
    ...r,
    hops: [
      { ingredientId: "h-citra", grams: 20, use: "boil" as const, minutes: 60 },
      {
        ingredientId: "h-citra",
        grams: 30,
        use: "whirlpool" as const,
        minutes: 20,
      },
      {
        ingredientId: "h-citra",
        grams: 40,
        use: "dry hop" as const,
        minutes: 4320,
      },
      { ingredientId: "h-mosaic", grams: 10, use: "boil" as const, minutes: 0 },
    ],
  };
  const profile = recipeProfile(recipe, c, predict(recipe, c));
  expect(profile.hops.map((h) => h.name)).toEqual(["Citra", "Mosaic"]);
  expect(profile.hops[0].additions.map((a) => a.timing)).toEqual([
    "Boil · 60 min",
    "Whirlpool · 20 min",
    "Dry hop · 3.0 days",
  ]);
  expect(profile.hops[1].additions[0].timing).toBe("Flameout");
  expect(profile.hops[0].additions.map((a) => a.grams)).toEqual([20, 30, 40]);
  expect(profile.descriptors.length).toBeGreaterThan(0);
  for (const d of profile.descriptors) {
    expect(d.score).toBe(profile.flavor.scores[d.id]);
    expect(profile.flavor.contributions[d.id].length).toBeGreaterThan(0);
    expect(c.vocabulary.find((v) => v.id === d.id)?.parent).not.toBe(
      "structure",
    );
  }
  const onlyBittering = {
    ...recipe,
    hops: [
      { ingredientId: "h-citra", grams: 90, use: "boil" as const, minutes: 60 },
    ],
  };
  expect(profile.flavor.scores.tropical).toBeGreaterThan(
    recipeProfile(onlyBittering, c, predict(onlyBittering, c)).flavor.scores
      .tropical,
  );
});
it("does not imply hops or sensory evidence when none is present", () => {
  const bare = { ...r, grains: [], hops: [] };
  const profile = recipeProfile(
    bare,
    { ...c, descriptors: [] },
    predict(bare, c),
  );
  expect(profile.hops).toEqual([]);
  expect(profile.descriptors).toEqual([]);
});
