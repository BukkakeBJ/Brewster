import { expect, it } from "vitest";
import { catalog } from "../src/catalog";
import { defaultRecipe, defaultRecipeForWater } from "../src/defaults";
import { planFromWater, waterForRecipe } from "../src/engine/waterPlan";
import { predict, L_PER_GAL } from "../src/engine/calculations";
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
it("keeps loaded recipe water consistent and initializes new manual drafts at five gallons", () => {
  expect(waterForRecipe(defaultRecipe, catalog)).toBeCloseTo(26.56, 8);
  const planned = planFromWater(defaultRecipe, catalog, 40);
  expect(waterForRecipe(planned.recipe, catalog)).toBeCloseTo(40, 8);
  const fresh = defaultRecipeForWater();
  expect(fresh.id).not.toBe(defaultRecipeForWater().id);
  expect(waterForRecipe(fresh, catalog)).toBeCloseTo(5 * L_PER_GAL, 8);
  expect(defaultRecipe.batchL).toBe(20);
  const nonMash = catalog.malts.find((m) => !m.requiresMash)!;
  expect(
    waterForRecipe(
      {
        ...defaultRecipe,
        grains: [...defaultRecipe.grains, { ingredientId: nonMash.id, kg: 3 }],
      },
      catalog,
    ),
  ).toBeCloseTo(26.56, 8);
});
it("rejects invalid recipes when deriving their starting water", () => {
  expect(() =>
    waterForRecipe({ ...defaultRecipe, batchL: 0 }, catalog),
  ).toThrow();
  expect(() =>
    waterForRecipe(
      { ...defaultRecipe, grains: [{ ingredientId: "missing", kg: 1 }] },
      catalog,
    ),
  ).toThrow();
  expect(() =>
    waterForRecipe(
      {
        ...defaultRecipe,
        grains: [
          { ingredientId: defaultRecipe.grains[0].ingredientId, kg: -1 },
        ],
      },
      catalog,
    ),
  ).toThrow();
  expect(() => waterForRecipe(defaultRecipe, catalog, -1)).toThrow();
});
it("rescales every hop on repeated water changes without compounding or losing manual ratios", () => {
  const small = planFromWater(defaultRecipe, catalog, 20);
  const large = planFromWater(small.recipe, catalog, 40);
  // The fixed 3 L evaporation does not double with the starting water.
  const ratio = 37 / 17;
  large.recipe.hops.forEach((h, i) => {
    expect(h.grams).toBeCloseTo(small.recipe.hops[i].grams * ratio, 8);
    expect(h.use).toBe(small.recipe.hops[i].use);
    expect(h.minutes).toBe(small.recipe.hops[i].minutes);
  });
  const back = planFromWater(large.recipe, catalog, 20);
  back.recipe.hops.forEach((h, i) =>
    expect(h.grams).toBeCloseTo(small.recipe.hops[i].grams, 8),
  );
  const edited = {
    ...small.recipe,
    hops: small.recipe.hops.map((h) => ({ ...h, grams: h.grams * 1.5 })),
  };
  const editedLarge = planFromWater(edited, catalog, 40);
  editedLarge.recipe.hops.forEach((h, i) =>
    expect(h.grams).toBeCloseTo(large.recipe.hops[i].grams * 1.5, 8),
  );
  expect(large.pitchBillion).toBeGreaterThan(small.pitchBillion);
  expect(large.bottles).toBeGreaterThan(small.bottles);
});
