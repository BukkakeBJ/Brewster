import { expect, it } from "vitest";
import { catalog } from "../src/catalog";
import { defaultRecipeForWater } from "../src/defaults";
import { predict } from "../src/engine/calculations";
import { waterForRecipe } from "../src/engine/waterPlan";
import {
  guidance,
  matchTargetAbv,
  matchTargetIbu,
  targetStatus,
} from "../src/engine/guidance";

it("scales malts to the ABV goal while starting water stays fixed", () => {
  const recipe = defaultRecipeForWater();
  const water = recipe.waterPlan!.startingWaterL;
  for (const goal of [4, 6.5, 8]) {
    const matched = matchTargetAbv(recipe, catalog, goal);
    expect(predict(matched, catalog).abv).toBeCloseTo(goal, 1);
    expect(matched.waterPlan!.startingWaterL).toBe(water);
    expect(waterForRecipe(matched, catalog)).toBeCloseTo(water, 6);
    const ratio = matched.grains[0].kg / recipe.grains[0].kg;
    expect(matched.grains[1].kg / recipe.grains[1].kg).toBeCloseTo(ratio, 10);
    expect(matched.hops).toEqual(recipe.hops);
  }
  expect(() => matchTargetAbv({ ...recipe, grains: [] }, catalog, 5)).toThrow(
    /malt/,
  );
});

it("scales only boil hops to the IBU goal", () => {
  const recipe = defaultRecipeForWater();
  const matched = matchTargetIbu(recipe, catalog, 45);
  expect(predict(matched, catalog).ibu).toBeCloseTo(45, 6);
  matched.hops.forEach((h, i) => {
    if (h.use !== "boil") expect(h).toEqual(recipe.hops[i]);
  });
  expect(() =>
    matchTargetIbu(
      { ...recipe, hops: recipe.hops.filter((h) => h.use !== "boil") },
      catalog,
      45,
    ),
  ).toThrow(/boil hop/);
  expect(() => matchTargetIbu(recipe, catalog, 1)).toThrow(/Whirlpool/);
});

it("explains which direction to move each number", () => {
  expect(targetStatus(5, 5.5, 0.3)).toBe("low");
  expect(targetStatus(5.4, 5.5, 0.3)).toBe("ok");
  expect(targetStatus(6, 5.5, 0.3)).toBe("high");
  expect(targetStatus(6, undefined, 0.3)).toBeUndefined();
  const p = predict(defaultRecipeForWater(), catalog);
  const tips = guidance(p, { abv: p.abv + 1, ibu: p.ibu - 10 });
  expect(tips[0].key).toBe("abv");
  expect(tips[0].text).toMatch(/under your goal.*base malt/);
  expect(tips[1]).toMatchObject({
    key: "ibu",
    text: expect.stringMatching(/over your goal/),
  });
  expect(guidance(p, { abv: p.abv, ibu: p.ibu })).toEqual([]);
});
