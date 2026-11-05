import { describe, expect, it } from "vitest";
import { catalog as c } from "../src/catalog";
import { defaultRecipeForWater, defaultTarget } from "../src/defaults";
import { originalGravity, predict } from "../src/engine/calculations";
import {
  buildFromGoals,
  goalsSignature,
  restyleKeeping,
  styleGoals,
} from "../src/engine/goalBuild";
import {
  hopClashes,
  stylesForPick,
  suggestedMalts,
  unusualHop,
  unusualMalt,
  unusualPick,
  unusualYeast,
  yeastClashes,
} from "../src/engine/ingredientFit";
import { suggestedHopGroups } from "../src/engine/builder";
import { styleIngredientProfile } from "../src/engine/recommendations";
import {
  applyStartingPoint,
  startingPoints,
  styleMalts,
} from "../src/engine/suggestions";
import { waterForRecipe } from "../src/engine/waterPlan";
import type { Target } from "../src/engine/types";
import { recipeSchema } from "../src/validation";

const beerStyles = c.styles.filter((s) => styleIngredientProfile(s.id));
const goalsFor = (styleId: string, patch: Partial<Target> = {}): Target => {
  const { abv, ibu } = styleGoals(
    c.styles.find((s) => s.id === styleId)!,
    c,
    { abv: 5, ibu: 25, srm: 6 },
  );
  return {
    ...defaultTarget,
    styleId,
    abv,
    ibu,
    flavors: {},
    ...patch,
  };
};

describe("building a recipe from goals", () => {
  it("fills in every beer style at the brewer's water and targets", () => {
    expect(beerStyles).toHaveLength(80);
    for (const style of beerStyles) {
      const draft = { ...defaultRecipeForWater(), name: "My beer" };
      const goals = goalsFor(style.id);
      const built = buildFromGoals(draft, c, goals)!;
      const p = predict(built, c);
      expect(built.styleId, style.id).toBe(style.id);
      expect(built.name).toBe("My beer");
      expect(built.id).toBe(draft.id);
      expect(Math.abs(p.abv - goals.abv), style.id).toBeLessThan(0.3);
      expect(built.waterPlan!.startingWaterL).toBe(
        draft.waterPlan!.startingWaterL,
      );
      expect(waterForRecipe(built, c), style.id).toBeCloseTo(
        draft.waterPlan!.startingWaterL,
        5,
      );
      const profile = styleIngredientProfile(style.id)!;
      for (const g of built.grains)
        expect(profile.maltIds, style.id).toContain(g.ingredientId);
      expect(built.grains.length, style.id).toBeGreaterThan(0);
      expect(profile.yeastIds, style.id).toContain(built.yeastId);
      if (built.hops.some((h) => h.use === "boil"))
        expect(Math.abs(p.ibu - goals.ibu), style.id).toBeLessThan(0.01);
      expect(() => recipeSchema.parse(built), style.id).not.toThrow();
    }
  });

  it("keeps style targets believable and stops at what the water allows", () => {
    for (const style of beerStyles) {
      const goals = styleGoals(style, c, { abv: 5, ibu: 25, srm: 6 });
      expect(goals.abv, style.id).toBeLessThan(16);
      expect(goals.ibu, style.id).toBeLessThan(125);
    }
    const mead = c.styles.find((s) => s.id === "dry-mead")!;
    expect(styleGoals(mead, c, { abv: 11, ibu: 2, srm: 3 })).toEqual({
      abv: 11,
      ibu: 2,
      srm: 3,
    });
    const draft = defaultRecipeForWater();
    const impossible = buildFromGoals(
      draft,
      c,
      goalsFor("american-pale-ale", { abv: 50 }),
    )!;
    expect(waterForRecipe(impossible, c)).toBeCloseTo(
      draft.waterPlan!.startingWaterL,
      5,
    );
    expect(impossible.batchL).toBeGreaterThan(impossible.lossL);
  });

  it("makes different beers for different styles", () => {
    const draft = defaultRecipeForWater();
    const stout = buildFromGoals(draft, c, goalsFor("dry-stout"))!;
    const pils = buildFromGoals(draft, c, goalsFor("german-pilsner-pils"))!;
    expect(stout.grains.map((g) => g.ingredientId)).toContain(
      "m-roasted-barley",
    );
    expect(pils.grains.map((g) => g.ingredientId)).toEqual([
      "m-briess-pilsen-malt",
    ]);
    expect(predict(stout, c).srm).toBeGreaterThan(predict(pils, c).srm * 5);
    expect(stout.yeastId).not.toBe(pils.yeastId);
  });

  it("moves the specialty malts toward a color goal without losing the alcohol goal", () => {
    const draft = defaultRecipeForWater();
    const goals = goalsFor("american-amber-ale", { srm: 16 });
    const built = buildFromGoals(draft, c, goals)!;
    const p = predict(built, c);
    expect(Math.abs(p.srm - 16)).toBeLessThan(0.5);
    expect(p.abv).toBeCloseTo(goals.abv, 0);
  });

  it("respects ingredient limits, and swaps late hops only for a flavor goal", () => {
    const draft = defaultRecipeForWater();
    const plain = buildFromGoals(draft, c, goalsFor("american-pale-ale"))!;
    const banned = plain.grains[0].ingredientId;
    const hop = plain.hops[0].ingredientId;
    const limited = buildFromGoals(
      draft,
      c,
      goalsFor("american-pale-ale", { exclude: [banned, hop] }),
    )!;
    const used = [
      ...limited.grains.map((g) => g.ingredientId),
      ...limited.hops.map((h) => h.ingredientId),
    ];
    expect(used).not.toContain(banned);
    expect(used).not.toContain(hop);
    expect(limited.grains.length).toBeGreaterThan(0);
    const piney = buildFromGoals(
      draft,
      c,
      goalsFor("german-pilsner-pils", { flavors: { pine: 5, resin: 4 } }),
    )!;
    const noble = buildFromGoals(draft, c, goalsFor("german-pilsner-pils"))!;
    const late = (r: typeof piney) =>
      r.hops.filter((h) => h.use !== "boil" || h.minutes <= 20);
    if (late(noble).length)
      expect(late(piney)[0].ingredientId).not.toBe(late(noble)[0].ingredientId);
    expect(noble.grains).toEqual(piney.grains);
  });

  it("leaves cider and mead ingredients to the brewer", () => {
    const goals = { ...defaultTarget, styleId: "dry-mead" };
    expect(buildFromGoals(defaultRecipeForWater(), c, goals)).toBeUndefined();
  });

  it("only treats real goal choices as a change, so edits are never overwritten", () => {
    const goals = goalsFor("dry-stout");
    const built = buildFromGoals(defaultRecipeForWater(), c, goals)!;
    const saved = recipeSchema.parse(JSON.parse(JSON.stringify(built)));
    expect(goalsSignature(saved.designTargets!)).toBe(goalsSignature(goals));
    expect(
      goalsSignature({
        ...goals,
        batchL: 40,
        efficiency: 60,
        equipment: { boilMinutes: 90, boilOffLPerHour: 4, lossL: 2 },
      }),
    ).toBe(goalsSignature(goals));
    for (const patch of [
      { styleId: "witbier" },
      { abv: goals.abv + 1 },
      { ibu: goals.ibu + 5 },
      { srm: 30 },
      { flavors: { roast: 4 } },
      { exclude: ["m-roasted-barley"] },
    ])
      expect(goalsSignature({ ...goals, ...patch })).not.toBe(
        goalsSignature(goals),
      );
  });
});

describe("malt suggestions follow the beer style", () => {
  it("leads every style with its own malts, largest share first", () => {
    for (const style of beerStyles) {
      const recipe = { ...defaultRecipeForWater(), styleId: style.id };
      const rows = startingPoints("malt", c, recipe);
      const profile = styleIngredientProfile(style.id)!;
      const own = rows.filter((row) => row.item.fromStyle);
      expect(own.length, style.id).toBe(profile.maltIds.length);
      expect(rows.slice(0, own.length).every((row) => row.item.fromStyle)).toBe(
        true,
      );
      for (const row of rows) expect(row.matchesStyle, style.id).toBe(true);
      const biggest = [...profile.grist].sort(
        (a, b) => b.percent - a.percent,
      )[0];
      expect(styleMalts(style.id, c)[0].ingredientId, style.id).toBe(
        biggest.ingredientId,
      );
    }
  });

  it("drops malts that do not belong, and changes with the style", () => {
    const pick = (styleId: string) =>
      startingPoints("malt", c, { ...defaultRecipeForWater(), styleId }).map(
        (row) => row.item.ingredientId,
      );
    expect(pick("german-pilsner-pils")).not.toContain(
      "m-briess-2-row-chocolate-malt",
    );
    expect(pick("dry-stout")[0]).toBe("m-simpsons-maris-otter");
    expect(pick("dry-stout")).toContain("m-roasted-barley");
    expect(pick("weizen-weissbier")[0]).toBe("m-briess-wheat-malt-white");
    expect(
      startingPoints(
        "malt",
        c,
        { ...defaultRecipeForWater(), styleId: "german-pilsner-pils" },
        "match",
        undefined,
        "roast",
      ).filter((row) => row.item.fromStyle),
    ).toEqual([]);
    const popular = startingPoints(
      "malt",
      c,
      { ...defaultRecipeForWater(), styleId: "dry-stout" },
      "popular",
    );
    expect(popular).toHaveLength(8);
  });

  it("swaps in the main base malt and blends a second one", () => {
    const draft = { ...defaultRecipeForWater(), styleId: "weizen-weissbier" };
    const [wheat, pils] = styleMalts("weizen-weissbier", c);
    const swapped = applyStartingPoint(
      draft,
      c,
      "malt",
      wheat.ingredientId,
      "aroma",
      wheat,
    );
    expect(swapped.grains).toHaveLength(draft.grains.length);
    expect(swapped.grains[0].ingredientId).toBe(wheat.ingredientId);
    expect(
      originalGravity(swapped.grains, c.malts, draft.batchL, draft.efficiency),
    ).toBeCloseTo(
      originalGravity(draft.grains, c.malts, draft.batchL, draft.efficiency),
      10,
    );
    const blended = applyStartingPoint(
      swapped,
      c,
      "malt",
      pils.ingredientId,
      "aroma",
      pils,
    );
    expect(blended.grains).toHaveLength(swapped.grains.length + 1);
    expect(blended.grains[0].ingredientId).toBe(wheat.ingredientId);
    const total = blended.grains.reduce((sum, g) => sum + g.kg, 0);
    expect(blended.grains.at(-1)!.kg / total).toBeCloseTo(
      pils.percent! / 100,
      5,
    );
  });

  it("every suggested malt can be applied to a recipe of that style", () => {
    for (const style of beerStyles) {
      const recipe = { ...defaultRecipeForWater(), styleId: style.id };
      for (const row of startingPoints("malt", c, recipe)) {
        if (row.alreadyUsed) continue;
        const next = applyStartingPoint(
          recipe,
          c,
          "malt",
          row.item.ingredientId,
          "aroma",
          row.item,
        );
        expect(
          next.grains.some((g) => g.ingredientId === row.item.ingredientId),
          `${style.id} ${row.name}`,
        ).toBe(true);
        expect(() => predict(next, c)).not.toThrow();
      }
    }
  });
});

describe("the color goal chooses the malts", () => {
  it("reaches every color for every style while keeping the alcohol goal", () => {
    const draft = defaultRecipeForWater();
    const misses: string[] = [];
    for (const style of beerStyles)
      for (const srm of [4, 8, 15, 25, 35]) {
        const goals = goalsFor(style.id, { srm });
        const built = buildFromGoals(draft, c, goals)!;
        const p = predict(built, c);
        // A big beer can be too strong to get any paler, even on the palest malt alone.
        const palestAlready = built.grains.every(
          (g) => c.malts.find((m) => m.id === g.ingredientId)!.lovibond <= 2,
        );
        if (Math.abs(p.srm - srm) > 1 && !(p.srm > srm && palestAlready))
          misses.push(`${style.id} at ${srm}: ${p.srm.toFixed(1)}`);
        expect(Math.abs(p.abv - goals.abv), style.id).toBeLessThan(0.3);
        expect(waterForRecipe(built, c), style.id).toBeCloseTo(
          draft.waterPlan!.startingWaterL,
          5,
        );
      }
    expect(misses).toEqual([]);
  });

  it("adds color to a beer with no dark malts, and takes it away from a dark one", () => {
    const draft = defaultRecipeForWater();
    const tripel = buildFromGoals(
      draft,
      c,
      goalsFor("belgian-tripel", { srm: 15 }),
    )!;
    expect(predict(tripel, c).srm).toBeCloseTo(15, 0);
    expect(tripel.grains.length).toBeGreaterThan(
      buildFromGoals(draft, c, goalsFor("belgian-tripel"))!.grains.length,
    );
    const paleStout = buildFromGoals(
      draft,
      c,
      goalsFor("dry-stout", { srm: 6 }),
    )!;
    expect(predict(paleStout, c).srm).toBeCloseTo(6, 0);
    const total = paleStout.grains.reduce((sum, g) => sum + g.kg, 0);
    const roast = paleStout.grains.find(
      (g) => g.ingredientId === "m-roasted-barley",
    );
    expect((roast?.kg ?? 0) / total).toBeLessThan(0.01);
  });

  it("never pushes a malt far past its usual share, and respects limits", () => {
    const draft = defaultRecipeForWater();
    for (const srm of [15, 35]) {
      const built = buildFromGoals(
        draft,
        c,
        goalsFor("german-pilsner-pils", { srm }),
      )!;
      const total = built.grains.reduce((sum, g) => sum + g.kg, 0);
      for (const g of built.grains) {
        const malt = c.malts.find((m) => m.id === g.ingredientId)!;
        expect((100 * g.kg) / total, malt.name).toBeLessThanOrEqual(
          malt.maxPercent + 1,
        );
      }
    }
    const plain = buildFromGoals(
      draft,
      c,
      goalsFor("german-pilsner-pils", { srm: 25 }),
    )!;
    const added = plain.grains.at(-1)!.ingredientId;
    const limited = buildFromGoals(
      draft,
      c,
      goalsFor("german-pilsner-pils", { srm: 25, exclude: [added] }),
    )!;
    expect(limited.grains.map((g) => g.ingredientId)).not.toContain(added);
  });
});

describe("questioning a strange malt", () => {
  const pils = buildFromGoals(
    defaultRecipeForWater(),
    c,
    goalsFor("german-pilsner-pils"),
  )!;
  const withMalt = (recipe: typeof pils, id: string, kg = 0.25) => ({
    ...recipe,
    grains: [...recipe.grains, { ingredientId: id, kg }],
  });
  const swapBase = (recipe: typeof pils, id: string) => ({
    ...recipe,
    grains: recipe.grains.map((g, i) =>
      i === 0 ? { ...g, ingredientId: id } : g,
    ),
  });

  it("questions roast, dark caramel and smoke in a pale beer", () => {
    for (const id of [
      "m-roasted-barley",
      "m-briess-2-row-caramel-malt-80l",
      "m-rauch-malt-germany",
    ])
      expect(
        unusualMalt(pils, withMalt(pils, id), id, c).length,
        id,
      ).toBeGreaterThan(0);
  });

  it("explains a pick that takes the color out of the style", () => {
    const id = "m-briess-munich-malt-20l";
    const reasons = unusualMalt(pils, swapBase(pils, id), id, c);
    expect(reasons.join(" ")).toMatch(/SRM/);
  });

  it("leaves another brand of the same thing alone", () => {
    for (const id of [
      "m-pilsner-2-row-ger",
      "m-weyermann-pilsner-malt",
      "m-briess-carapils-malt",
    ])
      expect(unusualMalt(pils, withMalt(pils, id), id, c), id).toEqual([]);
    const ipa = buildFromGoals(
      defaultRecipeForWater(),
      c,
      goalsFor("american-ipa"),
    )!;
    const crystal = "m-caramel-crystal-malt-60l";
    expect(unusualMalt(ipa, withMalt(ipa, crystal), crystal, c)).toEqual([]);
  });

  it("never questions a style's own malts at their usual amount", () => {
    for (const style of beerStyles) {
      const built = buildFromGoals(
        defaultRecipeForWater(),
        c,
        goalsFor(style.id),
      )!;
      for (const g of built.grains) {
        const without = {
          ...built,
          grains: built.grains.filter((x) => x !== g),
        };
        if (!without.grains.length) continue;
        expect(
          unusualMalt(without, built, g.ingredientId, c),
          `${style.id} ${g.ingredientId}`,
        ).toEqual([]);
      }
    }
  });

  it("doesn't question cider, mead, or a beer with no style", () => {
    for (const styleId of ["dry-mead", ""]) {
      const recipe = { ...pils, styleId };
      const id = "m-roasted-barley";
      expect(unusualMalt(recipe, withMalt(recipe, id), id, c)).toEqual([]);
    }
  });

  it("doesn't question color when chasing a goal set outside the style", () => {
    const id = "m-briess-2-row-caramel-malt-80l";
    expect(unusualMalt(pils, withMalt(pils, id), id, c, 20)).toEqual([]);
  });

  it("offers styles that suit the malt", () => {
    const id = "m-roasted-barley";
    const dark = withMalt(pils, id, 0.5);
    const options = stylesForPick(dark, { kind: "malt", id }, c);
    expect(options).toHaveLength(3);
    expect(options.map((s) => s.id)).not.toContain("german-pilsner-pils");
    const srm = predict(dark, c).srm;
    expect(options[0].srm[1]).toBeGreaterThan(srm - 5);
    for (const s of options) expect(s.srm[1], s.id).toBeGreaterThanOrEqual(15);
  });

  it("changes style without touching the malts or asking to rebuild", () => {
    const id = "m-roasted-barley";
    const dark = withMalt(pils, id, 0.5);
    const goals = { ...dark.designTargets!, srm: 4 };
    const { recipe, target } = restyleKeeping(
      dark,
      c,
      goals,
      "dry-stout",
      "malt",
    );
    expect(recipe.grains).toEqual(dark.grains);
    expect(recipe.styleId).toBe("dry-stout");
    expect(target.styleId).toBe("dry-stout");
    expect(goalsSignature(recipe.designTargets!)).toBe(goalsSignature(target));
    expect(styleIngredientProfile("dry-stout")!.yeastIds).toContain(
      recipe.yeastId,
    );
    const p = predict(recipe, c);
    expect(Math.abs(p.ibu - target.ibu)).toBeLessThan(0.5);
    expect(target.abv).toBeCloseTo(p.abv, 1);
    expect(target.srm).toBeCloseTo(p.srm, 1);
    expect(waterForRecipe(recipe, c)).toBeCloseTo(waterForRecipe(dark, c), 5);
  });

  it("can move to a style with no beer recipe", () => {
    const { recipe } = restyleKeeping(
      pils,
      c,
      pils.designTargets!,
      "dry-mead",
      "malt",
    );
    expect(recipe.styleId).toBe("dry-mead");
    expect(recipe.hops).toEqual(pils.hops);
  });
});

describe("suggesting malts while changing one", () => {
  const ipa = buildFromGoals(
    defaultRecipeForWater(),
    c,
    goalsFor("american-ipa"),
  )!;

  it("offers the style's malts when adding, skipping those already used", () => {
    const options = suggestedMalts(ipa, c);
    expect(options.length).toBeGreaterThan(0);
    const used = ipa.grains.map((g) => g.ingredientId);
    for (const o of options) expect(used).not.toContain(o.id);
    expect(options[0].note).toBe("Used in this style");
  });

  it("offers similar malts when swapping, none of them strange", () => {
    for (const style of beerStyles) {
      const built = buildFromGoals(
        defaultRecipeForWater(),
        c,
        goalsFor(style.id),
      )!;
      const first = built.grains[0].ingredientId;
      const type = c.malts.find((m) => m.id === first)!.type;
      const options = suggestedMalts(built, c, first);
      expect(options.length, style.id).toBeGreaterThan(0);
      expect(c.malts.find((m) => m.id === options[0].id)!.type, style.id).toBe(
        type,
      );
      for (const o of options) {
        const swapped = {
          ...built,
          grains: built.grains.map((g) =>
            g.ingredientId === first ? { ...g, ingredientId: o.id } : g,
          ),
        };
        expect(
          unusualMalt(built, swapped, o.id, c),
          `${style.id} ${o.id}`,
        ).toEqual([]);
      }
    }
  });
});

const yeastNamed = (name: string) => c.yeasts.find((y) => y.name === name)!;
const hopNamed = (name: string) => c.hops.find((h) => h.name === name)!;
const builtFor = (styleId: string) =>
  buildFromGoals(defaultRecipeForWater(), c, goalsFor(styleId))!;

describe("questioning a strange yeast", () => {
  const withYeast = (recipe: ReturnType<typeof builtFor>, name: string) => {
    const yeastId = yeastNamed(name).id;
    return { after: { ...recipe, yeastId }, yeastId };
  };

  it("explains a yeast from the wrong family", () => {
    const cases: [string, string, RegExp][] = [
      ["american-ipa", "German Bock Lager", /lager yeast/],
      ["german-pilsner-pils", "California Ale", /ale yeast/],
      ["american-pale-ale", "Hefeweizen Ale", /banana and clove/],
      ["dry-stout", "French Saison", /Belgian-style/],
      ["german-pilsner-pils", "Roeselare Ale Blend", /wild or souring/],
      ["weizen-weissbier", "California Ale", /banana and clove/],
      ["belgian-tripel", "California Ale", /fruity, peppery/],
    ];
    for (const [styleId, name, why] of cases) {
      const recipe = builtFor(styleId);
      const { after, yeastId } = withYeast(recipe, name);
      expect(
        unusualYeast(recipe, after, yeastId, c).join(" "),
        `${name} in ${styleId}`,
      ).toMatch(why);
    }
  });

  it("flags wine and baking yeasts in beer", () => {
    const recipe = builtFor("american-pale-ale");
    for (const y of c.yeasts.filter((y) =>
      ["wine", "champagne", "baking"].includes(y.type),
    ))
      expect(yeastClashes(y.id, "american-pale-ale", c), y.name).toBe(true);
    expect(recipe.yeastId).toBeTruthy();
  });

  it("leaves a yeast of the same family alone", () => {
    const pairs: [string, string][] = [
      ["american-ipa", "SafAle US-05"],
      ["american-ipa", "Dry English Ale"],
      ["german-pilsner-pils", "German Lager"],
      ["belgian-tripel", "French Saison"],
      ["weizen-weissbier", "Hefeweizen Ale"],
    ];
    for (const [styleId, name] of pairs)
      expect(yeastClashes(yeastNamed(name).id, styleId, c), name).toBe(false);
  });

  it("never questions a style's own yeasts", () => {
    for (const style of beerStyles)
      for (const id of styleIngredientProfile(style.id)!.yeastIds) {
        const recipe = builtFor(style.id);
        const other = c.yeasts.find((y) => y.id !== id)!;
        expect(
          unusualYeast(
            { ...recipe, yeastId: other.id },
            { ...recipe, yeastId: id },
            id,
            c,
          ),
          `${style.id} ${id}`,
        ).toEqual([]);
      }
  });

  it("warns when the beer is stronger than the yeast can handle", () => {
    const recipe = builtFor("american-barleywine");
    const weak = c.yeasts.find(
      (y) =>
        y.type === "ale" &&
        y.alcoholTolerance !== null &&
        y.alcoholTolerance < predict(recipe, c).abv - 1 &&
        !yeastClashes(y.id, recipe.styleId, c),
    )!;
    expect(
      unusualYeast(recipe, { ...recipe, yeastId: weak.id }, weak.id, c).join(),
    ).toMatch(/alcohol/);
  });

  it("offers styles that suit the yeast, and changing style keeps everything chosen", () => {
    const recipe = builtFor("german-pilsner-pils");
    const { after, yeastId } = withYeast(recipe, "Hefeweizen Ale");
    const options = stylesForPick(after, { kind: "yeast", id: yeastId }, c);
    expect(options.length).toBeGreaterThan(0);
    for (const s of options) expect(yeastClashes(yeastId, s.id, c)).toBe(false);
    const moved = restyleKeeping(
      after,
      c,
      recipe.designTargets!,
      options[0].id,
      "yeast",
    );
    expect(moved.recipe.yeastId).toBe(yeastId);
    expect(moved.recipe.grains).toEqual(after.grains);
    expect(moved.recipe.hops).toEqual(after.hops);
    expect(moved.recipe.styleId).toBe(options[0].id);
    const y = c.yeasts.find((x) => x.id === yeastId)!;
    expect(moved.recipe.fermentC).toBeGreaterThanOrEqual(y.tempC![0]);
    expect(moved.recipe.fermentC).toBeLessThanOrEqual(y.tempC![1]);
    expect(goalsSignature(moved.recipe.designTargets!)).toBe(
      goalsSignature(moved.target),
    );
  });
});

describe("questioning a strange hop", () => {
  const addHop = (
    recipe: ReturnType<typeof builtFor>,
    name: string,
    use: "boil" | "whirlpool" | "dry hop" = "whirlpool",
    minutes = 20,
    grams = 20,
  ) => {
    const ingredientId = hopNamed(name).id;
    return {
      after: {
        ...recipe,
        hops: [...recipe.hops, { ingredientId, grams, use, minutes }],
      },
      ingredientId,
    };
  };
  const noGoals = { ibu: 35, flavors: {} };

  it("explains a bold late hop in a restrained style", () => {
    for (const styleId of ["dry-stout", "munich-helles", "belgian-tripel"]) {
      const recipe = builtFor(styleId);
      const { after, ingredientId } = addHop(recipe, "Citra");
      expect(
        unusualHop(recipe, after, ingredientId, c, {
          ...noGoals,
          ibu: goalsFor(styleId).ibu,
        }).join(" "),
        styleId,
      ).toMatch(/grapefruit/);
    }
  });

  it("doesn't mind bold hops in hop-forward styles, or restrained hops anywhere", () => {
    const ipa = builtFor("american-ipa");
    const { after, ingredientId } = addHop(ipa, "Mosaic");
    expect(
      unusualHop(ipa, after, ingredientId, c, { ibu: 55, flavors: {} }),
    ).toEqual([]);
    for (const name of [
      "Saaz (CZ)",
      "Hallertau Mittelfrüh",
      "East Kent Goldings",
      "Magnum (GR)",
    ])
      for (const style of beerStyles)
        expect(
          hopClashes(hopNamed(name).id, style.id, c),
          `${name} in ${style.id}`,
        ).toBe(false);
  });

  it("doesn't question flavor from a long boil, or a flavor the brewer asked for", () => {
    const stout = builtFor("dry-stout");
    const boiled = addHop(stout, "Citra", "boil", 60, 2);
    expect(
      unusualHop(stout, boiled.after, boiled.ingredientId, c, {
        ibu: goalsFor("dry-stout").ibu,
        flavors: {},
      }),
    ).toEqual([]);
    const late = addHop(stout, "Citra");
    expect(
      unusualHop(stout, late.after, late.ingredientId, c, {
        ibu: goalsFor("dry-stout").ibu,
        flavors: { grapefruit: 3 },
      }),
    ).toEqual([]);
  });

  it("explains a hop that takes bitterness out of the style", () => {
    const helles = builtFor("munich-helles");
    const { after, ingredientId } = addHop(
      helles,
      "Magnum (GR)",
      "boil",
      60,
      80,
    );
    expect(
      unusualHop(helles, after, ingredientId, c, {
        ibu: goalsFor("munich-helles").ibu,
        flavors: {},
      }).join(" "),
    ).toMatch(/IBU/);
  });

  it("never questions a style's own hops", () => {
    for (const style of beerStyles)
      for (const id of styleIngredientProfile(style.id)!.hopIds)
        expect(hopClashes(id, style.id, c), `${style.id} ${id}`).toBe(false);
  });

  it("doesn't suggest a hop it would then question", () => {
    for (const style of beerStyles) {
      const goals = goalsFor(style.id);
      for (const group of suggestedHopGroups(goals, c))
        if (group.role !== "bittering")
          for (const match of group.matches)
            expect(
              hopClashes(match.id, style.id, c, goals.flavors),
              `${style.id} ${match.id}`,
            ).toBe(false);
    }
  });

  it("offers styles that suit the hop, and changing style keeps malts and hops", () => {
    const helles = builtFor("munich-helles");
    const { after, ingredientId } = addHop(helles, "Citra");
    const options = stylesForPick(after, { kind: "hop", id: ingredientId }, c);
    expect(options.length).toBeGreaterThan(0);
    for (const s of options)
      expect(hopClashes(ingredientId, s.id, c), s.id).toBe(false);
    const moved = restyleKeeping(
      after,
      c,
      helles.designTargets!,
      options[0].id,
      "hop",
    );
    expect(moved.recipe.hops).toEqual(after.hops);
    expect(moved.recipe.grains).toEqual(after.grains);
    expect(moved.recipe.yeastId).not.toBe(after.yeastId);
    expect(moved.target.ibu).toBe(Math.round(predict(after, c).ibu));
  });
});

describe("finding the pick in an edit", () => {
  const recipe = builtFor("german-pilsner-pils");
  const goals = { ibu: 35, flavors: {} };

  it("finds a new malt, hop or yeast, and ignores amount changes", () => {
    const malt = {
      ...recipe,
      grains: [...recipe.grains, { ingredientId: "m-roasted-barley", kg: 0.5 }],
    };
    expect(unusualPick(recipe, malt, c, goals)?.kind).toBe("malt");
    const hop = {
      ...recipe,
      hops: [
        ...recipe.hops,
        {
          ingredientId: hopNamed("Citra").id,
          grams: 20,
          use: "whirlpool" as const,
          minutes: 20,
        },
      ],
    };
    expect(unusualPick(recipe, hop, c, goals)?.kind).toBe("hop");
    const yeast = { ...recipe, yeastId: yeastNamed("California Ale").id };
    const pick = unusualPick(recipe, yeast, c, goals)!;
    expect(pick.kind).toBe("yeast");
    expect(pick.name).toBe("California Ale");
    const amounts = {
      ...recipe,
      grains: recipe.grains.map((g) => ({ ...g, kg: g.kg * 1.5 })),
      hops: recipe.hops.map((h) => ({ ...h, grams: h.grams * 3 })),
    };
    expect(unusualPick(recipe, amounts, c, goals)).toBeUndefined();
  });

  it("doesn't ask again about a pick already answered", () => {
    const yeast = { ...recipe, yeastId: yeastNamed("California Ale").id };
    expect(unusualPick(recipe, yeast, c, goals, () => true)).toBeUndefined();
  });
});

describe("moving a hop to a late addition", () => {
  const stout = builtFor("dry-stout");
  const goals = { ibu: goalsFor("dry-stout").ibu, flavors: {} };
  const citra = hopNamed("Citra").id;
  const boiled = {
    ...stout,
    hops: [
      ...stout.hops,
      { ingredientId: citra, grams: 2, use: "boil" as const, minutes: 60 },
    ],
  };
  const moved = (patch: Partial<(typeof boiled.hops)[number]>) => ({
    ...boiled,
    hops: boiled.hops.map((h) =>
      h.ingredientId === citra ? { ...h, ...patch } : h,
    ),
  });

  it("asks when a bold hop moves late, by menu or by time", () => {
    for (const patch of [
      { use: "whirlpool" as const, minutes: 20 },
      { use: "dry hop" as const, minutes: 4320 },
      { minutes: 15 },
    ]) {
      const pick = unusualPick(boiled, moved(patch), c, goals)!;
      expect(pick.kind).toBe("hop");
      expect(pick.id).toBe(citra);
      expect(pick.reasons.join(" ")).toMatch(/grapefruit/);
    }
  });

  it("doesn't ask while the hop stays in a long boil, or was already late", () => {
    expect(
      unusualPick(boiled, moved({ minutes: 45 }), c, goals),
    ).toBeUndefined();
    const whirlpool = moved({ use: "whirlpool", minutes: 20 });
    expect(
      unusualPick(
        whirlpool,
        moved({ use: "dry hop", minutes: 4320 }),
        c,
        goals,
      ),
    ).toBeUndefined();
    const restrained = {
      ...stout,
      hops: stout.hops.map((h) => ({
        ...h,
        use: "boil" as const,
        minutes: 60,
      })),
    };
    const late = {
      ...restrained,
      hops: restrained.hops.map((h) => ({ ...h, minutes: 10 })),
    };
    expect(unusualPick(restrained, late, c, goals)).toBeUndefined();
  });

  it("doesn't ask when the flavor goals want it", () => {
    expect(
      unusualPick(boiled, moved({ minutes: 15 }), c, {
        ...goals,
        flavors: { grapefruit: 3 },
      }),
    ).toBeUndefined();
  });

  it("asks again about flavor after only bitterness was answered", () => {
    const answered = new Set(["dry-stout|" + citra]);
    expect(
      unusualPick(boiled, moved({ minutes: 15 }), c, goals, (key) =>
        answered.has(key),
      )?.answerKey,
    ).toBe(`dry-stout|${citra}|late`);
    answered.add(`dry-stout|${citra}|late`);
    expect(
      unusualPick(boiled, moved({ minutes: 15 }), c, goals, (key) =>
        answered.has(key),
      ),
    ).toBeUndefined();
  });
});
