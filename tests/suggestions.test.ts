import { describe, it, expect } from "vitest";
import { catalog as c } from "../src/catalog";
import { defaultRecipe as r } from "../src/defaults";
import {
  applyStartingPoint,
  startingPoints,
  suggestionImpact,
} from "../src/engine/suggestions";
import { originalGravity } from "../src/engine/calculations";
describe("curated ingredient starting points", () => {
  it("only suggests catalog ingredients and prioritizes recipe family", () => {
    const lager = { ...r, styleId: "german-pilsner-pils" };
    const hops = startingPoints("hop", c, lager, "match", "aroma");
    expect(hops[0].matchesStyle).toBe(true);
    expect(hops[0].item.families).toContain("lager");
    for (const s of hops)
      expect(c.hops.some((h) => h.id === s.item.ingredientId)).toBe(true);
    expect(startingPoints("malt", c, r, "popular")).toHaveLength(8);
  });
  it("filters hop uses and adds a scaled trial without altering prior additions", () => {
    const points = startingPoints("hop", c, r, "popular", "bittering");
    expect(points.some((s) => s.item.ingredientId === "h-magnum-gr")).toBe(
      true,
    );
    expect(points.some((s) => s.item.ingredientId === "h-citra")).toBe(false);
    const next = applyStartingPoint(r, c, "hop", "h-cascade", "dry hop");
    expect(next.hops.slice(0, -1)).toEqual(r.hops);
    expect(next.hops.at(-1)).toEqual({
      ingredientId: "h-cascade",
      use: "dry hop",
      grams: 30,
      minutes: 4320,
    });
    expect(suggestionImpact(r, next, c).ibu).toBe(0);
    expect(() =>
      applyStartingPoint(
        { ...r, boilMinutes: 0 },
        c,
        "hop",
        "h-magnum-gr",
        "bittering",
      ),
    ).toThrow();
  });
  it("swaps base malt by potential while preserving original gravity", () => {
    const next = applyStartingPoint(r, c, "malt", "m-simpsons-maris-otter");
    expect(next.grains).toHaveLength(r.grains.length);
    expect(next.grains[0].ingredientId).toBe("m-simpsons-maris-otter");
    expect(
      originalGravity(next.grains, c.malts, r.batchL, r.efficiency),
    ).toBeCloseTo(
      originalGravity(r.grains, c.malts, r.batchL, r.efficiency),
      10,
    );
    expect(r.grains[0].ingredientId).toBe("m-briess-2-row-brewers-malt");
  });
  it("adds specialty malt at the proposed final grist percentage and prevents duplicate/empty-grist mistakes", () => {
    const next = applyStartingPoint(r, c, "malt", "m-briess-oat-flakes");
    expect(
      next.grains.at(-1)!.kg / next.grains.reduce((s, g) => s + g.kg, 0),
    ).toBeCloseTo(0.05, 10);
    expect(() =>
      applyStartingPoint(next, c, "malt", "m-briess-oat-flakes"),
    ).toThrow(/Already/);
    expect(() =>
      applyStartingPoint(
        { ...r, grains: [] },
        c,
        "malt",
        "m-briess-oat-flakes",
      ),
    ).toThrow(/base malt/);
  });
});
