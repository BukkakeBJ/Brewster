import type { Catalog, HopAddition, Recipe, Style, Target } from "./types";
import { midpoint, predict } from "./calculations";
import { recipeAtFixedWater } from "./builder";
import { flavorPredict } from "./flavor";
import { matchTargetAbv, matchTargetIbu } from "./guidance";
import {
  ingredientMatches,
  styleFlavorBrief,
  styleIngredientProfile,
} from "./recommendations";
import { starterRecipes } from "./recipeBook";
import { closestStyles } from "./styleMatch";
import { waterSettings } from "./waterPlan";

/** Only the choices that shape a recipe; water and equipment changes never trigger a rebuild. */
export function goalsSignature(t: Target) {
  return JSON.stringify({
    styleId: t.styleId,
    abv: t.abv,
    ibu: t.ibu,
    srm: t.srm ?? null,
    flavors: Object.entries(t.flavors)
      .filter(([, value]) => value > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
    must: [...t.must].sort(),
    avoid: [...t.avoid].sort(),
    onHand: [...t.onHand].sort(),
    exclude: [...t.exclude].sort(),
    yeastForm: t.yeastForm,
    budget: t.budget,
  });
}

/** The Recipe Book recipe a style is built from: the chosen style, or the closest beer when freeform. */
export function styleTemplate(t: Target, c: Catalog): Recipe | undefined {
  const forStyle = (id: string) => {
    const recipes = starterRecipes.filter((r) => r.styleId === id);
    const reference = styleIngredientProfile(id)?.referenceRecipe;
    return recipes.find((r) => r.name === reference) ?? recipes[0];
  };
  if (t.styleId) return forStyle(t.styleId);
  for (const match of closestStyles(t, c)) {
    const recipe = forStyle(match.style.id);
    if (recipe) return recipe;
  }
  return undefined;
}

/**
 * Sensible targets for a style. Open-ended styles such as Fruit Beer list near-limitless ranges
 * (0–100% ABV), so those numbers come from the style's Recipe Book recipe, or stay as they are
 * when it has none, rather than from a meaningless midpoint.
 */
export function styleGoals(
  style: Style,
  c: Catalog,
  current: Pick<Target, "abv" | "ibu"> & { srm: number },
) {
  const template = starterRecipes.find((r) => r.styleId === style.id);
  const p = template && predict(template, c);
  const typical = (
    range: [number, number],
    width: number,
    recipe: number | undefined,
    fallback: number,
  ) => (range[1] - range[0] > width ? (recipe ?? fallback) : midpoint(range));
  return {
    abv: +typical(style.abv, 6, p?.abv, current.abv).toFixed(1),
    ibu: Math.round(typical(style.ibu, 50, p?.ibu, current.ibu)),
    srm: +typical(style.srm, 25, p?.srm, current.srm).toFixed(1),
  };
}

/** Find the setting from 0 to 1 that reaches a color, for a dial whose color rises with it. */
function dialToColor(at: (x: number) => Recipe, c: Catalog, goal: number) {
  const srm = (r: Recipe) => predict(r, c).srm;
  const top = at(1);
  if (srm(top) <= goal) return top;
  const bottom = at(0);
  if (srm(bottom) >= goal) return bottom;
  let low = 0,
    high = 1,
    best = top;
  for (let i = 0; i < 14; i++) {
    const middle = (low + high) / 2;
    best = at(middle);
    const value = srm(best);
    if (Math.abs(value - goal) < 0.1) break;
    if (value < goal) low = middle;
    else high = middle;
  }
  return best;
}

/**
 * Choose the malts that reach a color goal, keeping alcohol on target throughout: scale the
 * recipe's own color malts, add caramel or roasted malts if those can't get there, and swap kilned
 * base malts for a paler one if the beer is still too dark.
 */
function fitColor(
  r: Recipe,
  c: Catalog,
  t: Target,
  allowed: (id: string) => boolean,
) {
  const atAbv = matchTargetAbv(r, c, t.abv);
  if (t.srm === undefined) return atAbv;
  const goal = t.srm;
  const near = (x: Recipe) => Math.abs(predict(x, c).srm - goal) < 0.25;
  if (near(atAbv)) return atAbv;
  const malt = (id: string) => c.malts.find((m) => m.id === id)!;
  const brew = (grains: Recipe["grains"]) =>
    matchTargetAbv(
      { ...r, grains: grains.filter((g) => g.kg >= 0.003) },
      c,
      t.abv,
    );

  const coloring = (id: string) => malt(id).lovibond > 10;
  const color = r.grains.filter((g) => coloring(g.ingredientId));
  const pale = r.grains.filter((g) => !coloring(g.ingredientId));
  const paleKg = pale.reduce((sum, g) => sum + g.kg, 0);
  const colorKg = color.reduce((sum, g) => sum + g.kg, 0);
  // No malt grows past the share brewers use it at, or past three times the pattern's amount.
  const most = Math.max(
    1,
    Math.min(
      3,
      ...color.map((g) => {
        const share = malt(g.ingredientId).maxPercent / 100;
        const room = g.kg - share * colorKg;
        return room > 0 ? (share * paleKg) / room : Infinity;
      }),
    ),
  );
  const lowest = pale.length ? 0 : 0.2 / most;
  let best = color.length
    ? dialToColor(
        (x) => {
          const factor = most * (lowest + x * (1 - lowest));
          return brew(
            r.grains.map((g) =>
              coloring(g.ingredientId) ? { ...g, kg: g.kg * factor } : g,
            ),
          );
        },
        c,
        goal,
      )
    : atAbv;
  if (near(best)) return best;

  if (predict(best, c).srm < goal) {
    // The style's own darker malts first, then a caramel malt, then roasted malts for dark goals.
    const closest = (type: string, lovibond: number) =>
      c.malts
        .filter((m) => m.type === type && allowed(m.id))
        .sort(
          (a, b) =>
            Math.abs(a.lovibond - lovibond) - Math.abs(b.lovibond - lovibond),
        )[0]?.id;
    const own = (styleIngredientProfile(t.styleId)?.maltIds ?? [])
      .filter((id) => allowed(id) && malt(id)?.lovibond >= 20)
      .sort((a, b) => malt(a).lovibond - malt(b).lovibond);
    const boosters = [
      ...own,
      ...(goal <= 20 ? [closest("crystal-caramel", 60)] : []),
      closest("roasted", 350),
      closest("roasted", 500),
    ].filter((id): id is string => !!id);
    for (const id of new Set(boosters)) {
      if (best.grains.some((g) => g.ingredientId === id)) continue;
      const others = best.grains;
      const total = others.reduce((sum, g) => sum + g.kg, 0);
      const limit = Math.min(malt(id).maxPercent, 10) / 100;
      best = dialToColor(
        (x) => {
          const share = x * limit;
          return brew([
            ...others,
            { ingredientId: id, kg: (total * share) / (1 - share) },
          ]);
        },
        c,
        goal,
      );
      if (near(best) || predict(best, c).srm > goal) break;
    }
    return best;
  }

  // Too dark with the color malts gone, so the kilned base malts give way to a paler one.
  const palest = c.malts
    .filter((m) => m.type === "base" && m.ppg > 0 && allowed(m.id))
    .filter((m) => m.maxPercent === 100)
    .sort((a, b) => a.lovibond - b.lovibond)[0];
  if (!palest) return best;
  const grains = best.grains;
  const swappable = (id: string) =>
    id !== palest.id &&
    malt(id).type !== "adjunct" &&
    malt(id).lovibond > palest.lovibond + 1;
  return dialToColor(
    (x) => {
      const moved = grains
        .filter((g) => swappable(g.ingredientId))
        .reduce(
          (sum, g) =>
            sum + (g.kg * (1 - x) * malt(g.ingredientId).ppg) / palest.ppg,
          0,
        );
      const kept = grains.map((g) =>
        swappable(g.ingredientId) ? { ...g, kg: g.kg * x } : g,
      );
      const has = kept.some((g) => g.ingredientId === palest.id);
      return brew(
        has
          ? kept.map((g) =>
              g.ingredientId === palest.id ? { ...g, kg: g.kg + moved } : g,
            )
          : [{ ingredientId: palest.id, kg: moved }, ...kept],
      );
    },
    c,
    goal,
  );
}

/** Hit the IBU goal with boil hops; if it is too low for any boil hops, drop them. */
function fitBitterness(r: Recipe, c: Catalog, t: Target) {
  try {
    return matchTargetIbu(r, c, t.ibu);
  } catch {
    return { ...r, hops: r.hops.filter((h) => h.use !== "boil") };
  }
}

/**
 * Turn beer goals into a complete recipe: the style's Recipe Book recipe sets the malts, hop
 * schedule, yeast and process, then amounts are fitted to the brewer's water and targets.
 * Returns undefined when no beer recipe applies (cider and mead), leaving ingredients to the brewer.
 */
export function buildFromGoals(
  recipe: Recipe,
  c: Catalog,
  t: Target,
  userWeight = 1,
): Recipe | undefined {
  const template = styleTemplate(t, c);
  if (!template) return undefined;
  const settings = waterSettings(recipe, c);
  const allowed = (id: string) =>
    !t.exclude.includes(id) && (!t.onHand.length || t.onHand.includes(id));
  const matches = ingredientMatches(t, c, userWeight);
  const isBase = (id: string) =>
    c.malts.find((m) => m.id === id)?.type === "base";

  const grains = template.grains
    .filter((g) => allowed(g.ingredientId))
    .map((g) => ({ ...g, kg: (g.kg * recipe.batchL) / template.batchL }));
  if (!grains.some((g) => isBase(g.ingredientId))) {
    const base = matches.malts.find((m) => isBase(m.id));
    if (!base)
      throw new Error(
        "Your ingredient limits leave no base malt, so we kept your current ingredients.",
      );
    grains.unshift({ ingredientId: base.id, kg: recipe.batchL * 0.2 });
  }

  // The style's own culture stands unless it breaks a limit, even if it is too specialist to rank.
  const styleYeast = c.yeasts.find((y) => y.id === template.yeastId);
  const yeastFits =
    !!styleYeast &&
    allowed(styleYeast.id) &&
    (t.yeastForm === "any" || styleYeast.form === t.yeastForm) &&
    (t.budget !== "economy" || styleYeast.form === "dry") &&
    (styleYeast.alcoholTolerance === null ||
      styleYeast.alcoholTolerance >= t.abv);
  const yeastId = yeastFits
    ? template.yeastId
    : (matches.yeasts[0]?.id ?? recipe.yeastId);
  const yeast = c.yeasts.find((y) => y.id === yeastId)!;
  const fermentC =
    yeast.id !== template.yeastId && yeast.tempC
      ? midpoint(yeast.tempC)
      : template.fermentC;

  const malted = fitColor(
    recipeAtFixedWater(
      {
        ...recipe,
        styleId: t.styleId,
        designTargets: t,
        origin: undefined,
        grains,
        yeastId,
        fermentC,
        mashC: template.mashC,
        mashMinutes: template.mashMinutes,
        carbonation: template.carbonation,
        pitchMultiplier: template.pitchMultiplier,
        whirlpoolFactor: template.whirlpoolFactor,
        waterPlan: settings,
      },
      c,
      settings.startingWaterL,
      settings.absorptionLPerKg,
    ),
    c,
    t,
    allowed,
  );

  const topHop = (focus: Target["hopFocus"]) =>
    ingredientMatches({ ...t, hopFocus: focus }, c, userWeight).hops[0]?.id;
  const scheduled: HopAddition[] = template.hops.flatMap((h) => {
    const bittering = h.use === "boil" && h.minutes > 20;
    const ingredientId = allowed(h.ingredientId)
      ? h.ingredientId
      : topHop(bittering ? "bittering" : "aroma");
    if (!ingredientId) return [];
    return [
      {
        ...h,
        ingredientId,
        alpha: ingredientId === h.ingredientId ? h.alpha : undefined,
        grams: (h.grams * malted.batchL) / template.batchL,
        minutes:
          h.use === "boil"
            ? Math.min(h.minutes, malted.boilMinutes)
            : h.minutes,
      },
    ];
  });
  const styleHops = fitBitterness({ ...malted, hops: scheduled }, c, t);

  // The style's hops stand unless a swap of the late hops clearly suits the flavor goals better.
  const hopAxes = c.vocabulary
    .filter((v) => v.parent === "hops" && (t.flavors[v.id] ?? 0) > 0)
    .map((v) => v.id);
  const flavorGap = (r: Recipe) => {
    const scores = flavorPredict(r, c, predict(r, c), userWeight).scores;
    return (
      hopAxes.reduce(
        (sum, id) => sum + ((scores[id] ?? 0) - t.flavors[id]) ** 2,
        0,
      ) + t.avoid.reduce((sum, id) => sum + (scores[id] ?? 0) ** 2, 0)
    );
  };
  const lateHop = topHop("aroma");
  const isLate = (h: HopAddition) => h.use !== "boil" || h.minutes <= 20;
  if (!lateHop || !scheduled.some(isLate) || !(hopAxes.length + t.avoid.length))
    return styleHops;
  const flavorHops = fitBitterness(
    {
      ...malted,
      hops: scheduled.map((h) =>
        isLate(h) ? { ...h, ingredientId: lateHop, alpha: undefined } : h,
      ),
    },
    c,
    t,
  );
  return flavorGap(flavorHops) < flavorGap(styleHops) - 0.5
    ? flavorHops
    : styleHops;
}

/**
 * Move a recipe to another style without touching what the brewer chose: the step they picked at
 * and those before it stay, later steps follow the new style, and the goals move to match the beer.
 */
export function restyleKeeping(
  recipe: Recipe,
  c: Catalog,
  t: Target,
  styleId: string,
  kept: "malt" | "hop" | "yeast",
  userWeight = 1,
): { recipe: Recipe; target: Target } {
  const style = c.styles.find((s) => s.id === styleId);
  const now = predict(recipe, c);
  const goals = style
    ? styleGoals(style, c, { abv: now.abv, ibu: now.ibu, srm: now.srm })
    : undefined;
  const template = starterRecipes.find((r) => r.styleId === styleId);
  const target: Target = {
    ...t,
    styleId,
    abv: +now.abv.toFixed(1),
    ibu: kept === "malt" && goals ? goals.ibu : Math.round(now.ibu),
    srm: t.srm === undefined ? undefined : +now.srm.toFixed(1),
    flavors: template
      ? styleFlavorBrief(
          flavorPredict(template, c, predict(template, c), userWeight).scores,
          c,
        )
      : t.flavors,
  };
  let built: Recipe | undefined;
  if (kept !== "yeast")
    try {
      built = buildFromGoals(recipe, c, target, userWeight);
    } catch {
      built = undefined;
    }
  const yeast = c.yeasts.find((y) => y.id === recipe.yeastId);
  const moved: Recipe = {
    ...recipe,
    styleId,
    designTargets: target,
    origin: undefined,
    ...(built && {
      yeastId: built.yeastId,
      fermentC: built.fermentC,
      carbonation: built.carbonation,
      pitchMultiplier: built.pitchMultiplier,
    }),
    ...(built &&
      kept === "malt" && {
        hops: built.hops,
        mashC: built.mashC,
        mashMinutes: built.mashMinutes,
        whirlpoolFactor: built.whirlpoolFactor,
      }),
    ...(kept === "yeast" &&
      yeast?.tempC && {
        fermentC: Math.min(
          yeast.tempC[1],
          Math.max(yeast.tempC[0], recipe.fermentC),
        ),
      }),
  };
  const fitted =
    built && kept === "malt" ? fitBitterness(moved, c, target) : moved;
  const finalTarget = { ...target, abv: +predict(fitted, c).abv.toFixed(1) };
  return {
    recipe: { ...fitted, designTargets: finalTarget },
    target: finalTarget,
  };
}
