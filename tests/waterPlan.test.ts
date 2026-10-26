import { expect, it } from "vitest";
import { catalog } from "../src/catalog";
import { defaultRecipe } from "../src/defaults";
import { planFromWater } from "../src/engine/waterPlan";
import { predict } from "../src/engine/calculations";
it("balances starting water, absorption and evaporation while preserving recipe composition", () => {
  const before = structuredClone(defaultRecipe);
  const plan = planFromWater(defaultRecipe, catalog, 30);
  expect(plan.recipe.batchL + plan.absorbedL + plan.evaporationL).toBeCloseTo(
    30,
    10,
  );
  const ratio = plan.recipe.batchL / defaultRecipe.batchL;
  expect(plan.recipe.grains[0].kg).toBeCloseTo(
    defaultRecipe.grains[0].kg * ratio,
  );
  expect(plan.recipe.hops[0].grams).toBeCloseTo(
    defaultRecipe.hops[0].grams * ratio,
  );
  expect(
    plan.recipe.hops.map((h) => [h.ingredientId, h.use, h.minutes]),
  ).toEqual(defaultRecipe.hops.map((h) => [h.ingredientId, h.use, h.minutes]));
  expect(predict(plan.recipe, catalog).og).toBeCloseTo(
    predict(defaultRecipe, catalog).og,
  );
  expect(plan.pitchBillion).toBeCloseTo(
    predict(plan.recipe, catalog).pitchBillion,
  );
  expect(plan.yeastUnits).toBeCloseTo(plan.pitchBillion / 10);
  expect(plan.bottles).toBe(Math.floor((plan.packagedL * 1000) / 330));
  expect(defaultRecipe).toEqual(before);
  expect(planFromWater(plan.recipe, catalog, 30).recipe.batchL).toBeCloseTo(
    plan.recipe.batchL,
  );
});
it("calculates known bottle yields and handles zero packaging yield", () => {
  const r = { ...defaultRecipe, lossL: 0, boilOffLPerHour: 0 };
  const p = planFromWater(r, catalog, 20, 0, 0, 500, 100);
  expect(p.recipe.batchL).toBe(20);
  expect(p.bottles).toBe(40);
  expect(p.yeastUnits).toBeCloseTo(p.pitchBillion / 100);
  expect(planFromWater(r, catalog, 20, 0, 25).bottles).toBe(0);
});
it("rejects insufficient water and invalid planning assumptions", () => {
  for (const water of [0, -1, NaN, Infinity, 2])
    expect(() => planFromWater(defaultRecipe, catalog, water)).toThrow();
  expect(() => planFromWater(defaultRecipe, catalog, 30, -1)).toThrow();
  expect(() =>
    planFromWater(defaultRecipe, catalog, 30, 0.8, 0.5, 0),
  ).toThrow();
  expect(() =>
    planFromWater(defaultRecipe, catalog, 30, 0.8, 0.5, 330, 0),
  ).toThrow();
});
