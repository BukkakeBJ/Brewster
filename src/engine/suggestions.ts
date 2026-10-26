import guide from "../../data/suggestions.json";
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
}
export interface Suggestion {
  item: StartingPoint;
  name: string;
  reason: string;
  matchesStyle: boolean;
  alreadyUsed: boolean;
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
  const list = (kind === "hop" ? guide.hops : guide.malts) as StartingPoint[];
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
      const matchesStyle = item.families.includes(family);
      const match = matchesStyle
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
  if (mode === "match")
    rows.sort(
      (a, b) =>
        Number(b.matchesStyle) - Number(a.matchesStyle) ||
        Number(a.alreadyUsed) - Number(b.alreadyUsed),
    );
  return rows;
}
export function applyStartingPoint(
  r: Recipe,
  c: Catalog,
  kind: SuggestionKind,
  id: string,
  role: HopRole = "aroma",
): Recipe {
  const entry = (
    (kind === "hop" ? guide.hops : guide.malts) as StartingPoint[]
  ).find((i) => i.ingredientId === id);
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
  const base = r.grains.findIndex(
    (g) => c.malts.find((m) => m.id === g.ingredientId)?.type === "base",
  );
  if (entry.group === "base" && base >= 0) {
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
