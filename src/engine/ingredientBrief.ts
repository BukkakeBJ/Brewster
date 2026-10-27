import type { Catalog, Hop, Malt, Yeast } from "./types";
import { consensus, type Usage } from "./flavor";
import { cToF, midpoint } from "./calculations";

export type SelectableIngredient = Hop | Malt | Yeast;
/** Reference numbers and sensory evidence stay in separate fields, even in a short preview. */
export function ingredientBrief(
  item: SelectableIngredient,
  catalog: Catalog,
  usage: Usage = {},
  us = false,
) {
  const range = (values: [number, number] | null, unit: string) =>
    values ? `${values.join("–")}${unit}` : "Not published";
  let specs: [string, string][];
  let context: Usage;
  let contextLabel: string;
  if (item.kind === "hop") {
    const role =
      item.purpose === "dual"
        ? "Dual purpose · aroma & bittering"
        : `${item.purpose} hop`;
    specs = [
      ["Role", role],
      ["Alpha acids", range(item.alpha, "%")],
      ["Beta acids", range(item.beta, "%")],
      [
        "Total oils",
        item.totalOil === null ? "Not published" : `${item.totalOil} mL/100 g`,
      ],
    ];
    context = { use: "whirlpool", ...usage };
    contextLabel =
      context.use === "dry hop"
        ? "Dry hopping"
        : context.use === "boil"
          ? "Boil addition; retained aroma depends on timing"
          : "Whirlpool / aroma addition";
  } else if (item.kind === "malt") {
    specs = [
      ["Role", item.type],
      ["Color", `${item.lovibond} °L · ${item.ebc} EBC`],
      ["Extract potential", `${item.ppg.toFixed(1)} PPG`],
      [
        item.maxPercentIsEstimate
          ? "House grist limit"
          : "Recommended grist limit",
        `${item.maxPercent}%`,
      ],
    ];
    context = { percent: item.type === "base" ? 90 : 5, ...usage };
    contextLabel = `${context.percent?.toFixed(1)}% of grist`;
  } else {
    const temperatures = item.tempC?.map((v) => (us ? cToF(v) : v)) as
      [number, number] | undefined;
    specs = [
      ["Type", `${item.type} · ${item.form}`],
      ["Apparent attenuation", range(item.attenuation, "%")],
      [
        "Alcohol tolerance",
        item.alcoholTolerance === null
          ? "Unknown for brewing"
          : `Up to ${item.alcoholTolerance}% ABV`,
      ],
      ["Fermentation range", range(temperatures ?? null, us ? " °F" : " °C")],
    ];
    context = { tempC: item.tempC ? midpoint(item.tempC) : 20, ...usage };
    contextLabel = `Beer fermentation at ${(us ? cToF(context.tempC ?? 20) : (context.tempC ?? 20)).toFixed(1)} ${us ? "°F" : "°C"}`;
  }
  const labels = new Map(catalog.vocabulary.map((v) => [v.id, v.label]));
  const evidence = consensus(
    catalog.descriptors.filter((d) => d.ingredientId === item.id),
    context,
  )
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 5);
  const flavors = evidence.map((d) => labels.get(d.descriptor) ?? d.descriptor);
  const sources = [
    ...new Set(
      evidence.flatMap((d) =>
        d.rows.map((row) => `${row.sourceType} · ${row.confidence} confidence`),
      ),
    ),
  ];
  const text = `REFERENCE SPECS: ${specs.map(([key, value]) => `${key}: ${value}`).join(". ")}. FLAVOR ESTIMATE (${contextLabel}): ${flavors.join(", ") || "No matching sensory evidence"}. ${sources.join("; ")}.`;
  return { specs, flavors, sources, contextLabel, text };
}
