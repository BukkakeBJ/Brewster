import { describe, expect, it } from "vitest";
import { catalog as c } from "../src/catalog";
import { defaultRecipe as recipe, defaultTarget } from "../src/defaults";
import {
  yeastGroups,
  yeastGuide,
  yeastModelAttenuation,
} from "../src/engine/yeast";
import { yeastAlcoholRange, describeIngredient } from "../src/engine/library";
import { alcohol, predict } from "../src/engine/calculations";
import { consensus, flavorPredict } from "../src/engine/flavor";
import { ingredientMatches } from "../src/engine/recommendations";
import { exportBeerXML, importRecipe } from "../src/io";
import extras from "../data/yeasts-extra.json";
import { searchByName } from "../src/engine/search";

describe("yeast options, alcohol and contextual flavor", () => {
  const british = c.yeasts.find((y) => y.code === "WLP005")!;
  const wine = c.yeasts.find((y) => y.id === "y-lalvin-qa23")!;
  const baker = c.yeasts.find((y) => y.id === "y-fleischmann-active-dry")!;
  it("covers named types and classifies non-beer cultures without regional false positives", () => {
    expect(c.yeasts.length).toBeGreaterThanOrEqual(295);
    expect(yeastGroups(british).map((g) => g.id)).toContain("british");
    for (const code of ["WLP090", "WLP099"])
      expect(
        yeastGroups(c.yeasts.find((y) => y.code === code)!).map((g) => g.id),
      ).toContain("high-gravity");
    expect(yeastGroups(wine).map((g) => g.id)).toEqual(["wine"]);
    expect(yeastGroups(baker).map((g) => g.id)).toEqual(["baking"]);
    const cider = c.yeasts.find((y) => y.code === "WLP775")!;
    expect(yeastGroups(cider).map((g) => g.id)).toEqual(["wine"]);
    for (const y of c.yeasts) expect(yeastGroups(y).length).toBeGreaterThan(0);
  });
  it("keeps source specs and editorial flavor guidance separate, including honest unknowns", () => {
    for (const row of extras) {
      const y = c.yeasts.find((y) => y.id === row.id)!;
      expect(y.source.url).toMatch(/^https:/);
      expect(yeastGuide(y)?.flavor.length).toBeGreaterThan(40);
      expect(describeIngredient(y, c).use.length).toBeGreaterThan(40);
      expect(y).not.toHaveProperty("flavor");
    }
    expect(baker.attenuation).toBeNull();
    expect(baker.alcoholTolerance).toBeNull();
    expect(baker.tempC).toBeNull();
    expect(wine.alcoholTolerance).toBe(16);
    expect(wine.attenuation).toBeNull();
    expect(c.yeasts.find((y) => y.code === "WLP099")!.diastaticus).toBe(true);
  });
  it("estimates alcohol from gravity and the attenuation interval rather than tolerance", () => {
    const range = yeastAlcoholRange(british, 1.06)!;
    expect(range[0]).toBeCloseTo(alcohol(1.06, 1.0198).accurate, 8);
    expect(range[1]).toBeCloseTo(alcohol(1.06, 1.0156).accurate, 8);
    expect(range[1]).toBeLessThan(british.alcoholTolerance!);
    expect(yeastAlcoholRange(british, 1.04)![1]).toBeLessThan(range[0]);
    expect(yeastAlcoholRange(wine, 1.06)).toBeNull();
    expect(yeastAlcoholRange(baker, 1.06)).toBeNull();
  });
  it("uses a disclosed house baseline for unknown beer attenuation without inventing specs", () => {
    expect(yeastModelAttenuation(baker)).toBe(75);
    const r = { ...recipe, yeastId: baker.id };
    const predicted = predict(r, c);
    const assumed = predict(r, {
      ...c,
      yeasts: c.yeasts.map((y) =>
        y.id === baker.id
          ? { ...y, attenuation: [75, 75] as [number, number] }
          : y,
      ),
    });
    expect(predicted.fg).toBe(assumed.fg);
    expect(predicted.abv).toBe(assumed.abv);
    expect(predicted.warnings.some((w) => /75% house baseline/.test(w))).toBe(
      true,
    );
    expect(
      predicted.warnings.some((w) => /experimental beer choice/.test(w)),
    ).toBe(true);
    expect(baker.attenuation).toBeNull();
  });
  it("shows wine evidence in its own context and does not transfer it into a beer prediction", () => {
    const rows = c.descriptors.filter((d) => d.ingredientId === wine.id);
    expect(
      consensus(rows, { medium: "wine", tempC: 20 }).length,
    ).toBeGreaterThan(0);
    expect(consensus(rows, { tempC: 20 })).toEqual([]);
    const r = { ...recipe, yeastId: wine.id };
    const flavor = flavorPredict(r, c, predict(r, c));
    expect(
      Object.values(flavor.contributions)
        .flat()
        .some((x) => x.ingredientId === wine.id),
    ).toBe(false);
  });
  it("keeps experimental options out of automatic beer recommendations", () => {
    const matches = ingredientMatches(defaultTarget, c);
    expect(matches.yeasts.length).toBeGreaterThan(0);
    expect(matches.yeasts.some((y) => [wine.id, baker.id].includes(y.id))).toBe(
      false,
    );
  });
  it("puts an exact product code ahead of another strain that mentions that code in its guide", () => {
    const results = searchByName(
      c.yeasts,
      "WLP099",
      (y) => y.name,
      (y) => JSON.stringify(y) + " " + (yeastGuide(y)?.flavor ?? ""),
      (y) => [y.code],
    );
    expect(results.length).toBeGreaterThan(1);
    expect(results[0].code).toBe("WLP099");
  });
  it("round-trips manual wine and baking choices without exporting made-up attenuation", () => {
    for (const y of [wine, baker]) {
      const r = { ...recipe, yeastId: y.id };
      const xml = exportBeerXML(r, c);
      expect(xml).not.toContain("<ATTENUATION>");
      expect(importRecipe(xml, c, recipe).yeastId).toBe(y.id);
    }
  });
});
