import { it, expect } from "vitest";
import { solve } from "../src/engine/solver";
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
