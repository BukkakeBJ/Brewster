import {
  additives,
  additiveModelNote,
  additiveName,
  CUSTOM_ADDITIVE_ID,
} from "./additives";
import type {
  Catalog,
  Grain,
  HopAddition,
  Malt,
  Prediction,
  Recipe,
  Yeast,
} from "./types";
import {
  yeastModelAttenuation,
  UNKNOWN_YEAST_ATTENUATION,
  yeastGroups,
} from "./yeast";
export const KG_PER_LB = 0.45359237,
  L_PER_GAL = 3.785411784,
  G_PER_OZ = 28.349523125;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lToGal = (l: number) => l / L_PER_GAL;
export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const midpoint = (r: [number, number]) => (r[0] + r[1]) / 2;
function positive(n: number, label: string, zero = false) {
  if (!Number.isFinite(n) || (zero ? n < 0 : n <= 0))
    throw new Error(`${label} must be ${zero ? "nonnegative" : "positive"}.`);
}
export function grainPoints(
  grains: Grain[],
  malts: Malt[],
  efficiency: number,
): number {
  if (!Number.isFinite(efficiency) || efficiency <= 0 || efficiency > 100)
    throw new Error("Efficiency must be 0–100%.");
  return grains.reduce((sum, g) => {
    positive(g.kg, "Grain mass", true);
    const m = malts.find((m) => m.id === g.ingredientId);
    if (!m) throw new Error("Unknown fermentable: " + g.ingredientId);
    return sum + kgToLb(g.kg) * m.ppg * (m.requiresMash ? efficiency / 100 : 1);
  }, 0);
}
export function originalGravity(
  grains: Grain[],
  malts: Malt[],
  batchL: number,
  efficiency = 72,
): number {
  positive(batchL, "Batch volume");
  return 1 + grainPoints(grains, malts, efficiency) / lToGal(batchL) / 1000;
}
export function apparentAttenuation(
  grains: Grain[],
  malts: Malt[],
  yeast: Yeast,
  mashC: number,
  efficiency: number,
  calibrated?: number,
): number {
  const total = grainPoints(grains, malts, efficiency);
  if (!total) return 0;
  const baseline =
    clamp(
      (calibrated ?? yeastModelAttenuation(yeast)) + (65 - mashC) * 0.75,
      40,
      95,
    ) / 100;
  return grains.reduce((sum, g) => {
    const m = malts.find((m) => m.id === g.ingredientId)!;
    const points = grainPoints([g], malts, efficiency);
    let a = baseline;
    if (/lactose/i.test(m.name)) a = 0;
    else if (m.type === "sugar") a = 1;
    else if (m.type === "crystal-caramel") a *= 0.65;
    return sum + (points * a) / total;
  }, 0);
}
export function finalGravity(og: number, attenuation: number): number {
  if (
    og < 1 ||
    og > 1.3 ||
    attenuation < 0 ||
    attenuation > 1 ||
    !Number.isFinite(og + attenuation)
  )
    throw new Error("Invalid gravity or attenuation.");
  return og - (og - 1) * attenuation;
}
export function alcohol(og: number, fg: number) {
  if (!Number.isFinite(og + fg) || fg < 1 || og < fg || og >= 1.775)
    throw new Error("Invalid gravity pair.");
  return {
    standard: (og - fg) * 131.25,
    accurate: ((76.08 * (og - fg)) / (1.775 - og)) * (fg / 0.794),
  };
}
export function tinseth(minutes: number, gravity: number): number {
  positive(minutes, "Hop time", true);
  if (!Number.isFinite(gravity) || gravity < 1)
    throw new Error("Invalid boil gravity.");
  return (
    (1.65 * Math.pow(0.000125, gravity - 1) * (1 - Math.exp(-0.04 * minutes))) /
    4.15
  );
}
export function hopIbu(
  h: HopAddition,
  alphaPercent: number,
  boilGravity: number,
  batchL: number,
  whirlpoolFactor = 0.15,
): number {
  positive(batchL, "Batch volume");
  positive(h.grams, "Hop mass", true);
  positive(h.minutes, "Hop time", true);
  if (alphaPercent < 0 || alphaPercent > 100 || !Number.isFinite(alphaPercent))
    throw new Error("Invalid alpha acid.");
  if (whirlpoolFactor < 0 || whirlpoolFactor > 1)
    throw new Error("Whirlpool factor must be 0–1.");
  if (h.use === "dry hop") return 0;
  return (
    tinseth(h.minutes, boilGravity) *
    (h.use === "whirlpool" ? whirlpoolFactor : 1) *
    (((((alphaPercent / 100) * h.grams) / G_PER_OZ) * 7490) / lToGal(batchL))
  );
}
export function morey(grains: Grain[], malts: Malt[], batchL: number): number {
  positive(batchL, "Batch volume");
  const mcu =
    grains.reduce((s, g) => {
      positive(g.kg, "Grain mass", true);
      const m = malts.find((m) => m.id === g.ingredientId);
      if (!m) throw new Error("Unknown fermentable");
      return s + kgToLb(g.kg) * m.lovibond;
    }, 0) / lToGal(batchL);
  return 1.4922 * Math.pow(mcu, 0.6859);
}
export function plato(sg: number) {
  return -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg;
}
export function calories(og: number, fg: number, ml: number): number {
  const abw = (76.08 * (og - fg)) / (1.775 - og);
  const realExtract = 0.1808 * plato(og) + 0.8192 * plato(fg);
  return Math.max(
    0,
    ((6.9 * abw + 4 * (realExtract - 0.1)) * fg * 3.55 * ml) / 354.88235475,
  );
}
export function pitchRate(
  og: number,
  volumeL: number,
  lager = false,
  multiplier = 1,
): number {
  positive(volumeL, "Pitch volume");
  positive(multiplier, "Pitch multiplier");
  return Math.max(0, plato(og)) * (lager ? 1.5 : 0.75) * volumeL * multiplier;
}
export function volumes(
  batchL: number,
  boilMinutes: number,
  boilOffLPerHour: number,
  lossL: number,
) {
  positive(batchL, "Batch volume");
  [boilMinutes, boilOffLPerHour, lossL].forEach((n) =>
    positive(n, "Equipment setting", true),
  );
  if (lossL >= batchL) throw new Error("Loss must be smaller than batch.");
  return {
    preBoilL: batchL + (boilOffLPerHour * boilMinutes) / 60,
    postBoilL: batchL,
    fermenterL: batchL - lossL,
  };
}
export function scaleRecipe(
  recipe: Recipe,
  batchL: number,
  efficiency = recipe.efficiency,
  catalog?: Catalog,
): Recipe {
  positive(batchL, "Batch volume");
  if (efficiency <= 0 || efficiency > 100 || !Number.isFinite(efficiency))
    throw new Error("Invalid efficiency");
  const ratio = batchL / recipe.batchL;
  return {
    ...recipe,
    batchL,
    efficiency,
    lossL: recipe.lossL * ratio,
    grains: recipe.grains.map((g) => ({
      ...g,
      kg:
        g.kg *
        ratio *
        (catalog?.malts.find((m) => m.id === g.ingredientId)?.requiresMash ===
        false
          ? 1
          : recipe.efficiency / efficiency),
    })),
    hops: recipe.hops.map((h) => ({ ...h, grams: h.grams * ratio })),
    ...(recipe.additives
      ? {
          additives: recipe.additives.map((a) => ({
            ...a,
            amount: a.amount * ratio,
          })),
        }
      : {}),
  };
}
export function predict(
  recipe: Recipe,
  catalog: Catalog,
  calibratedAttenuation?: number,
): Prediction {
  const y = catalog.yeasts.find((y) => y.id === recipe.yeastId);
  if (!y) throw new Error("Select a known yeast.");
  const v = volumes(
    recipe.batchL,
    recipe.boilMinutes,
    recipe.boilOffLPerHour,
    recipe.lossL,
  );
  const og = originalGravity(
    recipe.grains,
    catalog.malts,
    recipe.batchL,
    recipe.efficiency,
  );
  const attenuation = apparentAttenuation(
    recipe.grains,
    catalog.malts,
    y,
    recipe.mashC,
    recipe.efficiency,
    calibratedAttenuation,
  );
  const fg = finalGravity(og, attenuation),
    abv = alcohol(og, fg),
    srm = morey(recipe.grains, catalog.malts, recipe.batchL);
  const preBoilGravity = 1 + ((og - 1) * recipe.batchL) / v.preBoilL;
  const boilGravity = (og + preBoilGravity) / 2;
  const ibu = recipe.hops.reduce((s, h) => {
    const hop = catalog.hops.find((x) => x.id === h.ingredientId);
    if (!hop) throw new Error("Unknown hop.");
    return (
      s +
      hopIbu(
        h,
        h.alpha ?? midpoint(hop.alpha),
        boilGravity,
        recipe.batchL,
        recipe.whirlpoolFactor,
      )
    );
  }, 0);
  const total = recipe.grains.reduce((s, g) => s + g.kg, 0),
    warnings: string[] = [];
  if (recipe.additives?.length) {
    for (const row of recipe.additives) {
      const item = additives.find((a) => a.id === row.ingredientId);
      if (
        (row.ingredientId === CUSTOM_ADDITIVE_ID
          ? !row.customName?.trim() ||
            row.customName.trim().length > 200 ||
            !["g", "mL", "item"].includes(row.unit)
          : !item || row.unit !== item.guide.unit) ||
        !Number.isFinite(row.amount) ||
        row.amount < 0
      )
        throw new Error("Invalid additive reference, unit or amount.");
      if (row.amount === 0)
        warnings.push(
          `${additiveName(row)}: set an amount from your product label or trial before brewing.`,
        );
    }
    warnings.push(additiveModelNote);
  }
  recipe.grains.forEach((g) => {
    const m = catalog.malts.find((m) => m.id === g.ingredientId)!;
    if (total && (100 * g.kg) / total > m.maxPercent + 0.01)
      warnings.push(`${m.name} exceeds ${m.maxPercent}% of grist.`);
  });
  if (!y.attenuation)
    warnings.push(
      `Beer-wort attenuation for ${y.name} is unknown. FG and ABV use ${calibratedAttenuation === undefined ? `a ${UNKNOWN_YEAST_ATTENUATION}% house baseline` : `a ${calibratedAttenuation.toFixed(1)}% personal calibration baseline`} before mash/grist adjustments. This is not a supplier specification.`,
    );
  if (!y.tempC)
    warnings.push(
      `A brewing fermentation-temperature range for ${y.name} is not published in this catalog.`,
    );
  if (yeastGroups(y).some((f) => ["wine", "baking"].includes(f.id)))
    warnings.push(
      "This wine or baking culture is an experimental beer choice. Wine-context aromas are not transferred into the beer flavor prediction; pitch and fermentation calculations remain beer-model assumptions.",
    );
  if (y.tempC && (recipe.fermentC < y.tempC[0] || recipe.fermentC > y.tempC[1]))
    warnings.push(
      "Fermentation is outside the reference strain temperature range.",
    );
  if (y.alcoholTolerance !== null && abv.accurate > y.alcoholTolerance)
    warnings.push("Predicted ABV exceeds reference yeast tolerance.");
  if (recipe.mashC < 62 || recipe.mashC > 72)
    warnings.push("Mash model is unreliable outside 62–72°C.");
  if (y.diastaticus === null || y.pof === null)
    warnings.push(
      "POF/diastaticus status is unknown; verify with the yeast lab.",
    );
  return {
    ...v,
    og,
    fg,
    abv: abv.accurate,
    abvStandard: abv.standard,
    ibu,
    srm,
    ebc: srm * 1.97,
    bugu: og === 1 ? 0 : ibu / ((og - 1) * 1000),
    attenuation: attenuation * 100,
    preBoilGravity,
    calories12oz: calories(og, fg, 354.88235475),
    calories330: calories(og, fg, 330),
    pitchBillion: pitchRate(
      og,
      v.fermenterL,
      y.type.toLowerCase().includes("lager"),
      recipe.pitchMultiplier,
    ),
    warnings,
  };
}
export function beerColor(srm: number) {
  const n = Math.max(0, srm);
  return `rgb(${Math.round(255 * Math.pow(0.975, n))},${Math.round(245 * Math.pow(0.88, n))},${Math.round(200 * Math.pow(0.7, n))})`;
}
