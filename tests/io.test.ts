import { it, expect } from "vitest";
import { exportBeerXML, importRecipe } from "../src/io";
import { catalog } from "../src/catalog";
import { defaultRecipe as r } from "../src/defaults";
it("round-trips BeerXML ingredient weights, timing, process and units", () => {
  const imported = importRecipe(exportBeerXML(r, catalog), catalog, r);
  expect(imported.grains).toEqual(r.grains);
  expect(imported.hops.map(({ alpha, ...h }) => h)).toEqual(r.hops);
  expect(imported.batchL).toBe(r.batchL);
  expect(imported.mashC).toBe(r.mashC);
  expect(imported.lossL).toBe(r.lossL);
});
it("rejects unknown ingredients and malformed JSON", () => {
  expect(() => importRecipe('{"name":"oops"}', catalog, r)).toThrow();
  expect(() =>
    importRecipe(
      exportBeerXML(r, catalog)
        .replaceAll("Cascade", "No such hop")
        .replaceAll("h-cascade", "unknown"),
      catalog,
      r,
    ),
  ).toThrow();
});
it("preserves beer names, general notes and all process notes in JSON and BeerXML", () => {
  const noted = {
    ...r,
    name: "My Experimental Pale Ale",
    notes: "Compare two dry-hop methods.\nKeep one control batch.",
    processNotes: {
      preparation: "Try a finer crush",
      mash: "Hold 65°C for 75 min",
      boil: "Move late hops to 5 min",
      cooling: "Whirlpool at 78°C",
      fermentation: "Dry hop after day 3",
      conditioning: "Cold condition one week",
      packaging: "Compare 2.2 vs 2.5 volumes",
      tasting: "Repeat the brighter version",
    },
  };
  const xml = exportBeerXML(noted, catalog);
  expect(xml).toContain("Mash &amp; lauter:");
  for (const text of [JSON.stringify(noted), xml]) {
    const restored = importRecipe(text, catalog, r);
    expect(restored.name).toBe(noted.name);
    expect(restored.notes).toBe(noted.notes);
    expect(restored.processNotes).toEqual(noted.processNotes);
  }
  // Older BeerXML must not inherit the open recipe's experimental notes.
  expect(
    importRecipe(
      exportBeerXML(r, catalog).replace(
        /<BD_PROCESS_NOTES>.*?<\/BD_PROCESS_NOTES>/s,
        "",
      ),
      catalog,
      noted,
    ).processNotes,
  ).toBeUndefined();
});
