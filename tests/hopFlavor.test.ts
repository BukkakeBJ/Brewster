import { describe, expect, it } from "vitest";
import { catalog as c } from "../src/catalog";
import {
  hopFlavorOptions,
  hopFlavors,
  hopHasFlavor,
  hopsWithoutFlavorNotes,
  searchHops,
} from "../src/engine/hopFlavor";
import type { Hop } from "../src/engine/types";

const text = (h: Hop) => `${h.origin} ${h.purpose}`;
const search = (q: string) => searchHops(c.hops, q, c, text);
const names = (q: string) => search(q).map((h) => h.name);
const notes = (h: Hop) =>
  new Set(
    c.descriptors
      .filter((d) => d.ingredientId === h.id)
      .map((d) => d.descriptor),
  );

describe("searching hops by flavor", () => {
  it("finds exactly the hops with a flavor", () => {
    for (const flavor of hopFlavorOptions(c).filter(
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
      searchHops([first, second], q, small, text).map((h) => h.id);
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
    expect(hopFlavors(citra.id, c)).toEqual(
      expect.arrayContaining(["Citrus", "Grapefruit", "Berry", "Floral"]),
    );
    const bare = c.hops.find((h) => !notes(h).size)!;
    expect(hopFlavors(bare.id, c)).toEqual([]);
    expect(hopHasFlavor(bare.id, "citrus", c)).toBe(false);
    expect(hopsWithoutFlavorNotes(c.hops, c)).toBe(
      c.hops.filter((h) => !notes(h).size).length,
    );
  });
});
