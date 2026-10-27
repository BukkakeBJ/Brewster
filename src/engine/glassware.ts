export type Glass =
  "pint" | "pilsner" | "weizen" | "tulip" | "snifter" | "mug" | "wine";

/** Traditional serving glass for a style id; anything unrecognised gets a pint. */
export function glassFor(styleId: string): Glass {
  const id = styleId.toLowerCase();
  if (/cider|perry|mead|melomel|metheglin|pyment|cyser|applewine/.test(id))
    return "wine";
  if (/weiz|weiss|wit|wheat|rogg/.test(id)) return "weizen";
  if (
    /barleywine|imperial-stout|old-ale|eisbock|strong-scotch|wood-aged|baltic/.test(
      id,
    )
  )
    return "snifter";
  if (/bock|m-rzen|oktoberfest|dunkel|rauch/.test(id)) return "mug";
  if (
    /belgian|tripel|dubbel|saison|bi-re|flanders|lambic|gueuze|imperial-ipa|fruit-beer|spice|christmas|specialty-beer|braggot/.test(
      id,
    )
  )
    return "tulip";
  if (
    /pils|lager|helles|dortmund|vienna|k-lsch|california|cream|schwarz/.test(id)
  )
    return "pilsner";
  return "pint";
}

/** Everyday name for a predicted SRM color. */
export function colorName(srm: number) {
  return srm < 3.5
    ? "Pale straw"
    : srm < 6
      ? "Gold"
      : srm < 10
        ? "Amber"
        : srm < 15
          ? "Copper"
          : srm < 22
            ? "Brown"
            : srm < 30
              ? "Dark brown"
              : "Black";
}
