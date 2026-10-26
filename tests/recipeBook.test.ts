import { describe, it, expect } from "vitest";
import {
  sameRecipe,
  beerStyleCoverage,
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
    expect(starterRecipes).toHaveLength(89);
    expect(starterRecipes.filter(isCraftRecipe)).toHaveLength(75);
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
    const edited = {
      ...r,
      name: "Unsaved change",
      processNotes: { mash: "Experiment at 65C" },
    };
    const entries = recipeBookEntries([r], {
      [r.id]: edited,
      new: { ...r, id: "new" },
    });
    const mine = entries.filter((e) => e.collection === "mine");
    expect(mine).toHaveLength(1);
    expect(mine[0].recipe.name).toBe("Unsaved change");
    expect(mine[0].unsaved).toBe(true);
    expect(mine[0].recipe.processNotes).toEqual(edited.processNotes);
    const bank = readDraftBank(JSON.stringify({ [edited.id]: edited }));
    expect(bank[edited.id].processNotes).toEqual(edited.processNotes);
    expect(
      filterBook(recipeBookEntries([edited], {}), c, {
        query: "Experiment at 65C",
      }),
    ).toHaveLength(1);
    const copied = copyBookRecipe(edited, "experiment-copy");
    copied.processNotes!.mash = "Different experiment";
    expect(edited.processNotes.mash).toBe("Experiment at 65C");
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
    expect(craft).toHaveLength(75);
    expect(
      craft.every((e) => e.collection === "starter" && isCraftRecipe(e.recipe)),
    ).toBe(true);
    expect(
      filterBook(entries, c, { collection: "craft", brewery: "Sierra Nevada" }),
    ).toHaveLength(4);
    expect(
      filterBook(entries, c, {
        collection: "craft",
        originKind: "clone-inspired",
      }),
    ).toHaveLength(71);
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
      if (r.tags?.includes("style coverage")) {
        expect(r.origin?.title).toContain("commercial example reference");
        expect(r.origin?.referenceSpecs).toBeUndefined();
      } else expect(r.origin?.referenceSpecs?.abv).toBeGreaterThan(0);
    }
  });
  it("covers every catalog beer style with an editable recipe, independently of saved data", () => {
    const coverage = beerStyleCoverage(c);
    expect(coverage).toHaveLength(80);
    expect(coverage.filter((s) => s.recipes.length === 0)).toEqual([]);
    expect(coverage.some((s) => /cider|perry|mead/.test(s.style.id))).toBe(
      false,
    );
    const future = {
      ...c,
      styles: [...c.styles, { ...c.styles[0], id: "future-beer-style" }],
    };
    expect(
      beerStyleCoverage(future).find((s) => s.style.id === "future-beer-style")
        ?.recipes,
    ).toEqual([]);
    const entries = recipeBookEntries([], {});
    for (const { style } of coverage) {
      expect(
        filterBook(entries, c, { collection: "starter", styleId: style.id })
          .length,
      ).toBeGreaterThan(0);
    }
  });
  it("ships sensible style templates with distinct process instructions and no invented brewery specifications", () => {
    const additions = starterRecipes.filter((r) =>
      r.tags?.includes("style coverage"),
    );
    expect(additions).toHaveLength(70);
    expect(new Set(starterRecipes.map((r) => r.id)).size).toBe(
      starterRecipes.length,
    );
    for (const r of additions) {
      const p = predict(r, c);
      const style = c.styles.find((s) => s.id === r.styleId)!;
      expect(c.yeasts.some((y) => y.id === r.yeastId)).toBe(true);
      expect(
        r.hops.every((h) => c.hops.some((i) => i.id === h.ingredientId)),
      ).toBe(true);
      expect(p.abv).toBeGreaterThan(2);
      expect(p.abv).toBeLessThan(12);
      expect(p.ibu).toBeGreaterThanOrEqual(style.ibu[0] - 0.1);
      expect(p.ibu).toBeLessThanOrEqual(style.ibu[1] + 0.1);
      expect(p.srm).toBeGreaterThanOrEqual(style.srm[0] - 0.5);
      expect(p.srm).toBeLessThanOrEqual(style.srm[1] + 0.5);
      expect(p.warnings.filter((w) => !w.includes("POF/diastaticus"))).toEqual(
        [],
      );
      expect(r.notes).toContain("not commercial beer specifications");
      if (r.tags?.includes("special process"))
        expect(r.notes).toContain("not included in engine");
      expect(copyBookRecipe(r, "editable-copy").grains).toEqual(r.grains);
    }
  });
  it("restores valid drafts and ignores corrupt records", () => {
    expect(readDraftBank("not JSON")).toEqual({});
    expect(
      readDraftBank(JSON.stringify({ ok: r, bad: { name: "broken" } })),
    ).toEqual({ [r.id]: r });
  });
});
