import { it, expect } from "vitest";
import { catalog as c } from "../src/catalog";
import { defaultTarget as t } from "../src/defaults";
import {
  ingredientMatches,
  styleIngredientProfile,
} from "../src/engine/recommendations";
import { solve } from "../src/engine/solver";
import { starterRecipes } from "../src/engine/recipeBook";

it("changes hop candidates by flavor and usage evidence, without equating low IBU with low aroma", () => {
  const citra = c.hops.find((h) => h.id === "h-citra")!,
    saaz = c.hops.find((h) => h.id === "h-saaz-cz")!;
  const descriptor = c.descriptors[0];
  const small = {
    ...c,
    hops: [citra, saaz],
    descriptors: [
      {
        ...descriptor,
        id: "tropical-late",
        ingredientId: citra.id,
        descriptor: "tropical",
        intensity: 4,
        context: { use: "dry hop" },
      },
      {
        ...descriptor,
        id: "saaz-late",
        ingredientId: saaz.id,
        descriptor: "floral",
        intensity: 4,
        context: { use: "dry hop" },
      },
    ],
  };
  const tropical = {
    ...t,
    styleId: "",
    ibu: 5,
    hopFocus: "dry hop" as const,
    matchHopFlavor: true,
    flavors: { tropical: 4 },
  };
  expect(ingredientMatches(tropical, small).hops.map((h) => h.id)).toEqual([
    citra.id,
  ]);
  expect(
    ingredientMatches({ ...tropical, flavors: { floral: 4 } }, small).hops.map(
      (h) => h.id,
    ),
  ).toEqual([saaz.id]);
  expect(
    ingredientMatches({ ...tropical, hopFocus: "bittering" }, small).hops,
  ).toEqual([]);
  expect(ingredientMatches({ ...tropical, ibu: 90 }, small).hops[0].id).toBe(
    citra.id,
  );
});
it("recommends style grists and yeast, filtering actual tolerance, inventory, exclusions and form", () => {
  const lager = { ...t, styleId: "bohemian-pilsener", flavors: {}, abv: 5 };
  const matches = ingredientMatches(lager, c);
  const expected = styleIngredientProfile(lager.styleId)!;
  expect(matches.profile?.grist.reduce((s, g) => s + g.percent, 0)).toBeCloseTo(
    100,
    0,
  );
  expect(expected.yeastIds).toContain(matches.yeasts[0].id);
  expect(expected.maltIds).toContain(matches.malts[0].id);
  const strong = ingredientMatches({ ...lager, abv: 12, yeastForm: "dry" }, c);
  for (const y of strong.yeasts) {
    const strain = c.yeasts.find((i) => i.id === y.id)!;
    expect(strain.form).toBe("dry");
    expect(
      strain.alcoholTolerance === null || strain.alcoholTolerance >= 12,
    ).toBe(true);
  }
  const only = ingredientMatches(
    { ...t, onHand: ["h-citra"], exclude: ["h-citra"] },
    c,
  );
  expect(only.hops).toEqual([]);
  expect(only.malts).toEqual([]);
  expect(only.yeasts).toEqual([]);
  for (const r of starterRecipes) {
    const profile = styleIngredientProfile(r.styleId)!;
    for (const g of r.grains) expect(profile.maltIds).toContain(g.ingredientId);
    for (const h of r.hops) expect(profile.hopIds).toContain(h.ingredientId);
    expect(profile.yeastIds).toContain(r.yeastId);
  }
});
it("uses ingredient choices in generated recipes and honors changed ABV and low IBU targets", () => {
  const target = {
    ...t,
    abv: 4,
    ibu: 5,
    hopChoices: ["h-citra"],
    baseMaltChoice: "m-briess-2-row-brewers-malt",
    yeastChoice: "y-fermentis-us-05-safale-us-05",
    hopFocus: "dry hop" as const,
  };
  const results = solve(target, c, 15);
  expect(results).toHaveLength(3);
  for (const result of results) {
    expect(result.recipe.yeastId).toBe(target.yeastChoice);
    expect(result.recipe.grains[0].ingredientId).toBe(target.baseMaltChoice);
    expect(result.recipe.hops.every((h) => h.ingredientId === "h-citra")).toBe(
      true,
    );
    expect(result.prediction.abv).toBeCloseTo(4, 1);
    expect(result.prediction.ibu).toBeCloseTo(5, 1);
    expect(
      result.recipe.hops.some((h) => h.use === "dry hop" && h.grams > 0),
    ).toBe(true);
  }
  expect(() => solve({ ...target, exclude: ["h-citra"] }, c, 2)).toThrow(
    /No feasible/,
  );
  expect(() => solve({ ...target, yeastForm: "liquid" }, c, 2)).toThrow(
    /No feasible/,
  );
  const stronger = solve({ ...target, abv: 7 }, c, 10)[0];
  expect(stronger.prediction.abv).toBeCloseTo(7, 1);
});
it("starts redesign targets from the current beer without inheriting old inventory constraints or editing the recipe", async () => {
  const { recipeDesignBrief } = await import("../src/engine/recommendations");
  const { defaultRecipe } = await import("../src/defaults");
  const { predict } = await import("../src/engine/calculations");
  const before = JSON.stringify(defaultRecipe),
    p = predict(defaultRecipe, c);
  const brief = recipeDesignBrief(defaultRecipe, c, {
    ...t,
    onHand: ["impossible"],
    hopChoices: ["bad"],
    baseMaltChoice: "bad",
    yeastChoice: "bad",
  });
  expect(brief.abv).toBeCloseTo(p.abv, 2);
  expect(brief.ibu).toBeCloseTo(p.ibu, 1);
  expect(brief.styleId).toBe(defaultRecipe.styleId);
  expect(brief.onHand).toEqual([]);
  expect(brief.hopChoices).toEqual([]);
  expect(brief.baseMaltChoice).toBeUndefined();
  expect(brief.yeastChoice).toBeUndefined();
  expect(JSON.stringify(defaultRecipe)).toBe(before);
});
