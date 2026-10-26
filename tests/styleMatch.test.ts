import { it, expect } from "vitest";
import { catalog as c } from "../src/catalog";
import { defaultTarget as t } from "../src/defaults";
import {
  selectDesignStyle,
  closestStyles,
  hasComparableStyleRanges,
  matchStyleToTargets,
} from "../src/engine/styleMatch";
import help from "../data/design-help.json";
it("moves between pale lager, pale ale and imperial stout as numeric targets change", () => {
  expect(closestStyles({ abv: 4.8, ibu: 35, srm: 3.5 }, c)[0].style.id).toBe(
    "german-pilsner-pils",
  );
  expect(closestStyles({ abv: 5.25, ibu: 37.5, srm: 9.5 }, c)[0].style.id).toBe(
    "american-pale-ale",
  );
  expect(closestStyles({ abv: 10, ibu: 75, srm: 35 }, c)[0].style.id).toBe(
    "russian-imperial-stout",
  );
});
it("excludes non-beer and catch-all ranges, preserves targets and choices, and labels distant matches", () => {
  const before = JSON.stringify(t);
  const target = {
    ...t,
    styleId: "saison",
    abv: 10,
    ibu: 75,
    srm: 35,
    hopChoices: ["h-citra"],
    yeastChoice: "specific-yeast",
  };
  const matched = matchStyleToTargets(target, c);
  expect(matched.styleId).toBe("russian-imperial-stout");
  expect({ ...matched, styleId: target.styleId }).toEqual(target);
  expect(JSON.stringify(t)).toBe(before);
  const all = closestStyles(t, c);
  expect(all.some((m) => /cider|perry|mead/.test(m.style.id))).toBe(false);
  expect(
    hasComparableStyleRanges(c.styles.find((s) => s.id === "specialty-beer")!),
  ).toBe(false);
  expect(closestStyles({ abv: 18, ibu: 150, srm: 60 }, c)[0].withinRanges).toBe(
    false,
  );
  expect(closestStyles({ ...t, abv: NaN }, c)).toEqual([]);
  expect(closestStyles({ ...t, fg: [1.02, 1.01] }, c)).toEqual([]);
  expect(matchStyleToTargets(t, { styles: [] })).toEqual(t);
});
it("uses enabled gravity intervals without guessing a single measured gravity and resolves ties deterministically", () => {
  const base = c.styles[0];
  const a = {
    ...base,
    id: "a",
    abv: [4, 6] as [number, number],
    ibu: [20, 40] as [number, number],
    srm: [5, 10] as [number, number],
    og: [1.04, 1.05] as [number, number],
  };
  const b = { ...a, id: "b", og: [1.06, 1.07] as [number, number] };
  const target = { abv: 5, ibu: 30, srm: 7 };
  expect(closestStyles(target, { styles: [b, a] })[0].style.id).toBe("a");
  expect(
    closestStyles({ ...target, og: [1.062, 1.066] }, { styles: [a, b] })[0]
      .style.id,
  ).toBe("b");
  const overlaps = closestStyles(
    { ...target, og: [1.045, 1.065] },
    { styles: [a, b] },
  );
  expect(overlaps.every((m) => m.withinRanges)).toBe(true);
});
it("provides explanations for the full vocabulary and numeric design controls", () => {
  for (const v of c.vocabulary)
    expect(
      (help.flavors as Record<string, string>)[v.id]?.length,
    ).toBeGreaterThan(10);
  for (const key of [
    "Target ABV",
    "Target bitterness",
    "Target color",
    "Efficiency",
    "Post-boil batch",
    "OG minimum",
    "OG maximum",
    "FG minimum",
    "FG maximum",
    "Boil time",
    "Boil-off",
    "Transfer loss",
    "flavor weight",
    "numbers weight",
    "style weight",
  ])
    expect(
      (help.fields as Record<string, string>)[key]?.length,
    ).toBeGreaterThan(40);
});

it("keeps ingredient choices and the complete design brief when overriding an automatic style", () => {
  const brief = {
    ...t,
    abv: 10,
    ibu: 75,
    srm: 35,
    hopChoices: ["h-citra", "h-mosaic"],
    baseMaltChoice: "chosen-malt",
    yeastChoice: "chosen-yeast",
  };
  const automatic = matchStyleToTargets(brief, c);
  expect(automatic.styleId).toBe("russian-imperial-stout");
  const before = structuredClone(automatic);
  for (const styleId of ["american-ipa", "saison", ""]) {
    const manual = selectDesignStyle(automatic, styleId);
    expect(manual.styleId).toBe(styleId);
    expect({ ...manual, styleId: automatic.styleId }).toEqual(before);
  }
  expect(automatic).toEqual(before);
});
