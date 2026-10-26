import { describe, it, expect } from "vitest";
import {
  sameRecipe,
  isCraftRecipe,
  recipeOriginLabel,
  starterRecipes,
  recipeBookEntries,
  filterBook,
  copyBookRecipe,
  readDraftBank,
} from "../src/engine/recipeBook";
import { catalog as c } from "../src/catalog";
import { defaultRecipe as r } from "../src/defaults";
import { predict } from "../src/engine/calculations";
import { exportBeerXML, importRecipe } from "../src/io";
describe("recipe book", () => {
  it("ships usable labeled recipes with valid ingredient references and attribution", () => {
    expect(starterRecipes).toHaveLength(19);
    expect(starterRecipes.filter(isCraftRecipe)).toHaveLength(12);
    for (const r of starterRecipes) {
      expect(Number.isFinite(predict(r, c).abv)).toBe(true);
      expect(r.description).toBeTruthy();
      expect(r.notes).toBeTruthy();
      expect(r.origin?.kind).toMatch(
        /original-starter|published-adaptation|published-clone|clone-inspired/,
      );
    }
    const published = starterRecipes.find(
      (r) => r.origin?.kind === "published-adaptation",
    )!;
    expect(published.origin?.url).toMatch(/^https:\/\/sierranevada/);
    expect(
      published.grains[1].kg / published.grains.reduce((s, g) => s + g.kg, 0),
    ).toBeCloseTo(0.08);
    expect(published.hops.map((h) => h.minutes)).toEqual([90, 60, 30, 0]);
  });
  it("combines saved recipes and drafts without duplicating IDs, preserving unsaved edits", () => {
    const edited = { ...r, name: "Unsaved change" };
    const entries = recipeBookEntries([r], {
      [r.id]: edited,
      new: { ...r, id: "new" },
    });
    const mine = entries.filter((e) => e.collection === "mine");
    expect(mine).toHaveLength(1);
    expect(mine[0].recipe.name).toBe("Unsaved change");
    expect(mine[0].unsaved).toBe(true);
    const { name, ...rest } = r;
    expect(sameRecipe(r, { ...rest, name })).toBe(true);
    expect(entries.filter((e) => e.collection === "draft")).toHaveLength(1);
  });
  it("filters recipe names, ingredients, styles, tags and collections", () => {
    const entries = recipeBookEntries([r], {});
    expect(filterBook(entries, c, { collection: "mine" })).toHaveLength(1);
    expect(
      filterBook(entries, c, { query: "Cascade", collection: "starter" })
        .length,
    ).toBeGreaterThan(0);
    expect(filterBook(entries, c, { query: "nonsense-token" })).toHaveLength(0);
    expect(filterBook(entries, c, { styleId: "oatmeal-stout" })).toHaveLength(
      1,
    );
  });
  it("creates independent copies and retains provenance through exchange", () => {
    const original = starterRecipes.find(
      (r) => r.origin?.kind === "clone-inspired",
    )!;
    const copy = copyBookRecipe(original, "new-copy");
    copy.grains[0].kg = 99;
    expect(original.grains[0].kg).not.toBe(99);
    expect(copy.origin).toEqual(original.origin);
    const imported = importRecipe(exportBeerXML(original, c), c, r);
    expect(imported.origin).toEqual(original.origin);
    expect(imported.description).toBe(original.description);
    expect(imported.notes).toBe(original.notes);
    expect(imported.tags).toEqual(original.tags);
  });
  it("separates brewery recipes, published clones and house approximations and filters by brewery", () => {
    const entries = recipeBookEntries([], {});
    const craft = filterBook(entries, c, { collection: "craft" });
    expect(craft).toHaveLength(12);
    expect(
      craft.every((e) => e.collection === "starter" && isCraftRecipe(e.recipe)),
    ).toBe(true);
    expect(
      filterBook(entries, c, { collection: "craft", brewery: "Sierra Nevada" }),
    ).toHaveLength(3);
    expect(
      filterBook(entries, c, {
        collection: "craft",
        originKind: "clone-inspired",
      }),
    ).toHaveLength(8);
    expect(filterBook(entries, c, { query: "Two Hearted" })).toHaveLength(1);
    for (const { recipe: r } of craft) {
      expect(r.origin?.brewery).toBeTruthy();
      expect(r.origin?.beer).toBeTruthy();
      expect(r.origin?.url).toMatch(/^https:/);
      expect(r.origin?.adaptations).toBeTruthy();
      expect(recipeOriginLabel(r)).not.toBe("ORIGINAL STARTER");
    }
    for (const { recipe: r } of craft.filter(
      (e) => e.recipe.origin?.kind === "clone-inspired",
    )) {
      expect(r.origin?.adaptations).toMatch(/not a homebrew formula/);
      expect(r.origin?.referenceSpecs?.abv).toBeGreaterThan(0);
    }
  });
  it("restores valid drafts and ignores corrupt records", () => {
    expect(readDraftBank("not JSON")).toEqual({});
    expect(
      readDraftBank(JSON.stringify({ ok: r, bad: { name: "broken" } })),
    ).toEqual({ [r.id]: r });
  });
});
