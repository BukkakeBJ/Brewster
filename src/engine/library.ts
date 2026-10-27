import type { Catalog, Ingredient, Malt, Hop, Yeast } from "./types";
import { yeastGroups, yeastGuide } from "./yeast";
import { alcohol } from "./calculations";
export function yeastAlcoholRange(
  y: Yeast,
  og: number,
): [number, number] | null {
  if (!y.attenuation) return null;
  return y.attenuation.map(
    (a) => alcohol(og, og - ((og - 1) * a) / 100).accurate,
  ) as [number, number];
}
export function hopRoles(h: Hop): string[] {
  const out: string[] = [];
  if (
    h.purpose.toLowerCase().includes("bitter") ||
    h.purpose.toLowerCase().includes("dual") ||
    h.alpha[0] >= 9
  )
    out.push("Bittering");
  if (!h.purpose.toLowerCase().includes("bitter") || (h.totalOil ?? 0) >= 1)
    out.push("Aroma", "Flavor", "Dry hopping");
  return out.length ? out : ["Bittering"];
}
export function maltRole(m: Malt) {
  return (
    (
      {
        base: "Base / backbone",
        "crystal-caramel": "Caramel / sweetness",
        roasted: "Roast / color",
        specialty: "Specialty / character",
        adjunct: "Adjunct / texture",
        sugar: "Sugar / gravity",
        extract: "Extract / convenience",
      } as Record<string, string>
    )[m.type] ?? "Specialty / character"
  );
}
export function yeastFamily(y: Yeast) {
  return yeastGroups(y)
    .map((f) => f.label)
    .join(" · ");
}
export function describeIngredient(
  i: Ingredient,
  c: Catalog,
): { intro: string; use: string; process: string; limits: string } {
  if (i.kind === "hop") {
    const h = i as Hop;
    const names = c.descriptors
      .filter((d) => d.ingredientId === i.id && d.context.use === "dry hop")
      .map((d) => d.descriptor)
      .slice(0, 6)
      .join(", ");
    return {
      intro: `${h.name} is a ${h.purpose} hop from ${h.origin}. Its reference alpha-acid value is ${h.alpha.join("–")}%. Alpha acids primarily determine the potential for kettle bitterness; they do not describe the strength of hop aroma.`,
      use: `Suggested roles: ${hopRoles(h).join(", ")}. ${names ? `Reference sensory associations include ${names}. Their intensities depend on recipe dose and context.` : "Detailed sensory evidence is limited in this catalog."} These roles are editorial suitability filters, not exclusive botanical types.`,
      process: `Long boil additions favor isomerized bitterness. Late boil and whirlpool retain more aroma; dry hopping adds aroma after the boil and has zero Tinseth IBU in this model. ${h.totalOil !== null ? `The reference total oil is ${h.totalOil} mL/100g; individual oil percentages are listed below when known.` : "Oil content is unknown; the prediction model uses an explicitly labeled fallback."}`,
      limits: `Crop year, storage, extraction and fermentation can change the result. Enter your lot's alpha acids in the recipe editor. ${h.substitutes.length ? `Published substitution leads: ${h.substitutes.join(", ")}. Check the similarity suggestions and adjust bittering mass for alpha acids.` : "No published substitutions in this reference record."}`,
    };
  }
  if (i.kind === "malt") {
    const m = i as Malt;
    return {
      intro: `${m.name} is cataloged as ${m.type}${m.maltster ? " from " + m.maltster : ""}. Its reference color is ${m.lovibond} °Lovibond (${m.ebc} EBC) and extract yield is ${m.extractPercent}% (${m.ppg.toFixed(1)} PPG). These are planning values; a malt analysis sheet describes the actual lot.`,
      use: `Suggested role: ${maltRole(m)}. ${m.type === "base" ? "Builds the fermentable backbone and usually forms most of the grist." : m.type === "crystal-caramel" ? "Provides caramel-like sensory associations and a less fermentable extract contribution. Higher percentages can make balance difficult." : m.type === "roasted" ? "Small amounts can have a large color and roast impact. The flavor model shifts toward burnt character above 10% of grist." : m.type === "adjunct" ? "Can change texture and dilute malt character; unmalted starch usually depends on enzymes from base malt." : m.type === "sugar" ? "Raises gravity without adding mash enzyme capacity; fermentability depends on the specific sugar. Lactose is treated as unfermentable." : "Adjusts color, texture or malt character. Evaluate its descriptors in the context of the complete grist."}`,
      process: `${m.requiresMash ? "Include in a mash; starch conversion and extraction depend on the mash and equipment." : "No mash conversion is assumed; the engine uses 100% recovery for this ingredient."} ${m.maxPercentIsEstimate ? "Recommended max grist is unknown; the engine uses a permissive 100% cap, not manufacturer advice." : `Reference maximum: ${m.maxPercent}% of grist.`} ${m.diastaticPower === null ? "Diastatic power is unpublished here; do not assume a specialty or adjunct can self-convert." : `Diastatic power: ${m.diastaticPower} °Lintner.`}`,
      limits: `${m.fermentabilityNotes} Body contribution (${m.bodyContribution}) is a model classification, not a measured malt property. Color and PPG alone do not predict taste. Follow manufacturer usage advice where the reference lacks specificity.`,
    };
  }
  const y = i as Yeast;
  return {
    intro: `${y.lab} ${y.code} ${y.name} is a ${y.form} culture in ${yeastFamily(y)}. ${y.attenuation ? `Reference apparent attenuation is ${y.attenuation.join("–")}%.` : "Beer-wort attenuation is not published in this record."} Flocculation: ${y.flocculation}. Flocculation describes settling behavior, not fermentation completeness.`,
    use: `${y.tempC ? `Its reference fermentation range is ${y.tempC.map((t) => t.toFixed(1)).join("–")}°C.` : "A brewing fermentation range is not published here."} ${y.alcoholTolerance === null ? "Alcohol tolerance is not published in this record." : `Reference alcohol tolerance is ${y.alcoholTolerance}% ABV, an approximate working limit rather than a promise of alcohol production.`} Gravity and wort fermentability determine how much alcohol can actually be produced. ${yeastGuide(y)?.use ?? ""}`,
    process: `Choose pitch rate for gravity, volume and yeast family; then manage fermentation temperature. Warmer fermentation can shift esters in susceptible strains, which the flavor panel models as an explicit heuristic. Attenuation ranges do not account for every wort composition or fermentation condition.`,
    limits: `POF status: ${y.pof === null ? "unknown" : y.pof ? "positive" : "negative"}; diastaticus: ${y.diastaticus === null ? "unknown" : y.diastaticus ? "yes" : "no"}. Check current lab guidance. Unknown is not a negative test result. The library's ABV interval uses the attenuation range at your entered OG, with no mash adjustment; unknown wort attenuation has no ABV interval. Tolerance and estimated ABV are separate filters.`,
  };
}
