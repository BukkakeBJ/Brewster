import nonBeerStyles from "../../data/non-beer-styles.json";
import type { Catalog, Range, Style, Target } from "./types";
export type StyleTargets = Pick<Target, "abv" | "ibu" | "srm" | "og" | "fg">;
export interface StyleMatch {
  style: Style;
  outsideDistance: number;
  midpointDistance: number;
  withinRanges: boolean;
}
const scales = { abv: 0.5, ibu: 10, srm: 3, og: 0.005, fg: 0.003 };
/** Broad specialty placeholders and non-beer entries cannot define a numeric style match. */
export function hasComparableStyleRanges(style: Style) {
  if (nonBeerStyles.includes(style.id)) return false;
  return (
    style.abv[1] > 0 &&
    style.abv[1] <= 20 &&
    style.ibu[1] <= 150 &&
    style.srm[1] <= 80 &&
    style.abv[1] - style.abv[0] <= 8 &&
    style.ibu[1] - style.ibu[0] <= 100 &&
    style.srm[1] - style.srm[0] <= 40 &&
    (["abv", "ibu", "srm", "og", "fg"] as const).every(
      (k) => style[k].every(Number.isFinite) && style[k][0] <= style[k][1],
    )
  );
}
export function closestStyles(
  target: StyleTargets,
  catalog: Pick<Catalog, "styles">,
): StyleMatch[] {
  if (
    ![target.abv, target.ibu].every(Number.isFinite) ||
    (target.srm !== undefined && !Number.isFinite(target.srm))
  )
    return [];
  const axes: (keyof typeof scales)[] = [
    "abv",
    "ibu",
    ...(target.srm !== undefined ? ["srm" as const] : []),
    ...(target.og ? ["og" as const] : []),
    ...(target.fg ? ["fg" as const] : []),
  ];
  if (
    axes.some(
      (k) =>
        Array.isArray(target[k]) &&
        (!(target[k] as Range).every(Number.isFinite) ||
          (target[k] as Range)[0] > (target[k] as Range)[1]),
    )
  )
    return [];
  return catalog.styles
    .filter(hasComparableStyleRanges)
    .map((style) => {
      let outsideDistance = 0,
        midpointDistance = 0;
      for (const k of axes) {
        const v = target[k]!,
          range: Range = typeof v === "number" ? [v, v] : v;
        const gap = Math.max(0, style[k][0] - range[1], range[0] - style[k][1]);
        outsideDistance += (gap / scales[k]) ** 2;
        midpointDistance +=
          ((range[0] + range[1] - style[k][0] - style[k][1]) / 2 / scales[k]) **
          2;
      }
      return {
        style,
        outsideDistance,
        midpointDistance,
        withinRanges: outsideDistance === 0,
      };
    })
    .sort(
      (a, b) =>
        a.outsideDistance - b.outsideDistance ||
        a.midpointDistance - b.midpointDistance ||
        a.style.id.localeCompare(b.style.id),
    );
}
export function matchStyleToTargets<
  T extends StyleTargets & { styleId: string },
>(target: T, c: Pick<Catalog, "styles">): T {
  const best = closestStyles(target, c)[0];
  return best ? { ...target, styleId: best.style.id } : { ...target };
}

/** A manual style change sets a reference, never replaces the brewer's brief. */
export function selectDesignStyle<T extends { styleId: string }>(
  target: T,
  styleId: string,
): T {
  return { ...target, styleId };
}
