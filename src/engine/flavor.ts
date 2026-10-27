import type {
  Catalog,
  Contribution,
  Descriptor,
  Flavor,
  Prediction,
  Recipe,
} from "./types";
import { clamp } from "./calculations";
export interface Usage {
  medium?: "beer" | "wine";
  use?: string;
  percent?: number;
  tempC?: number;
}
export function contextMatches(d: Descriptor, u: Usage) {
  const x = d.context;
  return (
    (!x.medium || x.medium === (u.medium ?? "beer")) &&
    (!x.use || x.use === u.use) &&
    (x.minPercent === undefined || (u.percent ?? -Infinity) >= x.minPercent) &&
    (x.maxPercent === undefined || (u.percent ?? Infinity) <= x.maxPercent) &&
    (x.minTempC === undefined || (u.tempC ?? -Infinity) >= x.minTempC) &&
    (x.maxTempC === undefined || (u.tempC ?? Infinity) <= x.maxTempC)
  );
}
export function consensus(
  rows: Descriptor[],
  usage: Usage = {},
  userWeight = 1,
) {
  const grouped: Record<string, Descriptor[]> = {};
  for (const d of rows)
    if (contextMatches(d, usage)) (grouped[d.descriptor] ??= []).push(d);
  return Object.entries(grouped).map(([descriptor, ds]) => {
    const weight = (d: Descriptor) =>
      ({ low: 0.45, medium: 0.75, high: 1 })[d.confidence] *
      { manufacturer: 1.1, literature: 1, community: 0.8, user: userWeight }[
        d.sourceType
      ];
    const sum = ds.reduce((s, d) => s + weight(d), 0);
    return {
      descriptor,
      intensity: ds.reduce((s, d) => s + d.intensity * weight(d), 0) / sum,
      rows: ds,
      spread:
        Math.max(...ds.map((d) => d.intensity)) -
        Math.min(...ds.map((d) => d.intensity)),
    };
  });
}
export function flavorPredict(
  r: Recipe,
  c: Catalog,
  p: Prediction,
  userWeight = 1,
): Flavor {
  const contributions: Record<string, Contribution[]> = {};
  const indexed = new Map<string, Descriptor[]>();
  for (const d of c.descriptors) {
    const rows = indexed.get(d.ingredientId) ?? [];
    rows.push(d);
    indexed.set(d.ingredientId, rows);
  }
  const add = (axis: string, item: Contribution) => {
    if (item.score > 0) (contributions[axis] ??= []).push(item);
  };
  const total = r.grains.reduce((s, g) => s + g.kg, 0);
  for (const g of r.grains) {
    const m = c.malts.find((m) => m.id === g.ingredientId)!;
    const fraction = total ? g.kg / total : 0;
    for (const d of consensus(
      indexed.get(m.id) ?? [],
      { percent: fraction * 100 },
      userWeight,
    )) {
      let factor =
        m.type === "base" ? Math.sqrt(fraction) : Math.sqrt(fraction) * 3;
      if (d.descriptor === "chocolate" && fraction > 0.1) factor *= 0.5;
      add(d.descriptor, {
        ingredientId: m.id,
        ingredient: m.name,
        descriptor: d.descriptor,
        score: d.intensity * factor,
        descriptorIds: d.rows.map((d) => d.id),
        reason: `${(fraction * 100).toFixed(1)}% of grist; diminishing returns${d.descriptor === "chocolate" && fraction > 0.1 ? "; reduced chocolate above 10% roast" : ""}.`,
      });
    }
  }
  for (const h of r.hops) {
    const hop = c.hops.find((x) => x.id === h.ingredientId)!;
    const timing =
      h.use === "dry hop"
        ? 1
        : h.use === "whirlpool"
          ? 0.85
          : Math.exp(-h.minutes / 18);
    const dose = 1 - Math.exp(-(h.grams / r.batchL) / 3);
    const oil = Math.sqrt((hop.totalOil ?? 1.5) / 1.5);
    for (const d of consensus(
      indexed.get(hop.id) ?? [],
      { use: h.use },
      userWeight,
    ))
      add(d.descriptor, {
        ingredientId: hop.id,
        ingredient: hop.name,
        descriptor: d.descriptor,
        score: d.intensity * timing * dose * oil,
        descriptorIds: d.rows.map((d) => d.id),
        reason: `${h.use}, ${(h.grams / r.batchL).toFixed(2)} g/L; timing ×${timing.toFixed(2)}, oil ×${oil.toFixed(2)}${hop.totalOil === null ? " (assumed 1.5 mL/100g)" : ""}.`,
      });
  }
  const yeast = c.yeasts.find((y) => y.id === r.yeastId)!;
  const warm = yeast.tempC
    ? clamp(
        (r.fermentC - yeast.tempC[0]) / (yeast.tempC[1] - yeast.tempC[0] || 1),
        0,
        1,
      )
    : 0.5;
  for (const d of consensus(
    indexed.get(yeast.id) ?? [],
    { tempC: r.fermentC },
    userWeight,
  )) {
    const isEster = [
        "fruity-ester",
        "banana",
        "pear",
        "apple",
        "bubblegum",
      ].includes(d.descriptor),
      phenol = ["clove", "pepper"].includes(d.descriptor);
    const factor = isEster
      ? (0.6 + 0.9 * warm) * Math.pow(1 / r.pitchMultiplier, 0.25)
      : phenol
        ? 0.85 + 0.3 * warm
        : 1;
    add(d.descriptor, {
      ingredientId: yeast.id,
      ingredient: yeast.name,
      descriptor: d.descriptor,
      score: d.intensity * factor,
      descriptorIds: d.rows.map((d) => d.id),
      reason: `${r.fermentC.toFixed(1)}°C within strain range, pitch ×${r.pitchMultiplier.toFixed(2)}. ${isEster ? "Warmer/underpitched ester heuristic." : phenol ? "Strain descriptor and mild temperature heuristic." : "Reference strain descriptor."}`,
    });
  }
  const structure: Record<string, [number, string]> = {
    body: [
      clamp((p.fg - 1) * 180 + (r.mashC - 65) * 0.12, 0, 5),
      "FG and mash-temperature dextrin proxy.",
    ],
    sweetness: [
      clamp((p.fg - 1) * 140 - p.bugu * 0.4, 0, 5),
      "Residual gravity balanced against bitterness.",
    ],
    dryness: [
      clamp((p.attenuation - 50) / 10, 0, 5),
      "Apparent attenuation proxy.",
    ],
    bitterness: [clamp(p.bugu * 3.3, 0, 5), "BU:GU ×3.3."],
    carbonation: [
      clamp((r.carbonation / 3.5) * 5, 0, 5),
      "Recipe carbonation setting /3.5 ×5.",
    ],
    astringency: [
      clamp(
        (r.grains
          .filter(
            (g) =>
              c.malts.find((m) => m.id === g.ingredientId)?.type === "roasted",
          )
          .reduce((s, g) => s + g.kg, 0) /
          (total || 1)) *
          15,
        0,
        5,
      ),
      "Roast fraction proxy; water pH is not modeled.",
    ],
  };
  const scores: Record<string, number> = {};
  for (const v of c.vocabulary) {
    const rows = contributions[v.id] ?? [];
    const raw = rows.reduce((s, a) => s + a.score, 0);
    const score = 5 * (1 - Math.exp(-raw / 5));
    scores[v.id] = score;
    if (raw) rows.forEach((a) => (a.score *= score / raw));
  }
  for (const [axis, [score, reason]] of Object.entries(structure)) {
    scores[axis] = score;
    contributions[axis] = [
      {
        ingredientId: "process",
        ingredient: "Recipe structure",
        descriptor: axis,
        score,
        descriptorIds: [],
        reason,
      },
    ];
  }
  return { scores, contributions };
}
export function hopSimilarity(id: string, c: Catalog) {
  const a = c.hops.find((h) => h.id === id)!;
  const vec = (i: string) =>
    Object.fromEntries(
      consensus(
        c.descriptors.filter((d) => d.ingredientId === i),
        { use: "dry hop" },
      ).map((d) => [d.descriptor, d.intensity]),
    );
  const av = vec(id);
  return c.hops
    .filter((b) => b.id !== id)
    .map((b) => {
      const bv = vec(b.id);
      const terms = new Set([...Object.keys(av), ...Object.keys(bv)]);
      let dot = 0,
        aa = 0,
        bb = 0;
      terms.forEach((t) => {
        dot += (av[t] ?? 0) * (bv[t] ?? 0);
        aa += (av[t] ?? 0) ** 2;
        bb += (bv[t] ?? 0) ** 2;
      });
      const flavor = aa && bb ? dot / Math.sqrt(aa * bb) : 0;
      const oilKeys = Object.keys(a.oils).filter(
        (k) => a.oils[k] !== null && b.oils[k] !== null,
      );
      const oil = oilKeys.length
        ? 1 -
          oilKeys.reduce(
            (s, k) => s + Math.abs(a.oils[k]! - b.oils[k]!) / 100,
            0,
          ) /
            oilKeys.length
        : 0;
      const alpha = 1 - Math.min(1, Math.abs(a.alpha[0] - b.alpha[0]) / 15);
      return {
        hop: b,
        score: Math.round(100 * (flavor * 0.65 + oil * 0.25 + alpha * 0.1)),
        oilCoverage: oilKeys.length,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
