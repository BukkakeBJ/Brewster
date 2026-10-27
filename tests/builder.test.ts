import { expect, it } from "vitest";
import { catalog } from "../src/catalog";
import {
  defaultRecipe,
  defaultRecipeForWater,
  defaultTarget,
} from "../src/defaults";
import {
  addSuggestedHop,
  recipeAtFixedWater,
  suggestedHopGroups,
} from "../src/engine/builder";
import { predict, L_PER_GAL, scaleRecipe } from "../src/engine/calculations";
import { waterForRecipe, waterSettings } from "../src/engine/waterPlan";
import { solve } from "../src/engine/solver";
import { ingredientBrief } from "../src/engine/ingredientBrief";
import { createAdditiveAddition } from "../src/engine/additives";
import { recipeSchema } from "../src/validation";
import { exportBeerXML, importRecipe } from "../src/io";

it("holds starting water while honoring manual grain weights, with no hop or yeast edits", () => {
  const recipe = defaultRecipeForWater();
  const edited = {
    ...recipe,
    grains: recipe.grains.map((g) => ({ ...g, kg: g.kg + 0.1 })),
  };
  const result = recipeAtFixedWater(edited, catalog, 5 * L_PER_GAL);
  expect(waterForRecipe(result, catalog)).toBeCloseTo(5 * L_PER_GAL, 10);
  expect(result.batchL).toBeCloseTo(recipe.batchL - 0.16, 10);
  expect(result.grains).toEqual(edited.grains);
  expect(result.hops).toEqual(recipe.hops);
  expect(result.yeastId).toBe(recipe.yeastId);
  expect(() =>
    recipeAtFixedWater(
      { ...edited, boilOffLPerHour: NaN },
      catalog,
      5 * L_PER_GAL,
    ),
  ).toThrow(/settings/);
  expect(() =>
    recipeAtFixedWater(
      { ...edited, grains: [{ ...edited.grains[0], kg: 100 }] },
      catalog,
      5 * L_PER_GAL,
    ),
  ).toThrow(/water/);
});

it("generates candidates that balance a fixed water budget and the requested ABV and IBU", () => {
  const settings = waterSettings(defaultRecipeForWater(), catalog);
  const candidates = solve(
    { ...defaultTarget, abv: 6.2, ibu: 45, waterPlan: settings },
    catalog,
    30,
  );
  expect(candidates).toHaveLength(3);
  for (const candidate of candidates) {
    expect(
      waterForRecipe(candidate.recipe, catalog, settings.absorptionLPerKg),
    ).toBeCloseTo(5 * L_PER_GAL, 8);
    expect(candidate.recipe.waterPlan).toEqual(settings);
    expect(candidate.prediction).toEqual(predict(candidate.recipe, catalog));
    expect(candidate.prediction.abv).toBeCloseTo(6.2, 1);
    expect(candidate.prediction.ibu).toBeCloseTo(45, 1);
  }
});

it("offers three hops for each role, responds to flavor and respects hard inventory constraints", () => {
  const tropical = suggestedHopGroups(
    { ...defaultTarget, flavors: { tropical: 5 }, matchHopFlavor: true },
    catalog,
  );
  const floral = suggestedHopGroups(
    { ...defaultTarget, flavors: { floral: 5 }, matchHopFlavor: true },
    catalog,
  );
  expect(tropical.map((group) => group.role)).toEqual([
    "aroma",
    "bittering",
    "flavor",
  ]);
  for (const group of tropical) {
    expect(group.matches).toHaveLength(3);
    expect(new Set(group.matches.map((h) => h.id)).size).toBe(3);
  }
  expect(tropical[0].matches.map((m) => m.id)).not.toEqual(
    floral[0].matches.map((m) => m.id),
  );
  const only = catalog.hops.find((h) => h.name === "Cascade")!;
  for (const group of suggestedHopGroups(
    { ...defaultTarget, onHand: [only.id] },
    catalog,
  ))
    expect(group.matches.every((m) => m.id === only.id)).toBe(true);
  for (const group of suggestedHopGroups(
    { ...defaultTarget, onHand: [only.id], exclude: [only.id] },
    catalog,
  ))
    expect(group.matches).toEqual([]);
});

it("doses suggested hops by volume and fills only remaining calculated bittering", () => {
  const hop = catalog.hops.find((h) => h.name === "Cascade")!;
  const base = { ...defaultRecipe, hops: [] };
  for (const role of ["aroma", "flavor", "dry hop"] as const) {
    const small = addSuggestedHop(base, catalog, hop.id, role, 35);
    const large = addSuggestedHop(
      { ...base, batchL: 40 },
      catalog,
      hop.id,
      role,
      35,
    );
    expect(large.hops[0].grams).toBeCloseTo(small.hops[0].grams * 2, 10);
  }
  const bitter = addSuggestedHop(base, catalog, hop.id, "bittering", 35);
  expect(predict(bitter, catalog).ibu).toBeCloseTo(35, 8);
  expect(() =>
    addSuggestedHop(bitter, catalog, hop.id, "bittering", 20),
  ).toThrow(/already/);
  expect(() =>
    addSuggestedHop(
      { ...base, boilMinutes: 0 },
      catalog,
      hop.id,
      "bittering",
      35,
    ),
  ).toThrow(/boil/);
});

it("keeps reference acid specs separate from context-specific sensory previews", () => {
  const hop = catalog.hops.find((h) => h.name === "Cascade")!;
  const evidence = catalog.descriptors[0];
  const contextual = {
    ...catalog,
    descriptors: [
      {
        ...evidence,
        id: "late",
        ingredientId: hop.id,
        descriptor: "citrus",
        context: { use: "whirlpool" },
        intensity: 4,
      },
      {
        ...evidence,
        id: "dry",
        ingredientId: hop.id,
        descriptor: "pine",
        context: { use: "dry hop" },
        intensity: 3,
      },
    ],
  };
  const late = ingredientBrief(hop, contextual, { use: "whirlpool" });
  const dry = ingredientBrief(hop, contextual, { use: "dry hop" });
  expect(late.specs).toContainEqual(["Alpha acids", `${hop.alpha.join("–")}%`]);
  expect(late.specs.some(([key]) => key === "Beta acids")).toBe(true);
  expect(late.flavors).toEqual(["Citrus"]);
  expect(dry.flavors).toEqual(["Pine"]);
  expect(late.text).toContain("REFERENCE SPECS");
  expect(late.text).toContain("FLAVOR ESTIMATE");
  const unknown = {
    ...catalog.yeasts[0],
    attenuation: null,
    alcoholTolerance: null,
    tempC: null,
  };
  expect(ingredientBrief(unknown, catalog).specs).toContainEqual([
    "Alcohol tolerance",
    "Unknown for brewing",
  ]);
});

it("round-trips water assumptions, goals and explicit whirlpool/steep stages in JSON and BeerXML", () => {
  const recipe = {
    ...defaultRecipeForWater(),
    designTargets: { ...defaultTarget, srm: undefined },
    additives: [
      {
        ...createAdditiveAddition("a-orange-peel", 20, "peel"),
        stage: "whirlpool" as const,
        time: 15,
      },
      {
        ...createAdditiveAddition("a-cocoa-nibs", 20, "nibs"),
        stage: "steep-dry-hop" as const,
        notes: "Taste each day",
      },
    ],
    processNotes: {
      whirlpool: "Use a shorter stand",
      "steep-dry-hop": "Remove at the desired extraction",
    },
  };
  const parsed = recipeSchema.parse(recipe);
  for (const text of [
    JSON.stringify(recipe),
    exportBeerXML(recipe, catalog),
    exportBeerXML(recipe, catalog).replace(
      /<BD_ADDITIVES>.*?<\/BD_ADDITIVES>/s,
      "",
    ),
  ]) {
    const imported = importRecipe(text, catalog, defaultRecipe);
    expect(imported.waterPlan).toEqual(recipe.waterPlan);
    expect(imported.designTargets).toEqual(parsed.designTargets);
    expect(imported.additives).toEqual(recipe.additives);
    expect(imported.processNotes).toEqual(recipe.processNotes);
  }
  const scaled = scaleRecipe(
    recipe,
    recipe.batchL * 2,
    recipe.efficiency,
    catalog,
  );
  expect(scaled.waterPlan?.startingWaterL).toBeCloseTo(
    waterForRecipe(scaled, catalog),
    10,
  );
});
