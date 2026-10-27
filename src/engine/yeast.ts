import families from "../../data/yeast-families.json";
import guides from "../../data/yeast-guides.json";
import type { Range, Yeast } from "./types";
export { families as yeastFamilies };
export function yeastGroups(y: Yeast) {
  const text = `${y.name} ${y.type} ${y.code}`.toLowerCase();
  const special = families.find(
    (f) =>
      ["baking", "wine"].includes(f.id) &&
      (f.types?.includes(y.type.toLowerCase()) ||
        f.terms.some((t) => text.includes(t))),
  );
  if (special) return [special];
  const found = families.filter(
    (f) =>
      !["other", "wine", "baking"].includes(f.id) &&
      (f.types?.includes(y.type.toLowerCase()) ||
        f.terms.some((t) => text.includes(t))),
  );
  return found.length ? found : [families.find((f) => f.id === "other")!];
}
export function hasBrewingSpecs(
  y: Yeast,
): y is Yeast & { attenuation: Range; tempC: Range } {
  return !!y.attenuation && !!y.tempC;
}
/** An explicit house assumption, never stored as a reference ingredient spec. */
export const UNKNOWN_YEAST_ATTENUATION = 75;
export function yeastModelAttenuation(y: Yeast) {
  return y.attenuation
    ? (y.attenuation[0] + y.attenuation[1]) / 2
    : UNKNOWN_YEAST_ATTENUATION;
}
export function yeastGuide(y: Yeast) {
  return (
    guides as Record<string, { flavor: string; use: string; context: string }>
  )[y.id];
}
