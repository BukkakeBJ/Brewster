import { it, expect } from "vitest";
import {
  additives,
  additiveDescriptors,
  createAdditiveAddition,
  displayAdditiveAmount,
  canonicalAdditiveAmount,
  findAdditives,
  additiveModelNote,
} from "../src/engine/additives";
import { defaultRecipe as r } from "../src/defaults";
import { catalog as c } from "../src/catalog";
import { predict, scaleRecipe } from "../src/engine/calculations";
import { recipeSchema } from "../src/validation";
import {
  copyBookRecipe,
  readDraftBank,
  recipeBookEntries,
  filterBook,
} from "../src/engine/recipeBook";
import { importRecipe, exportBeerXML } from "../src/io";
it("ships sourced additive identities and separate subjective evidence with usable category/stage search", () => {
  expect(additives).toHaveLength(24);
  expect(new Set(additives.map((a) => a.id)).size).toBe(24);
  for (const a of additives) {
    expect(a.source.url).toMatch(/^https:/);
    expect(a.guide.how).toBeTruthy();
    expect(a.guide.limits).toBeTruthy();
    expect(a.guide.amountPer20L).toBeGreaterThanOrEqual(0);
  }
  for (const d of additiveDescriptors) {
    expect(additives.some((a) => a.id === d.ingredientId)).toBe(true);
    expect(c.vocabulary.some((v) => v.id === d.descriptor)).toBe(true);
    expect(d.confidence).toBe("low");
  }
  expect(findAdditives("cacao")[0].id).toBe("a-cocoa-nibs");
  expect(findAdditives("oak", "Wood & spirits", "conditioning")).toHaveLength(
    2,
  );
  expect(findAdditives("Irish moss", "", "boil")[0].id).toBe("a-irish-moss");
});
it("scales additive doses by volume, not brewhouse efficiency, preserving timing and notes", () => {
  const nibs = {
    ...createAdditiveAddition("a-cocoa-nibs", 20, "nibs"),
    notes: "Taste on days 3 and 7",
  };
  const bourbon = createAdditiveAddition("a-bourbon", 20, "bourbon");
  const recipe = { ...r, additives: [nibs, bourbon] };
  const doubled = scaleRecipe(recipe, 40, 60, c);
  expect(doubled.additives?.map((a) => a.amount)).toEqual([200, 400]);
  expect(doubled.additives?.[0].notes).toBe(nibs.notes);
  expect(doubled.additives?.[0].time).toBe(7);
  expect(scaleRecipe(recipe, 20, 60, c).additives).toEqual(recipe.additives);
  expect(
    canonicalAdditiveAmount(
      displayAdditiveAmount(100, "g", true).amount,
      "g",
      true,
    ),
  ).toBeCloseTo(100, 10);
  expect(
    canonicalAdditiveAmount(
      displayAdditiveAmount(200, "mL", true).amount,
      "mL",
      true,
    ),
  ).toBeCloseTo(200, 10);
  expect(displayAdditiveAmount(0.5, "item", true).amount).toBe(0.5);
});
it("persists addition experiments in schema, drafts, copies, JSON, and BeerXML", () => {
  const recipe = {
    ...r,
    additives: [
      {
        ...createAdditiveAddition("a-cocoa-nibs", 20, "nibs"),
        notes: "Spirit soak; remove at desired extraction",
      },
      createAdditiveAddition("a-bourbon", 20, "bourbon"),
      { ...createAdditiveAddition("a-whirlfloc", 20, "whirl"), amount: 0.5 },
    ],
  };
  expect(recipeSchema.parse(recipe).additives).toEqual(recipe.additives);
  expect(
    readDraftBank(JSON.stringify({ draft: recipe }))[r.id].additives,
  ).toEqual(recipe.additives);
  const copy = copyBookRecipe(recipe, "copy");
  copy.additives![0].notes = "changed";
  expect(recipe.additives[0].notes).not.toBe("changed");
  expect(
    filterBook(recipeBookEntries([recipe], {}), c, {
      query: "cocoa spirit soak",
    }),
  ).toHaveLength(1);
  for (const text of [JSON.stringify(recipe), exportBeerXML(recipe, c)])
    expect(importRecipe(text, c, r).additives).toEqual(recipe.additives);
  const noExtension = exportBeerXML(recipe, c).replace(
    /<BD_ADDITIVES>.*?<\/BD_ADDITIVES>/s,
    "",
  );
  expect(importRecipe(noExtension, c, r).additives).toEqual(recipe.additives);
  expect(importRecipe(exportBeerXML(r, c), c, recipe).additives).toEqual([]);
});
it("keeps additive effects outside base-beer predictions and reports missing doses and invalid records", () => {
  const recipe = {
    ...r,
    additives: [
      createAdditiveAddition("a-bourbon", 20, "b"),
      createAdditiveAddition("a-irish-moss", 20, "i"),
    ],
  };
  const base = predict(r, c),
    added = predict(recipe, c);
  expect(added.abv).toBe(base.abv);
  expect(added.og).toBe(base.og);
  expect(added.ibu).toBe(base.ibu);
  expect(added.warnings).toContain(additiveModelNote);
  expect(
    added.warnings.some((w) => w.includes("Irish moss: set an amount")),
  ).toBe(true);
  expect(() =>
    recipeSchema.parse({
      ...recipe,
      additives: [{ ...recipe.additives[0], amount: -1 }],
    }),
  ).toThrow();
  expect(() =>
    recipeSchema.parse({
      ...recipe,
      additives: [{ ...recipe.additives[0], unit: "g" }],
    }),
  ).toThrow();
  expect(() =>
    recipeSchema.parse({
      ...recipe,
      additives: [{ ...recipe.additives[0], ingredientId: "unknown" }],
    }),
  ).toThrow();
});
