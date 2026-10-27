import { expect, it } from "vitest";
import { catalog } from "../src/catalog";
import { beerColor } from "../src/engine/calculations";
import { colorName, glassFor } from "../src/engine/glassware";

it("serves each style in its traditional glass", () => {
  const expected: Record<string, string> = {
    "american-ipa": "pint",
    "dry-stout": "pint",
    "german-pilsner-pils": "pilsner",
    "k-lsch": "pilsner",
    "weizen-weissbier": "weizen",
    weizenbock: "weizen",
    witbier: "weizen",
    "belgian-tripel": "tulip",
    "imperial-ipa": "tulip",
    "russian-imperial-stout": "snifter",
    eisbock: "snifter",
    "oktoberfest-m-rzen": "mug",
    doppelbock: "mug",
    "dry-mead": "wine",
    "common-cider": "wine",
    "": "pint",
  };
  for (const [style, glass] of Object.entries(expected))
    expect(glassFor(style), style).toBe(glass);
  const glasses = new Set(catalog.styles.map((s) => glassFor(s.id)));
  expect([...glasses].sort()).toEqual(
    ["mug", "pilsner", "pint", "snifter", "tulip", "weizen", "wine"].sort(),
  );
});

it("uses the SRM display chart, darkening with SRM and clamped to 1–40", () => {
  expect(beerColor(1)).toBe("rgb(255,230,153)");
  expect(beerColor(40)).toBe("rgb(54,8,10)");
  expect(beerColor(80)).toBe(beerColor(40));
  expect(beerColor(0)).toBe(beerColor(1));
  expect(beerColor(Number.NaN)).toBe(beerColor(1));
  const lum = (srm: number) => {
    const [r, g, b] = beerColor(srm).match(/\d+/g)!.map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // The published chart has a tiny local wobble near SRM 31–32; it darkens over any 3 SRM.
  for (let srm = 1; srm <= 37; srm += 0.5)
    expect(lum(srm + 3)).toBeLessThan(lum(srm));
  expect(colorName(2)).toBe("Pale straw");
  expect(colorName(8)).toBe("Amber");
  expect(colorName(38)).toBe("Black");
});
