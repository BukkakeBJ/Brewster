import guide from "../../data/suggestions.json";
import profiles from "../../data/style-ingredient-profiles.json";
import type { Catalog, HopAddition, Prediction, Recipe } from "./types";
import { predict } from "./calculations";
export type SuggestionKind = "hop" | "malt";
export type HopRole = "bittering" | "aroma" | "dry hop";
export interface StartingPoint {
  ingredientId: string;
  families: string[];
  group: string;
  reason: string;
  roles?: string[];
  percent?: number;
  source?: { title: string; url: string };
  /** Comes from the Recipe Book recipes for the recipe's own style. */
  fromStyle?: boolean;
  /** A second base malt: blended in rather than replacing the main one. */
  blend?: boolean;
}
export interface Suggestion {
  item: StartingPoint;
  name: string;
  reason: string;
  matchesStyle: boolean;
  alreadyUsed: boolean;
}
export function styleIngredientProfile(styleId: string) {
  return (
    profiles as Record<
      string,
      {
        referenceRecipe: string;
        maltIds: string[];
        hopIds: string[];
        yeastIds: string[];
        grist: { ingredientId: string; percent: number }[];
      }
    >
  )[styleId];
}
const MALT_GROUPS: Record<string, string> = {
  base: "base",
  "crystal-caramel": "caramel",
  roasted: "roast",
  adjunct: "body",
  specialty: "malt character",
  sugar: "sugar",
};
/** Starting share for malts a style's recipes use without a figure in its reference grain bill. */
const TYPICAL_SHARE: Record<string, number> = { base: 15, roasted: 3 };
/** The malts this style's Recipe Book recipes use, biggest share of the grain bill first. */
export function styleMalts(styleId: string, c: Catalog): StartingPoint[] {
  const profile = styleIngredientProfile(styleId);
  if (!profile) return [];
  const styleName =
    c.styles.find((s) => s.id === styleId)?.name ?? "this style";
  const share = (id: string) =>
    profile.grist.find((g) => g.ingredientId === id)?.percent;
  const malts = profile.maltIds
    .map((id) => c.malts.find((m) => m.id === id))
    .filter((m) => m !== undefined)
    .sort((a, b) => (share(b.id) ?? 0) - (share(a.id) ?? 0));
  const mainBase = malts.find((m) => m.type === "base");
  return malts.map((m) => {
    const percent = share(m.id);
    return {
      ingredientId: m.id,
      families: [],
      group: MALT_GROUPS[m.type] ?? "body",
      percent: Math.round(
        Math.min(percent ?? TYPICAL_SHARE[m.type] ?? 5, m.maxPercent, 95),
      ),
      fromStyle: true,
      blend: m.type === "base" && m !== mainBase,
      reason: percent
        ? `About ${Math.round(percent)}% of the grain bill in the Recipe Book's ${profile.referenceRecipe}.`
        : `Also used in Recipe Book recipes for ${styleName}.`,
    };
  });
}
export function recipeFamily(styleId: string) {
  if (/stout|porter|schwarz|dunkel|black|brown|dark/.test(styleId))
    return "dark";
  if (/ipa|pale-ale|american-amber/.test(styleId)) return "hoppy";
  if (/wheat|weizen|witbier/.test(styleId)) return "wheat";
  if (/belgi|saison|tripel|dubbel|trappist/.test(styleId)) return "belgian";
  if (/lager|pils|bock|helles|vienna|oktober/.test(styleId)) return "lager";
  if (/brit|english|bitter|mild|scott|irish-red/.test(styleId))
    return "british";
  return "general";
}
export function startingPoints(
  kind: SuggestionKind,
  c: Catalog,
  r: Recipe,
  mode: "match" | "popular" = "match",
  role?: HopRole,
  group = "all",
): Suggestion[] {
  const family = recipeFamily(r.styleId);
  const curated = (
    kind === "hop" ? guide.hops : guide.malts
  ) as StartingPoint[];
  const fromStyle =
    kind === "malt" && mode === "match" ? styleMalts(r.styleId, c) : [];
  const list = [
    ...fromStyle,
    ...curated.filter(
      (i) => !fromStyle.some((s) => s.ingredientId === i.ingredientId),
    ),
  ];
  const ingredients = kind === "hop" ? c.hops : c.malts;
  const rows = list
    .filter(
      (i) =>
        ingredients.some((x) => x.id === i.ingredientId) &&
        (!role || i.roles?.includes(role)) &&
        (group === "all" || i.group === group),
    )
    .map((item) => {
      const alreadyUsed = (kind === "hop" ? r.hops : r.grains).some(
        (g) => g.ingredientId === item.ingredientId,
      );
      const matchesStyle = !!item.fromStyle || item.families.includes(family);
      const match =
        matchesStyle && !item.fromStyle
          ? `Suggested for this ${family === "general" ? "freeform" : family} direction. `
          : "";
      return {
        item,
        name: ingredients.find((x) => x.id === item.ingredientId)!.name,
        reason: match + item.reason,
        matchesStyle,
        alreadyUsed,
      };
    });
  if (mode !== "match") return rows;
  // A style with its own recipes only hears about malts that belong in it.
  const relevant = fromStyle.length
    ? rows.filter((row) => row.matchesStyle)
    : rows;
  return relevant.sort(
    (a, b) =>
      Number(!!b.item.fromStyle) - Number(!!a.item.fromStyle) ||
      Number(a.alreadyUsed) - Number(b.alreadyUsed) ||
      Number(b.matchesStyle) - Number(a.matchesStyle),
  );
}
export function applyStartingPoint(
  r: Recipe,
  c: Catalog,
  kind: SuggestionKind,
  id: string,
  role: HopRole = "aroma",
  suggestion?: StartingPoint,
): Recipe {
  const entry =
    suggestion ??
    ((kind === "hop" ? guide.hops : guide.malts) as StartingPoint[]).find(
      (i) => i.ingredientId === id,
    );
  if (!entry) throw new Error("Unknown starting point.");
  if (kind === "hop") {
    if (!c.hops.some((h) => h.id === id) || !entry.roles?.includes(role))
      throw new Error(
        "This hop is unavailable or not suggested for that role.",
      );
    const use: HopAddition["use"] =
      role === "bittering"
        ? "boil"
        : role === "dry hop"
          ? "dry hop"
          : "whirlpool";
    if (role === "bittering" && r.boilMinutes <= 0)
      throw new Error(
        "Set a positive boil duration before adding a bittering hop.",
      );
    const addition: HopAddition = {
      ingredientId: id,
      use,
      grams:
        r.batchL * (role === "bittering" ? 0.5 : role === "dry hop" ? 1.5 : 1),
      minutes:
        role === "bittering"
          ? Math.min(60, r.boilMinutes)
          : role === "dry hop"
            ? 4320
            : 20,
    };
    return { ...r, hops: [...r.hops, addition] };
  }
  const m = c.malts.find((m) => m.id === id);
  if (!m) throw new Error("Malt is unavailable.");
  if (r.grains.some((g) => g.ingredientId === id))
    throw new Error("Already in the grain bill; edit its amount directly.");
  // A style's own malts stay put, so its base malts can be blended instead of swapped in turn.
  const keep = entry.fromStyle
    ? (styleIngredientProfile(r.styleId)?.maltIds ?? [])
    : [];
  const base = r.grains.findIndex(
    (g) =>
      c.malts.find((m) => m.id === g.ingredientId)?.type === "base" &&
      !keep.includes(g.ingredientId),
  );
  if (entry.group === "base" && !entry.blend && base >= 0) {
    const old = c.malts.find((m) => m.id === r.grains[base].ingredientId)!;
    return {
      ...r,
      grains: r.grains.map((g, j) =>
        j === base ? { ingredientId: id, kg: (g.kg * old.ppg) / m.ppg } : g,
      ),
    };
  }
  const total = r.grains.reduce((s, g) => s + g.kg, 0);
  if (total === 0 && entry.group !== "base")
    throw new Error("Add a base malt first, then choose a specialty addition.");
  const percent = Math.min(entry.percent ?? 5, m.maxPercent);
  if (percent <= 0 || percent >= 100)
    throw new Error("No safe suggested grist share.");
  const kg = total > 0 ? (total * percent) / (100 - percent) : r.batchL * 0.2;
  return { ...r, grains: [...r.grains, { ingredientId: id, kg }] };
}
export function suggestionImpact(
  before: Recipe,
  after: Recipe,
  c: Catalog,
): Pick<Prediction, "abv" | "ibu" | "srm"> {
  const a = predict(before, c),
    b = predict(after, c);
  return { abv: b.abv - a.abv, ibu: b.ibu - a.ibu, srm: b.srm - a.srm };
}
export const startingPointNote = guide.note;
