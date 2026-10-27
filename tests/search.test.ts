import { describe, it, expect } from "vitest";
import {
  alphabetical,
  normalizeSearch,
  searchByName,
} from "../src/engine/search";
import { catalog } from "../src/catalog";
import type { Ingredient } from "../src/engine/types";
import { findAdditives } from "../src/engine/additives";

describe("ingredient search and alphabetical browsing", () => {
  const lookup = (query: string) =>
    searchByName(
      catalog.hops,
      query,
      (h) => h.name,
      (h) => JSON.stringify({ ...h, source: undefined }),
    );
  it("puts Amarillo ahead of hops that merely mention it as a substitute", () => {
    const rows = lookup("Amarillo");
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0].name).toBe("Amarillo");
    expect(rows.slice(1).some((h) => h.substitutes?.includes("Amarillo"))).toBe(
      true,
    );
    expect(lookup("  aMaRiLLo®  ")[0].id).toBe(rows[0].id);
  });
  it("ranks exact names, prefixes, whole name words, then supporting text", () => {
    const items = [
      { name: "Galaxy", text: "Amarillo substitute" },
      { name: "Amarillo Gold", text: "" },
      { name: "New Amarillo", text: "" },
      { name: "Amarillo", text: "" },
      { name: "Cascade", text: "Amarillo substitute" },
    ];
    expect(
      searchByName(
        items,
        "amarillo",
        (i) => i.name,
        (i) => i.text,
      ).map((i) => i.name),
    ).toEqual([
      "Amarillo",
      "Amarillo Gold",
      "New Amarillo",
      "Cascade",
      "Galaxy",
    ]);
  });
  it("ignores case, accents, punctuation and extra whitespace", () => {
    expect(normalizeSearch("  Kölsch®  /  K-97 ")).toBe("kolsch k 97");
    expect(normalizeSearch("Citra™")).toBe("citra");
    const items = [{ name: "Kölsch®", lab: "Example", code: "K-97" }];
    for (const query of ["kolsch", "KÖLSCH", "example  k 97"])
      expect(
        searchByName(
          items,
          query,
          (i) => i.name,
          (i) => `${i.lab} ${i.code}`,
        ),
      ).toEqual(items);
  });
  it("requires every query word and keeps caller filters intact", () => {
    const items = [
      { name: "US Pale", type: "base" },
      { name: "Pale Chocolate", type: "roasted" },
    ];
    const base = items.filter((i) => i.type === "base");
    expect(
      searchByName(
        base,
        "pale base",
        (i) => i.name,
        (i) => i.type,
      ),
    ).toEqual([items[0]]);
    expect(
      searchByName(
        base,
        "chocolate",
        (i) => i.name,
        (i) => i.type,
      ),
    ).toEqual([]);
    expect(lookup("amarillo impossibleword")).toEqual([]);
  });
  it("sorts empty searches and equal metadata matches alphabetically without mutating input", () => {
    const items = [
      { name: "Zulu", text: "citrus" },
      { name: "Alpha", text: "citrus" },
    ];
    const original = structuredClone(items);
    for (const query of ["", "   ", "citrus"])
      expect(
        searchByName(
          items,
          query,
          (i) => i.name,
          (i) => i.text,
        ).map((i) => i.name),
      ).toEqual(["Alpha", "Zulu"]);
    expect(items).toEqual(original);
    expect(alphabetical(["Malt 10", "malt 2", "Álpha"], (x) => x)).toEqual([
      "Álpha",
      "malt 2",
      "Malt 10",
    ]);
  });
  it("alphabetizes the real catalogs and additive browsing, retaining additive aliases and filters", () => {
    for (const list of [catalog.hops, catalog.malts, catalog.yeasts]) {
      const sorted = searchByName<Ingredient>(
        list,
        "",
        (i) => i.name,
        () => "",
      );
      const again = alphabetical(sorted, (i) => i.name);
      expect(sorted).toEqual(again);
    }
    const rows = findAdditives();
    expect(rows).toEqual(alphabetical(rows, (a) => a.name));
    expect(findAdditives("irish moss")[0].id).toBe("a-irish-moss");
    expect(findAdditives("cacao")[0].id).toBe("a-cocoa-nibs");
    expect(
      findAdditives("oak", "Wood & spirits", "conditioning").every(
        (a) => a.category === "Wood & spirits",
      ),
    ).toBe(true);
    expect(findAdditives("oak", "", "boil")).toEqual([]);
  });
});
