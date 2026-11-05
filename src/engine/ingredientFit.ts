import type {
  Catalog,
  HopAddition,
  Recipe,
  Style,
  Target,
  Yeast,
} from "./types";
import { predict } from "./calculations";
import { colorName } from "./glassware";
import { styleIngredientProfile } from "./recommendations";
import { closestStyles, hasComparableStyleRanges } from "./styleMatch";
import { startingPoints, styleMalts } from "./suggestions";
import { yeastGroups } from "./yeast";

type Malt = Catalog["malts"][number];
type Character = "roasted" | "dark caramel" | "smoked";

/** The malts that change what a beer is, rather than which brand of the same thing it uses. */
function character(m: Malt): Character | undefined {
  if (/smok|rauch|peat/i.test(m.name)) return "smoked";
  if (m.type === "sugar" || m.type === "extract") return undefined;
  if (m.lovibond >= 200) return "roasted";
  if (m.type === "crystal-caramel" && m.lovibond >= 40) return "dark caramel";
  return undefined;
}

/** Would this malt's character be out of place? Roast and dark caramel stand out in pale beers. */
function clashes(m: Malt, style: Style, c: Catalog) {
  const kind = character(m);
  if (!kind) return false;
  const own = styleIngredientProfile(style.id)?.maltIds ?? [];
  if (
    own.some((id) => {
      const malt = c.malts.find((x) => x.id === id);
      return malt && character(malt) === kind;
    })
  )
    return false;
  if (kind === "smoked") return true;
  return style.srm[1] < (kind === "roasted" ? 15 : 8);
}

const clashWords: Record<Character, (name: string, style: Style) => string> = {
  roasted: (name, style) =>
    `${name} is a dark roasted malt, and ${style.name} is a lighter beer that doesn't normally use one.`,
  "dark caramel": (name, style) =>
    `${name} is a dark caramel malt, and ${style.name} is too pale to normally use one.`,
  smoked: (name, style) =>
    `${name} tastes smoky, and ${style.name} recipes don't normally have that flavor.`,
};

/**
 * Why a malt the brewer just picked looks strange for the recipe's style. Empty means it's fine;
 * another pale base malt or a similar caramel malt is never strange. A pick that moves toward a
 * color goal the brewer deliberately set outside the style isn't questioned on color.
 */
export function unusualMalt(
  before: Recipe,
  after: Recipe,
  maltId: string,
  c: Catalog,
  goalSrm?: number,
): string[] {
  const style = c.styles.find((s) => s.id === after.styleId);
  const m = c.malts.find((x) => x.id === maltId);
  if (!style || !m || !hasComparableStyleRanges(style)) return [];
  let was: number, now: number;
  try {
    was = predict(before, c).srm;
    now = predict(after, c).srm;
  } catch {
    return [];
  }
  const outside = (srm: number) =>
    Math.max(0, style.srm[0] - srm, srm - style.srm[1]);
  const chasingColor =
    goalSrm !== undefined &&
    outside(goalSrm) > 0 &&
    Math.abs(now - goalSrm) < Math.abs(was - goalSrm);
  const kind = character(m);
  const reasons: string[] = [];
  if (kind && clashes(m, style, c) && (kind === "smoked" || !chasingColor))
    reasons.push(clashWords[kind](m.name, style));
  const own = styleIngredientProfile(style.id)?.maltIds ?? [];
  const total = after.grains.reduce((sum, g) => sum + g.kg, 0);
  const amount = after.grains.find((g) => g.ingredientId === maltId)?.kg ?? 0;
  const share = total ? (100 * amount) / total : 0;
  if (
    !own.includes(maltId) &&
    share > m.maxPercent * 1.5 &&
    share > m.maxPercent + 5
  )
    reasons.push(
      `It would be ${share.toFixed(0)}% of the grain bill, and brewers rarely use more than ${m.maxPercent}%.`,
    );
  if (!chasingColor && outside(now) > outside(was) + 1)
    reasons.push(
      `It takes the color to ${now.toFixed(0)} SRM (${colorName(now).toLowerCase()}). ${style.name} is usually ${style.srm.join("–")} SRM.`,
    );
  return reasons;
}

/** Flavors that dominate a beer when a hop goes in late, unlike citrus, floral or spicy notes. */
const LOUD_HOP_FLAVORS = [
  "grapefruit",
  "tropical",
  "mango",
  "passionfruit",
  "pineapple",
  "pine",
  "resin",
  "dank",
];
const flavorWords: Record<string, string> = {
  grapefruit: "grapefruit",
  tropical: "tropical fruit",
  mango: "mango",
  passionfruit: "passionfruit",
  pineapple: "pineapple",
  pine: "pine",
  resin: "resin",
  dank: "dank",
};
function loudFlavors(hopId: string, c: Catalog) {
  const flavors = new Set(
    c.descriptors
      .filter((d) => d.ingredientId === hopId)
      .map((d) => d.descriptor),
  );
  if (flavors.has("noble")) return [];
  return LOUD_HOP_FLAVORS.filter((flavor) => flavors.has(flavor));
}

/** Would this hop's flavor stand out in a style whose own hops are all restrained? */
export function hopClashes(
  hopId: string,
  styleId: string,
  c: Catalog,
  flavors: Target["flavors"] = {},
) {
  const style = c.styles.find((s) => s.id === styleId);
  if (!style || !hasComparableStyleRanges(style)) return false;
  const loud = loudFlavors(hopId, c);
  if (!loud.length || loud.some((flavor) => (flavors[flavor] ?? 0) >= 2))
    return false;
  const own = styleIngredientProfile(styleId)?.hopIds ?? [];
  return own.length > 0 && !own.some((id) => loudFlavors(id, c).length);
}

/** A long boil only adds bitterness, so a hop's flavor matters only when it goes in late. */
function isLateHop(h: HopAddition) {
  return h.use !== "boil" || h.minutes <= 20;
}

/** Why a hop just added or moved looks strange for the style. Empty means it's fine. */
export function unusualHop(
  before: Recipe,
  after: Recipe,
  hopId: string,
  c: Catalog,
  target?: Pick<Target, "ibu" | "flavors">,
): string[] {
  const style = c.styles.find((s) => s.id === after.styleId);
  const hop = c.hops.find((h) => h.id === hopId);
  if (!style || !hop || !hasComparableStyleRanges(style)) return [];
  let was: number, now: number;
  try {
    was = predict(before, c).ibu;
    now = predict(after, c).ibu;
  } catch {
    return [];
  }
  const reasons: string[] = [];
  const late = after.hops.some((h) => h.ingredientId === hopId && isLateHop(h));
  if (late && hopClashes(hopId, style.id, c, target?.flavors)) {
    const named = loudFlavors(hopId, c)
      .slice(0, 2)
      .map((flavor) => flavorWords[flavor])
      .join(" and ");
    reasons.push(
      `${hop.name} is known for bold ${named} flavors. ${style.name} is normally brewed with more restrained hops, so these would stand out.`,
    );
  }
  const outside = (ibu: number) =>
    Math.max(0, style.ibu[0] - ibu, ibu - style.ibu[1]);
  const chasing =
    target !== undefined &&
    outside(target.ibu) > 0 &&
    Math.abs(now - target.ibu) < Math.abs(was - target.ibu);
  // Moving a hop in the schedule only asks about flavor; the page's tips already cover bitterness.
  const isNew = !before.hops.some((h) => h.ingredientId === hopId);
  if (isNew && !chasing && outside(now) > outside(was) + 5)
    reasons.push(
      `It takes bitterness to ${now.toFixed(0)} IBU. ${style.name} is usually ${style.ibu.join("–")} IBU.`,
    );
  return reasons;
}

type YeastFamily =
  | "lager"
  | "ale"
  | "wheat"
  | "belgian"
  | "sour"
  | "wine"
  | "baking"
  | "unknown";

/**
 * The kind of fermentation a yeast gives, which decides whether it suits a style. Some labs sell
 * strains under house names that don't say what they are, and those are never questioned.
 */
function yeastFamily(y: Yeast): YeastFamily {
  const type = y.type.toLowerCase();
  const name = y.name.toLowerCase();
  const groups = yeastGroups(y).map((g) => g.id);
  if (groups.includes("baking") || type === "baking") return "baking";
  if (groups.includes("wine") || type === "wine" || type === "champagne")
    return "wine";
  if (
    type === "brett" ||
    type === "lacto" ||
    groups.includes("brett") ||
    /berliner|lambic|roeselare|sour|oud bruin|flemish/.test(name)
  )
    return "sour";
  if (type === "lager") return "lager";
  if (
    /hefe|weizen|weiss|wb-06|bavarian wheat|munich wheat|german wheat|clove|banana/.test(
      name,
    )
  )
    return "wheat";
  if (
    groups.includes("belgian") ||
    /belg|abbey|abbot|monast|trappist|saison|antwerp|farmhouse|leuven|blanche|\bwit\b|golden strong|flanders golden|forbidden fruit|t-58/.test(
      name,
    )
  )
    return "belgian";
  const known = groups.some((g) => g !== "other");
  return known || /\bale\b|safale|lalbrew|k(o|ö)lsch/.test(name)
    ? "ale"
    : "unknown";
}

function ownYeastFamilies(styleId: string, c: Catalog) {
  const families = (styleIngredientProfile(styleId)?.yeastIds ?? []).flatMap(
    (id) => {
      const y = c.yeasts.find((x) => x.id === id);
      return y ? [yeastFamily(y)] : [];
    },
  );
  // Cream ale is traditionally made with a blend of ale and lager yeast.
  if (styleId === "cream-ale") families.push("ale", "lager");
  return new Set(families.filter((family) => family !== "unknown"));
}

/** Would this yeast take the beer away from the way the style normally ferments? */
export function yeastClashes(yeastId: string, styleId: string, c: Catalog) {
  const style = c.styles.find((s) => s.id === styleId);
  const y = c.yeasts.find((x) => x.id === yeastId);
  if (!style || !y || !hasComparableStyleRanges(style)) return false;
  const family = yeastFamily(y);
  const own = ownYeastFamilies(styleId, c);
  return family !== "unknown" && own.size > 0 && !own.has(family);
}

function yeastClashWords(y: Yeast, style: Style, c: Catalog) {
  const own = ownYeastFamilies(style.id, c);
  switch (yeastFamily(y)) {
    case "lager":
      return `${y.name} is a lager yeast that ferments cold and clean. ${style.name} is normally brewed with ale yeast, so it would lose some of its usual character.`;
    case "wheat":
      return `${y.name} is a wheat beer yeast known for banana and clove flavors, which ${style.name} doesn't normally have.`;
    case "belgian":
      return `${y.name} is a Belgian-style yeast known for fruity, peppery flavors, which ${style.name} doesn't normally have.`;
    case "sour":
      return `${y.name} is a wild or souring culture. It can make the beer sour or funky, which ${style.name} normally isn't.`;
    case "wine":
      return `${y.name} is a wine yeast. It's rarely used for beer and can leave ${style.name} thin and very dry.`;
    case "baking":
      return `${y.name} is a baking yeast. It isn't bred for beer and can leave off flavors.`;
    default:
      if (own.has("lager"))
        return `${y.name} is an ale yeast that ferments warmer and fruitier. ${style.name} is normally a clean, cold-fermented lager.`;
      if (own.has("wheat"))
        return `${y.name} ferments clean, so it won't give the banana and clove flavors ${style.name} is known for.`;
      if (own.has("belgian"))
        return `${y.name} ferments clean, so it won't give the fruity, peppery flavors ${style.name} is known for.`;
      if (own.has("sour"))
        return `${y.name} ferments clean, so it won't give the sourness ${style.name} is known for.`;
      return `${y.name} isn't the kind of yeast ${style.name} is normally brewed with.`;
  }
}

/** Why a yeast just chosen looks strange for the style. Empty means it's fine. */
export function unusualYeast(
  before: Recipe,
  after: Recipe,
  yeastId: string,
  c: Catalog,
): string[] {
  const style = c.styles.find((s) => s.id === after.styleId);
  const y = c.yeasts.find((x) => x.id === yeastId);
  if (!style || !y || !hasComparableStyleRanges(style)) return [];
  let was: ReturnType<typeof predict>, now: ReturnType<typeof predict>;
  try {
    was = predict(before, c);
    now = predict(after, c);
  } catch {
    return [];
  }
  const reasons: string[] = [];
  if (yeastClashes(yeastId, style.id, c))
    reasons.push(yeastClashWords(y, style, c));
  const own = styleIngredientProfile(style.id)?.yeastIds ?? [];
  if (
    !own.includes(yeastId) &&
    y.alcoholTolerance !== null &&
    y.alcoholTolerance < now.abv - 0.5
  )
    reasons.push(
      `It usually stops around ${y.alcoholTolerance}% alcohol, and this beer is aiming for ${now.abv.toFixed(1)}%.`,
    );
  const outside = (fg: number) =>
    Math.max(0, style.fg[0] - fg, fg - style.fg[1]);
  if (!own.includes(yeastId) && outside(now.fg) > outside(was.fg) + 0.004)
    reasons.push(
      `It would finish at ${now.fg.toFixed(3)}, ${now.fg > style.fg[1] ? "sweeter" : "drier"} than the ${style.fg.map((n) => n.toFixed(3)).join("–")} usual for ${style.name}.`,
    );
  return reasons;
}

export type PickKind = "malt" | "hop" | "yeast";
export interface UnusualPick {
  kind: PickKind;
  id: string;
  name: string;
  reasons: string[];
  /** Answering once settles this question. A hop asked about in the boil is asked again if moved late. */
  answerKey: string;
}

/**
 * Finds the ingredient an edit brought into the recipe, or the hop it moved from a long boil to a
 * late addition, and whether it looks strange.
 */
export function unusualPick(
  before: Recipe,
  after: Recipe,
  c: Catalog,
  target: Pick<Target, "ibu" | "srm" | "flavors">,
  answered: (answerKey: string) => boolean = () => false,
): UnusualPick | undefined {
  const malt = after.grains.find(
    (g) => !before.grains.some((old) => old.ingredientId === g.ingredientId),
  )?.ingredientId;
  const hop = after.hops.find((h) => {
    const earlier = before.hops.filter(
      (old) => old.ingredientId === h.ingredientId,
    );
    return !earlier.length || (isLateHop(h) && !earlier.some(isLateHop));
  })?.ingredientId;
  const yeast = after.yeastId !== before.yeastId ? after.yeastId : undefined;
  const picks: [PickKind, string | undefined, () => string[]][] = [
    ["malt", malt, () => unusualMalt(before, after, malt!, c, target.srm)],
    ["hop", hop, () => unusualHop(before, after, hop!, c, target)],
    ["yeast", yeast, () => unusualYeast(before, after, yeast!, c)],
  ];
  for (const [kind, id, check] of picks) {
    if (!id) continue;
    const late =
      kind === "hop" &&
      after.hops.some((h) => h.ingredientId === id && isLateHop(h));
    const answerKey = `${after.styleId}|${id}${late ? "|late" : ""}`;
    if (answered(answerKey)) continue;
    const reasons = check();
    if (!reasons.length) continue;
    const items =
      kind === "malt" ? c.malts : kind === "hop" ? c.hops : c.yeasts;
    return {
      kind,
      id,
      name: items.find((item) => item.id === id)!.name,
      reasons,
      answerKey,
    };
  }
  return undefined;
}

/** What stays and what follows when the style changes because of a pick at this step. */
export const restyleWords: Record<PickKind, string> = {
  malt: "Your malts stay. Hops, yeast and mash switch to suit the new style.",
  hop: "Your malts and hops stay. Yeast switches to suit the new style.",
  yeast: "Your malts, hops and yeast stay. Only the style and goals change.",
};

/** Styles this recipe could become with the ingredient in it, closest numbers first. */
export function stylesForPick(
  recipe: Recipe,
  pick: Pick<UnusualPick, "kind" | "id">,
  c: Catalog,
  limit = 3,
): Style[] {
  const p = predict(recipe, c);
  const m = c.malts.find((x) => x.id === pick.id);
  const fits = (s: Style) =>
    pick.kind === "malt"
      ? !m || !clashes(m, s, c)
      : pick.kind === "hop"
        ? !hopClashes(pick.id, s.id, c)
        : !yeastClashes(pick.id, s.id, c);
  const matches = closestStyles({ abv: p.abv, ibu: p.ibu, srm: p.srm }, c)
    .map((match) => match.style)
    .filter((s) => s.id !== recipe.styleId && styleIngredientProfile(s.id));
  const fitting = matches.filter(fits);
  return (fitting.length ? fitting : matches).slice(0, limit);
}

export interface MaltOption {
  id: string;
  note: string;
}

/** Malts to offer first when the brewer adds one, or swaps out the one in `replacing`. */
export function suggestedMalts(
  r: Recipe,
  c: Catalog,
  replacing?: string,
  goalSrm?: number,
  limit = 6,
): MaltOption[] {
  const used = (id: string) => r.grains.some((g) => g.ingredientId === id);
  const current = c.malts.find((m) => m.id === replacing);
  // Nothing on offer should turn around and raise the "unusual malt" question.
  const fine = (id: string) =>
    !unusualMalt(
      r,
      {
        ...r,
        grains: current
          ? r.grains.map((g) =>
              g.ingredientId === current.id ? { ...g, ingredientId: id } : g,
            )
          : [...r.grains, { ingredientId: id, kg: 0.25 }],
      },
      id,
      c,
      goalSrm,
    ).length;
  if (!current)
    return startingPoints("malt", c, r)
      .filter((row) => !row.alreadyUsed && fine(row.item.ingredientId))
      .slice(0, limit)
      .map((row) => ({
        id: row.item.ingredientId,
        note: row.item.fromStyle ? "Used in this style" : "Popular choice",
      }));
  const own = styleMalts(r.styleId, c)
    .map((s) => c.malts.find((m) => m.id === s.ingredientId)!)
    .filter((m) => !used(m.id));
  const sameRole = own.filter((m) => m.type === current.type && fine(m.id));
  const similar = c.malts
    .filter(
      (m) =>
        m.type === current.type &&
        !used(m.id) &&
        !sameRole.includes(m) &&
        Math.abs(m.lovibond - current.lovibond) <=
          Math.max(3, current.lovibond * 0.3) &&
        fine(m.id),
    )
    .sort(
      (a, b) =>
        Math.abs(a.lovibond - current.lovibond) -
        Math.abs(b.lovibond - current.lovibond),
    );
  const rest = own.filter((m) => !sameRole.includes(m) && fine(m.id));
  const options = [
    ...sameRole.map((m) => ({ id: m.id, note: "Used in this style" })),
    ...similar
      .slice(0, 4)
      .map((m) => ({ id: m.id, note: `Similar to ${current.name}` })),
    ...rest.map((m) => ({ id: m.id, note: "Used in this style" })),
  ];
  return options.slice(0, limit);
}
