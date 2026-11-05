import type { Catalog, Ingredient, Malt, Yeast } from "./types";
import { maltRole, yeastFamily } from "./library";
import { styleIngredientProfile } from "./suggestions";
import { normalizeSearch, searchByName } from "./search";

type Kind = Ingredient["kind"];

/** A broad flavor also finds hops noted only for a specific one, such as "citrus" for grapefruit. */
const INCLUDES: Record<string, string[]> = {
  citrus: ["citrus", "grapefruit", "lemon", "orange"],
  tropical: ["tropical", "mango", "passionfruit", "pineapple"],
};
/** Other words brewers search with, each standing for the flavors it means. */
const OTHER_WORDS: Record<Kind, Record<string, string[]>> = {
  hop: {
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
  },
  malt: {
    bread: ["bready"],
    malty: ["bready"],
    grain: ["grainy"],
    toast: ["toasty"],
    nutty: ["toasty", "biscuit"],
    nut: ["toasty", "biscuit"],
    cracker: ["biscuit"],
    sweet: ["sweetness", "caramel"],
    roasty: ["roast"],
    roasted: ["roast"],
    espresso: ["coffee"],
    mocha: ["coffee", "chocolate"],
    cocoa: ["chocolate"],
    smoke: ["smoky"],
    smoked: ["smoky"],
    peat: ["smoky"],
    creamy: ["body"],
    mouthfeel: ["body"],
  },
  yeast: {
    neutral: ["clean"],
    crisp: ["clean"],
    sour: ["tart"],
    funk: ["funky"],
    bananas: ["banana"],
    cloves: ["clove"],
    peppery: ["pepper"],
    spicy: ["pepper", "clove", "spicy"],
    spice: ["pepper", "clove", "spicy"],
    phenolic: ["clove", "pepper"],
    fruity: ["fruity-ester", "banana", "apple", "pear"],
    fruit: ["fruity-ester", "banana", "apple", "pear"],
    estery: ["fruity-ester", "banana", "apple", "pear"],
    esters: ["fruity-ester", "banana", "apple", "pear"],
    sulphur: ["sulfur"],
  },
};
/** Words in style names too general to say a malt or yeast relates to that style. */
const GENERAL_STYLE_WORDS = new Set(
  "ale beer american english german belgian irish scottish french british premium standard special classic other common light dark strong extra traditional specialty old northern southern foreign best ordinary heavy export or and".split(
    " ",
  ),
);
/** Names brewers use for a style that its catalog name doesn't include. */
const STYLE_NICKNAMES: Record<string, string> = {
  hefeweizen: "weizen",
  hefe: "weizen",
  wheat: "weizen",
  pils: "pilsner",
  pilsener: "pilsner",
  marzen: "oktoberfest",
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

/** The flavors recorded for an ingredient, as readable names. Empty means no data, not no flavor. */
export function flavorsOf(id: string, c: Catalog) {
  const notes = flavorNotes(c).get(id);
  return notes
    ? c.vocabulary.filter((v) => notes.has(v.id)).map((v) => v.label)
    : [];
}

export function hasFlavor(id: string, flavorId: string, c: Catalog) {
  const notes = flavorNotes(c).get(id);
  return (
    !!notes && (INCLUDES[flavorId] ?? [flavorId]).some((f) => notes.has(f))
  );
}

/** Ingredients with no flavor notes can't match a flavor search, whatever they taste like. */
export function withoutFlavorNotes(
  items: readonly Pick<Ingredient, "id">[],
  c: Catalog,
) {
  return items.filter((i) => !flavorNotes(c).has(i.id)).length;
}

const catalogItems = (kind: Kind, c: Catalog): readonly Ingredient[] =>
  kind === "hop" ? c.hops : kind === "malt" ? c.malts : c.yeasts;

/** The flavors worth offering as chips for this kind of ingredient, where we have data for them. */
export function flavorOptions(kind: Kind, c: Catalog) {
  const items = catalogItems(kind, c);
  return c.vocabulary.filter(
    (v) =>
      (kind === "hop"
        ? v.parent === "hops"
        : kind === "yeast"
          ? v.parent === "yeast"
          : v.parent === "malt" || v.id === "sweetness" || v.id === "body") &&
      items.some((i) => flavorNotes(c).get(i.id)?.has(v.id)),
  );
}

const termsByCatalog = new WeakMap<
  Catalog["descriptors"],
  Partial<Record<Kind, Map<string, string[]>>>
>();
/** Every flavor word for a kind of ingredient, limited to flavors its data actually records. */
function flavorTerms(kind: Kind, c: Catalog) {
  const cached = termsByCatalog.get(c.descriptors) ?? {};
  termsByCatalog.set(c.descriptors, cached);
  if (cached[kind]) return cached[kind];
  const recorded = new Set(
    catalogItems(kind, c).flatMap((i) => [...(flavorNotes(c).get(i.id) ?? [])]),
  );
  const terms = new Map<string, string[]>();
  for (const v of c.vocabulary)
    if (recorded.has(v.id)) {
      terms.set(normalizeSearch(v.label), [v.id]);
      terms.set(normalizeSearch(v.id), [v.id]);
    }
  for (const [word, ids] of Object.entries(OTHER_WORDS[kind]))
    terms.set(normalizeSearch(word), ids);
  cached[kind] = terms;
  return terms;
}

/** Styles a word or phrase names, for example "stout" or "dry stout". */
function stylesNamed(words: string, c: Catalog) {
  const nicknamed = words
    .split(" ")
    .map((word) => STYLE_NICKNAMES[word] ?? word)
    .join(" ");
  if (GENERAL_STYLE_WORDS.has(nicknamed) || nicknamed.length < 3) return [];
  return c.styles.filter((style) => {
    const name = ` ${normalizeSearch(style.name)} `;
    return (
      name.includes(` ${nicknamed} `) ||
      (nicknamed.length >= 4 && name.includes(` ${nicknamed}`))
    );
  });
}

function usedInStyle(item: Ingredient, styleId: string) {
  const profile = styleIngredientProfile(styleId);
  return item.kind === "malt"
    ? !!profile?.maltIds.includes(item.id)
    : item.kind === "yeast"
      ? !!profile?.yeastIds.includes(item.id)
      : false;
}

/** The words a malt's color goes by, since color names rarely appear in its name. */
function maltColorWords(m: Malt) {
  if (m.lovibond >= 400) return "dark black";
  if (m.lovibond >= 100) return "dark";
  if (m.lovibond >= 8) return "amber";
  return m.lovibond <= 4 ? "pale light" : "";
}

/** What else an ingredient goes by: a malt's role and color, or a yeast's family, form and type. */
export function relatedText(item: Ingredient) {
  if (item.kind === "malt") {
    const m = item as Malt;
    return `${maltRole(m)} ${m.type} ${m.maltster ?? ""} ${maltColorWords(m)}`;
  }
  if (item.kind === "yeast") {
    const y = item as Yeast;
    return `${yeastFamily(y)} ${y.type} ${y.form} ${y.lab} ${y.code}`;
  }
  return "";
}

/**
 * Search ingredients by name and details, and by what relates to them: flavor, a malt's role and
 * color, a yeast's family and form, or the beer styles that use a malt or yeast. Every word has to
 * match, so "citrus pine" finds hops with both. A whole flavor word means that flavor exactly ("pine"
 * isn't "pineapple"), and a partial one also matches flavors starting with it, so results appear
 * while typing.
 */
export function searchIngredients<T extends Ingredient>(
  items: readonly T[],
  query: string,
  c: Catalog,
  textOf: (item: T) => string,
  identifiersOf: (item: T) => readonly string[] = () => [],
): T[] {
  const q = normalizeSearch(query);
  const fallback = () =>
    searchByName(items, query, (i) => i.name, textOf, identifiersOf);
  if (!q) return fallback();

  const kinds = [...new Set(items.map((i) => i.kind))];
  const wholeStyle = stylesNamed(q, c);
  const relatesToStyle = kinds.some((k) => k !== "hop");
  const phraseIsStyle =
    relatesToStyle && wholeStyle.length > 0 && q.includes(" ");
  const parts = q.split(" ");
  const words: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const pair = `${parts[i]} ${parts[i + 1]}`;
    if (kinds.some((k) => flavorTerms(k, c).has(pair))) {
      words.push(pair);
      i++;
    } else words.push(parts[i]);
  }
  const partial = (kind: Kind, word: string) =>
    word.length < 3
      ? []
      : [...flavorTerms(kind, c).entries()]
          .filter(([term]) => term.startsWith(word))
          .flatMap(([, ids]) => ids);
  // Whole words only, so "ale" doesn't find every malt whose color word is "pale".
  const relatedHas = (item: T, word: string) =>
    ` ${normalizeSearch(relatedText(item))}`.includes(` ${word}`);
  const relatedWord = (word: string) =>
    kinds.some(
      (k) =>
        flavorTerms(k, c).has(word) ||
        partial(k, word).length > 0 ||
        (k !== "hop" && stylesNamed(word, c).length > 0),
    ) || items.some((item) => relatedHas(item, word));
  if (!phraseIsStyle && !words.some(relatedWord)) return fallback();

  const flavored = (item: T, ids: string[]) =>
    ids.some((id) => hasFlavor(item.id, id, c));
  const inStyles = (item: T, styles: { id: string }[]) =>
    styles.some((style) => usedInStyle(item, style.id));
  const matches = (item: T, word: string) => {
    const name = normalizeSearch(item.name);
    const terms = flavorTerms(item.kind, c);
    const styles = item.kind === "hop" ? [] : stylesNamed(word, c);
    // A flavor word means that flavor, not whatever a style with that word in its name happens to use.
    if (terms.has(word))
      return name.includes(word) || flavored(item, terms.get(word)!);
    return (
      normalizeSearch(`${item.name} ${textOf(item)}`).includes(word) ||
      relatedHas(item, word) ||
      flavored(item, partial(item.kind, word)) ||
      inStyles(item, styles)
    );
  };
  const inName = (item: T) => normalizeSearch(item.name).includes(q);
  const found = searchByName(
    items.filter(
      (item) =>
        (phraseIsStyle && inStyles(item, wholeStyle)) ||
        words.every((word) => matches(item, word)),
    ),
    "",
    (i) => i.name,
    textOf,
  );
  return [...found.filter(inName), ...found.filter((i) => !inName(i))];
}

/** Why a malt or yeast with no obvious link came up, when it's because a style uses it. */
export function styleMatchNote(item: Ingredient, query: string, c: Catalog) {
  if (item.kind === "hop") return "";
  const q = normalizeSearch(query);
  if (!q || normalizeSearch(item.name).includes(q)) return "";
  const style = [q, ...q.split(" ")]
    .flatMap((words) => stylesNamed(words, c))
    .find((s) => usedInStyle(item, s.id));
  return style ? `Used in ${style.name}` : "";
}
