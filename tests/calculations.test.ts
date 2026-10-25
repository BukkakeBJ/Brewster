import { describe, it, expect } from "vitest";
import { catalog as c } from "../src/catalog";
import {
  originalGravity,
  finalGravity,
  alcohol,
  tinseth,
  hopIbu,
  morey,
  scaleRecipe,
  apparentAttenuation,
  KG_PER_LB,
  L_PER_GAL,
  G_PER_OZ,
  pitchRate,
  volumes,
  calories,
} from "../src/engine/calculations";
import type { Malt, Recipe } from "../src/engine/types";
const malt = {
  ...c.malts[0],
  id: "test",
  ppg: 36,
  lovibond: 2,
  requiresMash: true,
  type: "base",
} as Malt;
const grains = [{ ingredientId: "test", kg: 10 * KG_PER_LB }];
describe("objective brewing math", () => {
  it("OG: 10 lb ×36 PPG ×72% /5 gal = 51.84 points", () =>
    expect(originalGravity(grains, [malt], 5 * L_PER_GAL)).toBeCloseTo(
      1.05184,
      6,
    ));
  it("extract and sugar bypass mash efficiency", () =>
    expect(
      originalGravity(
        grains,
        [{ ...malt, requiresMash: false }],
        5 * L_PER_GAL,
        30,
      ),
    ).toBeCloseTo(1.072, 6));
  it("FG at 75% apparent attenuation", () =>
    expect(finalGravity(1.06, 0.75)).toBeCloseTo(1.015, 6));
  it("standard and accurate ABV", () => {
    const a = alcohol(1.06, 1.015);
    expect(a.standard).toBeCloseTo(5.90625, 5);
    expect(a.accurate).toBeCloseTo(6.121002, 4);
  });
  it("Tinseth reference at SG 1.050, 60 min", () => {
    expect(tinseth(60, 1.05)).toBeCloseTo(0.230664, 5);
    expect(
      hopIbu(
        { ingredientId: "h", grams: G_PER_OZ, use: "boil", minutes: 60 },
        5,
        1.05,
        5 * L_PER_GAL,
      ),
    ).toBeCloseTo(17.27675, 4);
  });
  it("dry hops have zero IBU, whirlpool uses configured reduction", () => {
    const h = {
      ingredientId: "h",
      grams: G_PER_OZ,
      use: "dry hop" as const,
      minutes: 20,
    };
    expect(hopIbu(h, 10, 1.05, 20)).toBe(0);
    expect(hopIbu({ ...h, use: "whirlpool" }, 10, 1.05, 20, 0.2)).toBeCloseTo(
      hopIbu({ ...h, use: "boil" }, 10, 1.05, 20) * 0.2,
    );
  });
  it("Morey: MCU 4 gives 3.8617 SRM", () =>
    expect(morey(grains, [malt], 5 * L_PER_GAL)).toBeCloseTo(3.8617, 3));
  it("mash temp, crystal and lactose alter attenuation in the expected direction", () => {
    const y = { ...c.yeasts[0], attenuation: [75, 75] as [number, number] };
    expect(apparentAttenuation(grains, [malt], y, 65, 72)).toBeCloseTo(0.75);
    expect(apparentAttenuation(grains, [malt], y, 69, 72)).toBeLessThan(0.75);
    expect(
      apparentAttenuation(
        grains,
        [{ ...malt, type: "crystal-caramel" }],
        y,
        65,
        72,
      ),
    ).toBeCloseTo(0.4875);
    expect(
      apparentAttenuation(grains, [{ ...malt, name: "Lactose" }], y, 65, 72),
    ).toBe(0);
  });
  it("scales volume and corrects only mash grains for efficiency", () => {
    const r = {
      batchL: 20,
      efficiency: 72,
      lossL: 1,
      grains: [
        { ingredientId: "test", kg: 4 },
        { ingredientId: "extract", kg: 1 },
      ],
      hops: [{ grams: 20 }],
    } as Recipe;
    const s = scaleRecipe(r, 40, 80, {
      ...c,
      malts: [malt, { ...malt, id: "extract", requiresMash: false }],
    });
    expect(s.grains[0].kg).toBeCloseTo(7.2);
    expect(s.grains[1].kg).toBe(2);
    expect(s.hops[0].grams).toBe(40);
    expect(r.batchL).toBe(20);
  });
  it("pitch rates double for lager", () =>
    expect(pitchRate(1.05, 20, true)).toBe(pitchRate(1.05, 20) * 2));
  it("volume conservation and calorie serving conversion", () => {
    expect(volumes(20, 60, 3, 1)).toEqual({
      preBoilL: 23,
      postBoilL: 20,
      fermenterL: 19,
    });
    expect(
      calories(1.05, 1.01, 330) / calories(1.05, 1.01, 354.88235475),
    ).toBeCloseTo(330 / 354.88235475);
  });
  it("rejects invalid volumes and efficiency instead of producing Infinity", () => {
    expect(() => originalGravity(grains, [malt], 0)).toThrow();
    expect(() => originalGravity(grains, [malt], 20, 0)).toThrow();
    expect(() => volumes(20, 60, 3, 21)).toThrow();
  });
});
