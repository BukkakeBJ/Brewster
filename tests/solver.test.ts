import { it, expect } from "vitest";
import { solve, objective } from "../src/engine/solver";
import { defaultRecipe } from "../src/defaults";
import { predict } from "../src/engine/calculations";
import { flavorPredict } from "../src/engine/flavor";
import { catalog as c } from "../src/catalog";
import { defaultTarget as t } from "../src/defaults";
it("returns ranked recipes close to numeric targets and respects exclusions/form", () => {
  const excluded = c.hops.find((h) => h.name === "Citra")!.id;
  const recipes = solve({ ...t, exclude: [excluded], yeastForm: "dry" }, c, 30);
  expect(recipes).toHaveLength(3);
  expect(recipes[0].score).toBeLessThanOrEqual(recipes[1].score);
  for (const r of recipes) {
    expect(r.recipe.hops.some((h) => h.ingredientId === excluded)).toBe(false);
    expect(c.yeasts.find((y) => y.id === r.recipe.yeastId)?.form).toBe("dry");
    expect(Math.abs(r.prediction.abv - t.abv)).toBeLessThan(0.2);
    expect(Number.isFinite(r.score)).toBe(true);
  }
});
it("returns explicit infeasibility for an impossible inventory", () =>
  expect(() => solve({ ...t, onHand: [c.hops[0].id] }, c, 5)).toThrow(
    /No feasible/,
  ));
it("is deterministic and leaves targets unchanged", () => {
  const before = JSON.stringify(t);
  expect(solve(t, c, 5)[0].prediction).toEqual(solve(t, c, 5)[0].prediction);
  expect(JSON.stringify(t)).toBe(before);
});
it("ignores color in numeric and style penalties when no color target is set", () => {
  const target = { ...t, srm: undefined, styleId: "american-pale-ale" };
  const p = predict(defaultRecipe, c),
    f = flavorPredict(defaultRecipe, c, p);
  const dark = { ...p, srm: 70 };
  expect(objective(target, defaultRecipe, p, f, c)).toBe(
    objective(target, defaultRecipe, dark, f, c),
  );
  expect(
    objective({ ...target, srm: 6 }, defaultRecipe, dark, f, c),
  ).toBeGreaterThan(objective({ ...target, srm: 6 }, defaultRecipe, p, f, c));
  const result = solve(target, c, 10);
  expect(result).toHaveLength(3);
  for (const candidate of result) {
    expect(Number.isFinite(candidate.score)).toBe(true);
    expect(Number.isFinite(candidate.prediction.srm)).toBe(true);
    expect(candidate.tradeoffs.some((t) => /^SRM/.test(t))).toBe(false);
  }
});
