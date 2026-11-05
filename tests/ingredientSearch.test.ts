import { describe, expect, it } from "vitest";
import { catalog as c } from "../src/catalog";
import {
  flavorOptions,
  flavorsOf,
  hasFlavor,
  searchIngredients,
  styleMatchNote,
  withoutFlavorNotes,
} from "../src/engine/ingredientSearch";
import { styleIngredientProfile } from "../src/engine/recommendations";
import type { Hop } from "../src/engine/types";

const text = (h: Hop) => `${h.origin} ${h.purpose}`;
const search = (q: string) => searchIngredients(c.hops, q, c, text);
const names = (q: string) => search(q).map((h) => h.name);
const notes = (h: Hop) =>
  new Set(
    c.descriptors
      .filter((d) => d.ingredientId === h.id)
      .map((d) => d.descriptor),
  );

describe("searching hops by flavor", () => {
  it("finds exactly the hops with a flavor", () => {
    for (const flavor of flavorOptions("hop", c).filter(
      (v) => v.id !== "citrus" && v.id !== "tropical",
    )) {
      const found = search(flavor.label);
      expect(found.length, flavor.id).toBeGreaterThan(0);
      for (const h of found)
        expect(
          notes(h).has(flavor.id) ||
            h.name.toLowerCase().includes(flavor.label.toLowerCase()),
          `${h.name} for ${flavor.id}`,
        ).toBe(true);
    }
    expect(names("grapefruit")).toContain("Citra");
    expect(names("noble")).toContain("Saaz (CZ)");
  });

  it("doesn't confuse pine with pineapple", () => {
    const [first, second] = c.hops;
    const note = (ingredientId: string, descriptor: string) => ({
      ...c.descriptors[0],
      ingredientId,
      descriptor,
    });
    const small = {
      ...c,
      descriptors: [note(first.id, "pineapple"), note(second.id, "pine")],
    };
    const found = (q: string) =>
      searchIngredients([first, second], q, small, text).map((h) => h.id);
    expect(found("pine")).toEqual([second.id]);
    expect(found("pineapple")).toEqual([first.id]);
  });

  it("treats citrus and tropical as families", () => {
    const lemonOnly = c.hops.find(
      (h) => notes(h).has("lemon") && !notes(h).has("citrus"),
    )!;
    expect(names("citrus")).toContain(lemonOnly.name);
    const mangoOnly = c.hops.find(
      (h) => notes(h).has("mango") && !notes(h).has("tropical"),
    );
    if (mangoOnly) expect(names("tropical")).toContain(mangoOnly.name);
  });

  it("needs every word, and mixes flavor with other details", () => {
    const both = search("grapefruit pine");
    expect(both.length).toBeGreaterThan(0);
    for (const h of both) {
      expect(notes(h).has("grapefruit"), h.name).toBe(true);
      expect(notes(h).has("pine"), h.name).toBe(true);
    }
    expect(names("grapefruit pine")).toContain("Chinook");
    expect(names("grapefruit pine")).not.toContain("Citra");
    for (const h of search("noble germany")) {
      expect(notes(h).has("noble"), h.name).toBe(true);
      expect(h.origin).toMatch(/Germany/);
    }
    expect(search("noble germany").length).toBeGreaterThan(0);
  });

  it("understands everyday words and partly typed flavors", () => {
    expect(names("piney")).toEqual(names("pine"));
    expect(names("Stone Fruit")).toEqual(names("peach"));
    expect(names("passion fruit")).toEqual(names("passionfruit"));
    expect(names("grapef")).toContain("Citra");
    expect(names("  GRAPEFRUIT ")).toEqual(names("grapefruit"));
  });

  it("still finds hops by name and origin first", () => {
    expect(names("Citra")[0]).toBe("Citra");
    expect(names("Cascade")[0]).toBe("Cascade");
    expect(names("New Zealand").length).toBeGreaterThan(0);
    expect(names("zzzz")).toEqual([]);
    expect(search("")).toHaveLength(c.hops.length);
    const lemon = names("lemon");
    expect(lemon[0].toLowerCase()).toContain("lemon");
  });
});

describe("hop flavor notes", () => {
  it("lists a hop's flavors by name, and nothing when there's no data", () => {
    const citra = c.hops.find((h) => h.name === "Citra")!;
    expect(flavorsOf(citra.id, c)).toEqual(
      expect.arrayContaining(["Citrus", "Grapefruit", "Berry", "Floral"]),
    );
    const bare = c.hops.find((h) => !notes(h).size)!;
    expect(flavorsOf(bare.id, c)).toEqual([]);
    expect(hasFlavor(bare.id, "citrus", c)).toBe(false);
    expect(withoutFlavorNotes(c.hops, c)).toBe(
      c.hops.filter((h) => !notes(h).size).length,
    );
  });
});

const malts = (q: string) =>
  searchIngredients(c.malts, q, c, () => "").map((m) => m.name);
const yeasts = (q: string) =>
  searchIngredients(
    c.yeasts,
    q,
    c,
    () => "",
    (y) => [y.code],
  ).map((y) => y.name);
const flavorsNamed = (name: string, items: { id: string; name: string }[]) =>
  flavorsOf(items.find((i) => i.name === name)!.id, c);

describe("searching malts by what relates", () => {
  it("finds malts by flavor, including everyday words", () => {
    expect(malts("caramel")).toContain("Briess - 2 Row Caramel Malt 60L");
    expect(malts("coffee")).toContain("Roasted Barley");
    expect(malts("espresso")).toContain("Roasted Barley");
    expect(malts("espresso").length).toBeGreaterThan(10);
    expect(malts("smoked")).toContain("Briess - Smoked Malt");
    expect(malts("smoked")).not.toContain("Simpsons - Maris Otter");
    expect(malts("toffee").length).toBeGreaterThan(0);
    for (const name of malts("toffee").filter((n) => !/toffee/i.test(n)))
      expect(flavorsNamed(name, c.malts), name).toContain("Toffee");
  });

  it("finds malts by role and color", () => {
    expect(malts("adjunct")).toContain("Oats, Flaked");
    expect(malts("black")).toContain("Black (Patent) Malt");
    expect(malts("black")).toContain("Weyermann - Dehusked Carafa III");
    expect(malts("amber")).toContain("Munich Malt");
    expect(malts("pale")).toContain("Pilsner (2 Row) Ger");
    expect(malts("pale")).not.toContain("Roasted Barley");
  });

  it("finds malts a style uses, with a note saying so", () => {
    const stout = malts("dry stout");
    for (const id of styleIngredientProfile("dry-stout")!.maltIds)
      expect(stout).toContain(c.malts.find((m) => m.id === id)!.name);
    expect(stout).not.toContain("Briess - Pilsen Malt");
    expect(malts("stout")).toContain("Roasted Barley");
    const barley = c.malts.find((m) => m.name === "Roasted Barley")!;
    expect(styleMatchNote(barley, "stout", c)).toMatch(/^Used in .*Stout/);
    expect(styleMatchNote(barley, "roasted", c)).toBe("");
  });

  it("needs every word, and ignores style words that say nothing", () => {
    for (const name of malts("caramel stout"))
      expect(flavorsNamed(name, c.malts)).toContain("Caramel");
    expect(malts("ale").length).toBeLessThan(c.malts.length / 3);
    expect(malts("zzzz")).toEqual([]);
  });

  it("still finds malts by name first", () => {
    expect(malts("Maris Otter")[0]).toBe("Simpsons - Maris Otter");
    expect(malts("Carafa")[0]).toMatch(/Carafa/);
    expect(malts("Weyermann").every((n) => n.includes("Weyermann"))).toBe(true);
    expect(malts("")).toHaveLength(c.malts.length);
  });
});

describe("searching yeast by what relates", () => {
  it("finds yeast by flavor, including everyday words", () => {
    expect(yeasts("banana")).toContain("Hefeweizen Ale");
    expect(yeasts("banana")).toContain("Stefon");
    expect(yeasts("banana")).not.toContain("SafAle US-05");
    expect(yeasts("clean")).toContain("SafAle US-05");
    expect(yeasts("neutral")).toContain("SafAle US-05");
    expect(yeasts("neutral")).not.toContain("Hefeweizen Ale");
    expect(yeasts("sour")).toEqual(expect.arrayContaining(["French Saison"]));
    expect(yeasts("sour")).toContain("Belgian Sour Mix 1");
    expect(yeasts("phenolic")).toContain("Hefeweizen Ale");
  });

  it("finds yeast by family and form", () => {
    expect(yeasts("lager")).toContain("SafLager W-34/70");
    expect(yeasts("kveik")).toContain("Voss Kveik");
    expect(yeasts("belgian")).toContain("Abbey Ale");
    expect(yeasts("dry")).toContain("SafAle US-05");
    expect(yeasts("liquid")).toContain("Hefeweizen Ale");
    expect(yeasts("liquid")).not.toContain("SafAle US-05");
  });

  it("finds yeast a style uses, including by nickname", () => {
    expect(yeasts("IPA")).toContain("SafAle US-05");
    expect(yeasts("hefeweizen")).toContain("SafAle WB-06");
    expect(yeasts("pils")).toContain("SafLager W-34/70");
    const us05 = c.yeasts.find((y) => y.name === "SafAle US-05")!;
    expect(styleMatchNote(us05, "IPA", c)).toMatch(/^Used in .*IPA/);
  });

  it("still finds yeast by code and lab", () => {
    expect(yeasts("WLP001")[0]).toBe("California Ale");
    expect(yeasts("US-05")[0]).toBe("SafAle US-05");
    expect(yeasts("White Labs").length).toBeGreaterThan(10);
  });
});

describe("flavor chips", () => {
  it("offers only flavors with data, and only that kind's own", () => {
    const malt = flavorOptions("malt", c).map((v) => v.id);
    expect(malt).toEqual(expect.arrayContaining(["caramel", "roast", "smoky"]));
    expect(malt).not.toContain("banana");
    const yeast = flavorOptions("yeast", c).map((v) => v.id);
    expect(yeast).toEqual(expect.arrayContaining(["banana", "clove", "clean"]));
    expect(yeast).not.toContain("caramel");
    for (const kind of ["malt", "yeast", "hop"] as const)
      for (const v of flavorOptions(kind, c)) {
        const items =
          kind === "malt" ? c.malts : kind === "yeast" ? c.yeasts : c.hops;
        expect(
          items.some((i) => hasFlavor(i.id, v.id, c)),
          v.id,
        ).toBe(true);
      }
  });
});
