import type { Catalog, Hop } from "./types";
import { normalizeSearch, searchByName } from "./search";

/** A broad flavor also finds hops noted only for a specific one, such as "citrus" for grapefruit. */
const INCLUDES: Record<string, string[]> = {
  citrus: ["citrus", "grapefruit", "lemon", "orange"],
  tropical: ["tropical", "mango", "passionfruit", "pineapple"],
};
/** Other words brewers search with, each standing for the flavors it means. */
const OTHER_WORDS: Record<string, string[]> = {
  citrusy: ["citrus"],
  citric: ["citrus"],
  lemony: ["lemon"],
  orangey: ["orange"],
  fruity: ["tropical", "stone-fruit", "berry", "orange"],
  fruit: ["tropical", "stone-fruit", "berry", "orange"],
  "passion fruit": ["passionfruit"],
  stonefruit: ["stone-fruit"],
  peach: ["stone-fruit"],
  apricot: ["stone-fruit"],
  berries: ["berry"],
  piney: ["pine"],
  resinous: ["resin"],
  flowery: ["floral"],
  flower: ["floral"],
  herb: ["herbal"],
  herby: ["herbal"],
  grass: ["grassy"],
  earth: ["earthy"],
  spice: ["spicy"],
  pepper: ["spicy"],
  peppery: ["spicy"],
  wood: ["woody"],
};

const notesByCatalog = new WeakMap<
  Catalog["descriptors"],
  Map<string, Set<string>>
>();
function flavorNotes(c: Catalog) {
  let notes = notesByCatalog.get(c.descriptors);
  if (!notes) {
    notes = new Map();
    for (const d of c.descriptors) {
      const set = notes.get(d.ingredientId) ?? new Set<string>();
      set.add(d.descriptor);
      notes.set(d.ingredientId, set);
    }
    notesByCatalog.set(c.descriptors, notes);
  }
  return notes;
}

/** The flavors a hop can be searched by, in the order the app lists them. */
export function hopFlavorOptions(c: Catalog) {
  return c.vocabulary.filter((v) => v.parent === "hops");
}

/** The flavors recorded for a hop, as readable names. Empty means there's no data, not no flavor. */
export function hopFlavors(hopId: string, c: Catalog) {
  const notes = flavorNotes(c).get(hopId);
  return notes
    ? hopFlavorOptions(c)
        .filter((v) => notes.has(v.id))
        .map((v) => v.label)
    : [];
}

export function hopHasFlavor(hopId: string, flavorId: string, c: Catalog) {
  const notes = flavorNotes(c).get(hopId);
  return (
    !!notes && (INCLUDES[flavorId] ?? [flavorId]).some((id) => notes.has(id))
  );
}

/** Hops with no flavor notes can't match a flavor search, whatever they taste like. */
export function hopsWithoutFlavorNotes(hops: readonly Hop[], c: Catalog) {
  return hops.filter((h) => !flavorNotes(c).has(h.id)).length;
}

function flavorTerms(c: Catalog) {
  const terms = new Map<string, string[]>();
  for (const v of hopFlavorOptions(c)) {
    terms.set(normalizeSearch(v.label), [v.id]);
    terms.set(normalizeSearch(v.id), [v.id]);
  }
  for (const [word, ids] of Object.entries(OTHER_WORDS))
    terms.set(normalizeSearch(word), ids);
  return terms;
}

/**
 * Search hops by name, details or flavor. Every word has to match, so "citrus pine" finds hops with
 * both. A whole flavor word means that flavor exactly ("pine" isn't "pineapple"), and a partial one
 * also matches flavors starting with it, so results appear while typing.
 */
export function searchHops<T extends Hop>(
  hops: readonly T[],
  query: string,
  c: Catalog,
  textOf: (hop: T) => string,
): T[] {
  const q = normalizeSearch(query);
  const fallback = () => searchByName(hops, query, (h) => h.name, textOf);
  if (!q) return fallback();
  const terms = flavorTerms(c);
  const words: string[] = [];
  const parts = q.split(" ");
  for (let i = 0; i < parts.length; i++) {
    const pair = `${parts[i]} ${parts[i + 1]}`;
    if (terms.has(pair)) {
      words.push(pair);
      i++;
    } else words.push(parts[i]);
  }
  const partial = (word: string) =>
    word.length < 3
      ? []
      : [...terms.entries()]
          .filter(([term]) => term.startsWith(word))
          .flatMap(([, ids]) => ids);
  if (!words.some((word) => terms.has(word) || partial(word).length))
    return fallback();
  const has = (hop: T, ids: string[]) =>
    ids.some((id) => hopHasFlavor(hop.id, id, c));
  const matches = (hop: T, word: string) => {
    const name = normalizeSearch(hop.name);
    if (terms.has(word))
      return name.includes(word) || has(hop, terms.get(word)!);
    return (
      normalizeSearch(`${hop.name} ${textOf(hop)}`).includes(word) ||
      has(hop, partial(word))
    );
  };
  const inName = (hop: T) => normalizeSearch(hop.name).includes(q);
  const found = searchByName(
    hops.filter((hop) => words.every((word) => matches(hop, word))),
    "",
    (h) => h.name,
    textOf,
  );
  return [...found.filter(inName), ...found.filter((h) => !inName(h))];
}
