/** Rebuild only the style-coverage templates; existing and user recipes are never overwritten. */
import fs from "node:fs";
import { catalog } from "../src/catalog";
import { predict } from "../src/engine/calculations";
import { recipeSchema } from "../src/validation";
import type { Recipe } from "../src/engine/types";

const malt: Record<string, string> = {
  pale: "m-pale-malt-2-row-us",
  british: "m-simpsons-maris-otter",
  pils: "m-weyermann-pilsner-malt",
  munich: "m-weyermann-light-munich-malt",
  vienna: "m-weyermann-vienna-malt",
  wheat: "m-weyermann-pale-wheat-malt",
  darkwheat: "m-weyermann-dark-wheat-malt",
  rye: "m-weyermann-rye-malt",
  corn: "m-corn-flaked",
  rice: "m-rice-flaked",
  oats: "m-oats-flaked",
  flakedwheat: "m-wheat-flaked",
  barley: "m-barley-flaked",
  c40: "m-briess-2-row-caramel-malt-40l",
  c60: "m-briess-2-row-caramel-malt-60l",
  chocolate: "m-simpsons-chocolate-malt",
  roast: "m-roasted-barley",
  black: "m-weyermann-dehusked-carafa-iii",
  specialb: "m-special-b-malt",
  sugar: "m-candi-sugar-clear",
  smoke: "m-weyermann-smoked-malt",
  biscuit: "m-biscuit-malt",
  brown: "m-gladfield-brown-malt",
  lactose: "m-milk-sugar-lactose",
};
const profiles: Record<string, Record<string, number>> = {
  pale: { pale: 95, c40: 5 },
  barleywine: { pale: 86, munich: 8, c60: 6 },
  brown: { pale: 80, munich: 8, c60: 7, chocolate: 5 },
  stout: { pale: 77, barley: 10, roast: 8, chocolate: 5 },
  americanwheat: { pale: 50, wheat: 45, munich: 5 },
  baltic: { pils: 53.5, munich: 35, c60: 8, chocolate: 3, black: 0.5 },
  blond: { pils: 86, wheat: 4, sugar: 10 },
  darkbelgian: { pils: 70, munich: 12, specialb: 5, sugar: 13 },
  dubbel: { pils: 70, munich: 18, specialb: 5, sugar: 7 },
  golden: { pils: 82, sugar: 18 },
  belgianpale: { pils: 70, munich: 23, c40: 7 },
  tripel: { pils: 82, wheat: 3, sugar: 15 },
  sourwheat: { pils: 50, wheat: 50 },
  garde: { pils: 65, munich: 25, vienna: 8, c40: 2 },
  blonde: { pale: 95, wheat: 5 },
  czech: { pils: 95, munich: 5 },
  porter: { british: 79, brown: 10, c60: 6, chocolate: 5 },
  common: { pale: 84, munich: 7, c60: 9 },
  winter: { british: 80, munich: 10, c60: 8, chocolate: 2 },
  adjunct: { pils: 80, corn: 20 },
  rauch: { smoke: 55, munich: 40, black: 2, c60: 3 },
  cream: { pale: 80, corn: 15, sugar: 5 },
  darklager: { pils: 70, corn: 20, munich: 7, black: 3 },
  bock: { munich: 65, pils: 30, c60: 3, black: 2 },
  export: { pils: 92, munich: 8 },
  dry: { british: 70, barley: 19, roast: 10, black: 1 },
  dunkelweizen: { darkwheat: 50, munich: 30, pils: 18, black: 2 },
  alt: { pils: 64, munich: 28, c60: 7, black: 1 },
  englishbarley: { british: 90, c60: 7, sugar: 3 },
  englishipa: { british: 92, c60: 5, sugar: 3 },
  bitter: { british: 90, c60: 7, wheat: 3 },
  oudbrown: { pils: 67, munich: 22, c60: 8, chocolate: 3 },
  flanders: { pils: 57.5, vienna: 25, munich: 12, specialb: 5, chocolate: 0.5 },
  foreign: { british: 78, c60: 6, roast: 7, chocolate: 4, sugar: 5 },
  fruit: { pale: 60, wheat: 40 },
  lambic: { pils: 65, flakedwheat: 35 },
  irish: { british: 90, c40: 8, roast: 2 },
  kolsch: { pils: 95, wheat: 5 },
  light: { pils: 75, rice: 25 },
  maibock: { pils: 70, munich: 25, vienna: 5 },
  mild: { british: 82, c60: 12, chocolate: 6 },
  dunkel: { munich: 85, pils: 13, black: 2 },
  helles: { pils: 95, munich: 5 },
  northbrown: { british: 85, c60: 8, biscuit: 4, chocolate: 3 },
  fest: { munich: 45, vienna: 35, pils: 20 },
  oldale: { british: 85, c60: 9, sugar: 4, chocolate: 2 },
  smokedporter: { british: 65, smoke: 20, c60: 7, chocolate: 6, black: 2 },
  rye: { rye: 50, munich: 25, pils: 17, c60: 7, black: 1 },
  imperialstout: { british: 79, barley: 8, roast: 5, chocolate: 2, c60: 6 },
  saison: { pils: 80, munich: 5, wheat: 10, sugar: 5 },
  schwarz: { pils: 55, munich: 40, black: 5 },
  scottish: { british: 90, c60: 8, roast: 2 },
  sweetbrown: { british: 80, c60: 15, chocolate: 5 },
  specialty: { pale: 75, rye: 20, c60: 5 },
  spice: { pils: 70, wheat: 20, munich: 10 },
  scotch: { british: 85, munich: 7, c60: 6, roast: 2 },
  vienna: { vienna: 85, pils: 13, black: 2 },
  weizenbock: { darkwheat: 50, wheat: 5, munich: 30, pils: 13, black: 2 },
  wit: { pils: 55, flakedwheat: 40, oats: 5 },
  wood: { british: 85, c60: 8, munich: 5, chocolate: 2 },
};
// Explicit style plans: profile, target ABV/IBU, catalog yeast code, fermentation and mash °C.
const rows = `
american-barleywine|barleywine|10|85|WLP001|19|66|A strong malt center with a deliberately assertive Cascade finish. Age until the alcohol edge settles.
american-brown-ale|brown|5.5|32|WLP001|19|67|Chocolate malt supplies a cocoa edge; Cascade keeps the finish lively without turning it into an IPA.
american-stout|stout|6|50|WLP001|19|67|Roasted barley and chocolate malt build a dark center beneath a firm hop finish.
american-wheat-or-rye-beer|americanwheat|5|22|WY1010|19|65|A clean wheat beer rather than a banana-forward German wheat; keep fermentation steady.
baltic-porter|baltic|8|30|WLP833|11|67|Dark lager with restrained roast and a substantial Munich foundation. Lager for 6–10 weeks after stable final gravity.
belgian-blond-ale|blond|6.5|23|WLP530|20|64|Pilsner malt and a little sugar leave space for fermentation fruit and spice. Let temperature rise to 23°C near completion.
belgian-dark-strong-ale|darkbelgian|9.5|26|WLP540|21|64|Special B gives a dried-fruit direction without relying on a large caramel fraction. Feed the sugar after vigorous fermentation starts.
belgian-dubbel|dubbel|7|22|WLP530|21|65|Munich and Special B suggest toast and dark fruit. Let the yeast finish before cooling; age several weeks.
belgian-golden-strong-ale|golden|8.5|29|WLP570|20|63|A pale, highly fermentable grist makes room for yeast character. Raise gradually toward 24°C and confirm terminal gravity.
belgian-pale-ale|belgianpale|5.2|25|WLP515|20|66|Munich provides a modest biscuit-like center while the hop schedule stays restrained.
belgian-specialty-ale|belgianpale|7|30|WLP550|21|65|An original stronger Belgian pale with a late Saaz lift. This broad specialty category has no single required strength or color.
belgian-tripel|tripel|8.5|31|WLP530|20|64|Sugar lightens the finish of a strong pale wort. Increase to 23°C late in fermentation and allow full attenuation.
berliner-weisse|sourwheat|3.1|5|WLP630|20|64|Use the mixed culture according to its supplier protocol; allow souring and fermentation to finish. Acidity and mixed-culture attenuation are outside the model.
bi-re-de-garde|garde|7|23|WY3725|19|65|A malt-forward farmhouse template with restrained hopping. Condition cool for 4–6 weeks after fermentation.
blonde-ale|blonde|4.8|21|WLP001|18|66|A simple pale grist and restrained Cascade additions give an approachable starting beer.
bohemian-pilsener|czech|5|40|WLP800|11|67|Saaz carries the hop character. Use a healthy lager pitch, a cleanup rest, then 4–6 weeks of cold conditioning.
brown-porter|porter|4.8|26|WLP002|19|67|Brown malt and a small chocolate portion build toast and cocoa rather than intense burnt roast.
california-common-beer|common|5|38|WLP810|17|66|Northern Brewer gives a woody direction over a lightly caramelized grist. Ferment warm for this lager strain, then condition cool.
christmas-winter-specialty-spiced-beer|winter|7|26|WLP002|19|67|For 20 L, add 1 g cinnamon and 0.3 g freshly crushed allspice in the final 5 boil minutes. Taste before adding more; spices are instructions only and not flavor-modeled.
classic-american-pilsner|adjunct|5.3|32|WLP840|11|65|Flaked corn is pregelatinized; mash it with the pilsner malt. A bittering charge plus late noble hops keeps the adjunct lager assertive.
classic-rauchbier|rauch|5.5|25|WLP830|11|67|Beechwood-smoked malt is the central ingredient. Ferment cleanly and lager 4–6 weeks so the smoke settles into the malt.
cream-ale|cream|4.8|18|WLP080|18|65|Flaked corn and a small sugar fraction lighten the finish. Condition cold after fermentation for a crisper presentation.
dark-american-lager|darklager|5|18|WLP940|12|66|Corn lightens the grist while a little dehusked dark malt contributes color. Keep roast subdued; lager after cleanup.
doppelbock|bock|8|23|WLP833|11|67|A large Munich fraction builds a rich lager. Pitch generously and give it 8–12 weeks of cool maturation.
dortmunder-export|export|5.4|26|WLP830|11|66|A slightly stronger pale lager with a small Munich contribution and balanced noble hopping. Lager 4–6 weeks.
dry-stout|dry|4.2|35|WLP004|19|65|Flaked barley gives texture while roasted barley carries the dark finish. This template assumes normal dissolved CO₂, not nitrogen service.
dunkelweizen|dunkelweizen|5.2|14|WLP300|18|66|Dark wheat and Munich support banana/clove fermentation character. Add rice hulls as needed for lautering; hulls add no modeled extract.
d-sseldorf-altbier|alt|4.8|38|WLP036|17|66|Munich and restrained dark malt support a dry, firmly bitter ale. Condition cold for 3–4 weeks after fermentation.
eisbock|bock|7|25|WLP833|11|66|Base beer only: brew and fully ferment this bock, then cold mature. For a 9% finishing target from 7% base, retain roughly 15.6 L from 20 L during controlled freeze concentration, measuring actual strength and losses. The engine does not model concentration, final ABV, or final color.
english-barleywine|englishbarley|9.5|50|WLP007|19|66|A large Maris Otter grist with a small caramel portion favors malt depth. Allow several months of maturation after stable fermentation.
english-ipa|englishipa|6|50|WLP007|19|65|A mostly pale British grist lets earthy and floral English hops remain distinct. Dry hop after primary fermentation.
extra-special-strong-bitter-english-pale-ale|bitter|5.5|38|WLP002|19|66|A fuller-strength bitter with a measured caramel contribution. Keep carbonation low and evaluate fresh.
flanders-brown-ale-oud-bruin|oudbrown|6|23|WY3763|20|67|Use the mixed culture per its manufacturer guidance and age 6–18 months as needed. Package only after repeated stable gravity readings; acidity and long-term mixed-culture attenuation are not modeled.
flanders-red-ale|flanders|6|18|WY3763|20|67|Ferment with the mixed culture and mature for 9–18 months, tasting periodically. Optional oak: start with 10 g medium-toast cubes per 20 L after primary and taste monthly. Acidification, oak and long-term attenuation are outside the engine.
foreign-extra-stout|foreign|7|55|WLP004|20|66|A stronger roast-led stout with sugar to keep the finish from becoming heavy. Condition several weeks before judging balance.
fruit-beer|fruit|5|18|WLP001|19|65|After primary fermentation, add 2 kg aseptic raspberry purée per 20 L in a sanitized secondary vessel. Let fruit sugars ferment fully and recheck gravity. Fruit mass, sugar, volume, color and acidity are not included in card predictions.
fruit-lambic|lambic|5.5|0|WY3278|20|66|Ferment the wheat base with the mixed culture and mature 9–18 months. Add 3 kg aseptic sour cherry purée per 20 L once the base is mature; allow renewed fermentation to finish. Fruit, acid and extended culture effects are not modeled.
gueuze|lambic|5.5|0|WY3278|20|66|This is a base-wort template, not a finished blended gueuze. Brew separate batches for maturation; trial blend mature 1-, 2- and 3-year beers at 50/30/20 by volume, then adjust by tasting. Confirm stability and use a mixed-culture packaging protocol; the engine cannot predict aged blend FG or carbonation.
irish-red-ale|irish|4.8|23|WLP004|19|67|A very small roasted-barley portion gives a dry edge and red-brown color without a stout-like roast center.
k-lsch|kolsch|4.8|23|WLP029|17|65|Keep the grist pale and fermentation restrained; after cleanup, condition cold for 3–4 weeks.
lite-american-lager|light|3.8|10|WLP840|11|63|Rice lightens a low-strength pale lager. A long low-temperature mash promotes fermentability; no commercial calorie equivalence is claimed.
maibock-helles-bock|maibock|6.8|28|WLP833|11|66|A strong pale lager with Munich depth and enough hop bitterness for balance. Lager 6–8 weeks after cleanup.
mild|mild|3.5|17|WLP002|19|68|A modest-strength dark ale with chocolate and caramel accents. Avoid an unnecessarily bitter or dry finish.
munich-dunkel|dunkel|5|23|WLP833|11|67|Munich malt provides the main bread-crust direction. Dehusked dark malt supplies restrained color; lager 4–6 weeks.
munich-helles|helles|5|19|WLP860|10|66|A simple pale malt-focused lager with a small Munich accent. Use restrained hopping and adequate cold conditioning.
northern-english-brown-ale|northbrown|4.8|26|WLP002|19|67|Biscuit and chocolate malts provide a toasted-nut direction over a mostly pale grist.
northern-german-altbier|alt|4.8|30|WY1007|17|66|A cleaner, less aggressively bitter alt template than the Düsseldorf entry. Cold condition after fermentation.
oktoberfest-m-rzen|fest|5.8|23|WLP820|12|67|Vienna and Munich give the amber lager its center. Follow a cleanup rest with 6–8 weeks of cold conditioning.
old-ale|oldale|7|38|WLP007|19|67|A strong British ale with caramel depth. Mature 2–4 months; this version does not intentionally add Brett or oxidative character.
other-smoked-beer|smokedporter|6|32|WLP001|19|67|A smoked porter with a deliberately moderate smoked-malt fraction. This is a different base style from the classic rauchbier entry.
premium-american-lager|adjunct|5.1|20|WLP840|11|65|A pale corn-adjunct lager with a little more strength and hop presence than the standard lager entry. Lager 4–6 weeks.
roggenbier-german-rye-beer|rye|5.2|20|WLP300|18|66|Rye provides a substantial grain fraction while wheat yeast supplies fermentation spice. Use rice hulls and a beta-glucan rest if the mash becomes difficult; the editor represents only the main rest.
russian-imperial-stout|imperialstout|10|75|WLP007|19|67|A strong roast-and-cocoa-led stout. Use an adequate pitch, oxygenate before fermentation and age several months after completion.
saison|saison|6.5|27|WY3711|23|63|A lean grist and fermentable mash let the yeast define the beer. Raise toward 26°C if permitted by the culture supplier and verify stable FG.
schwarzbier-black-beer|schwarz|5|26|WLP830|11|66|Dehusked dark malt gives color and a restrained roast edge over a clean lager base. Lager 4–6 weeks.
scottish-export-80|scottish|4.5|21|WLP028|18|68|A malt-led Scottish ale with just enough hop bitterness to balance. No peat malt is assumed.
scottish-heavy-70|scottish|3.6|16|WLP028|18|68|A lower-strength malt-led Scottish template. Retain some body through the mash and moderate carbonation.
scottish-light-60|scottish|3|13|WLP028|18|68|A small Scottish ale with restrained bitterness and a modest dark-grain accent. Serve with low carbonation.
southern-english-brown|sweetbrown|3.5|16|WLP002|19|69|A low-strength caramel-forward brown ale. Keep the chocolate portion soft and the hopping restrained.
specialty-beer|specialty|6|38|WLP001|19|66|An original rye pale ale for the open specialty category: rye changes the grain character while Cascade keeps the hop direction familiar.
spice-herb-or-vegetable-beer|spice|5.5|21|WLP550|21|65|For 20 L, add 10 g peeled fresh ginger in the final 5 boil minutes. Taste the fermented beer before adding more. The spice is a process instruction and is not represented in the ingredient-based flavor calculation.
standard-american-lager|adjunct|4.7|12|WLP840|11|65|A restrained corn-adjunct lager with a clean finish. Cold condition 4–6 weeks after fermentation and cleanup.
standard-ordinary-bitter|bitter|3.7|28|WLP002|19|66|A small British pale ale with enough English-hop bitterness to keep the caramel fraction balanced. Serve fresh at low carbonation.
straight-unblended-lambic|lambic|5.5|0|WY3278|20|66|A simplified single-infusion wheat base for a cultured lambic-inspired beer, not spontaneous traditional lambic. Follow the mixed-culture supplier protocol and mature 12–24 months; gravity and acidity may continue changing long after primary.
strong-scotch-ale|scotch|8|25|WLP028|18|68|A strong pale-malt foundation with caramel depth. No peat malt is used; mature for 2–4 months.
traditional-bock|bock|6.5|24|WLP833|11|67|A dark, Munich-led lager that relies on malt richness rather than heavy roast. Lager 6–8 weeks.
vienna-lager|vienna|5|24|WLP940|12|66|Vienna malt leads with a restrained dark-malt color adjustment. Condition cold after a complete fermentation.
weizenbock|weizenbock|7.5|22|WLP300|18|66|A strong dark wheat beer with Munich richness. Add rice hulls for easier lautering and condition after fermentation.
witbier|wit|5|15|WLP400|20|65|For 20 L, add 10 g crushed coriander and 15 g dried bitter-orange peel for the final 5 boil minutes. Spices are process instructions, not modeled flavor contributions; use rice hulls for the flaked-wheat mash.
wood-aged-beer|wood|8|35|WLP007|19|67|Brew the strong base ale first. After primary, add 20 g food-grade medium-toast oak cubes per 20 L, taste weekly after week two, and remove when balanced. Wood extraction, spirit carryover and aging losses are not modeled.
`
  .trim()
  .split("\n")
  .map((line) => {
    const [styleId, profile, abv, ibu, code, temp, mash, notes] =
      line.split("|");
    return {
      styleId,
      profile,
      abv: +abv,
      ibu: +ibu,
      code,
      temp: +temp,
      mash: +mash,
      notes,
    };
  });
const references: Record<
  string,
  { brewery: string; beer: string; code: string }
> = JSON.parse(
  fs.readFileSync(
    new URL("../data/style-recipe-references.json", import.meta.url),
    "utf8",
  ),
);
let recipes: Recipe[] = JSON.parse(
  fs.readFileSync(new URL("../data/recipes.json", import.meta.url), "utf8"),
).filter((r: Recipe) => !r.id.startsWith("style-"));
const special = new Set([
  "eisbock",
  "berliner-weisse",
  "flanders-brown-ale-oud-bruin",
  "flanders-red-ale",
  "fruit-beer",
  "fruit-lambic",
  "gueuze",
  "straight-unblended-lambic",
  "wood-aged-beer",
  "christmas-winter-specialty-spiced-beer",
  "spice-herb-or-vegetable-beer",
  "witbier",
]);
for (const plan of rows) {
  const style = catalog.styles.find((s) => s.id === plan.styleId)!;
  if (!style) throw Error("Missing style " + plan.styleId);
  const yeast = catalog.yeasts.find(
    (y) =>
      y.code.toUpperCase() === plan.code ||
      y.code.toUpperCase() === plan.code + "-PC",
  )!;
  if (!yeast) throw Error("Missing yeast " + plan.code);
  const ref = references[plan.styleId];
  const british =
    /english|bitter|porter|scottish|scotch|old-ale|mild|irish|foreign/.test(
      plan.styleId,
    );
  const american =
    /american-(barleywine|brown|stout|wheat)|blonde|specialty-beer/.test(
      plan.styleId,
    );
  const hop =
    plan.styleId === "california-common-beer"
      ? "h-northern-brewer-us"
      : british
        ? "h-east-kent-goldings"
        : american
          ? "h-cascade"
          : plan.styleId === "bohemian-pilsener"
            ? "h-saaz-cz"
            : "h-hallertau-mittelfr-h";
  const lager = plan.temp <= 12;
  const r: Recipe = {
    id: "style-" + plan.styleId,
    name: ref
      ? `${ref.brewery} ${ref.beer} — inspired`
      : `${style.name} · house starter`,
    styleId: style.id,
    description: `${ref ? `An independent ${style.name} interpretation inspired by ${ref.brewery} ${ref.beer}, a historical commercial example.` : `An original ${style.name} starting recipe.`} ${special.has(style.id) ? "Special-process instructions are in the brewing notes; numbers describe the base beer." : "Flavor intent is an estimate, not a measured match to a commercial beer."}`,
    tags: [
      style.name,
      "style coverage",
      ...(ref ? ["brewery inspired"] : ["original starter"]),
      ...(special.has(style.id) ? ["special process"] : []),
    ],
    origin: {
      kind: ref ? "clone-inspired" : "original-starter",
      ...(ref ? { brewery: ref.brewery, beer: ref.beer } : {}),
      title: ref
        ? `BJCP 2008 · ${ref.code} commercial example reference`
        : "BrewMaster original style starter",
      author: "BrewMaster · independent house formulation",
      url: ref
        ? `https://legacy.bjcp.org/2008styles/style${ref.code.match(/^\d+/)![0].padStart(2, "0")}.php`
        : style.source.url,
      accessed: "2026-10-26",
      adaptations: ref
        ? "The linked historical style reference names the commercial beer; it is not a homebrew formula. All ingredients, proportions, amounts, yeast mappings and process choices are independently authored house assumptions. No brewery endorsement, current product specification or sensory match is claimed."
        : "Original house recipe using the catalog’s legacy numeric style ranges as a starting reference; no brewery formula or endorsement is claimed.",
    },
    batchL: 20,
    efficiency: 72,
    mashC: plan.mash,
    mashMinutes: 60,
    fermentC: Math.max(yeast.tempC[0], Math.min(yeast.tempC[1], plan.temp)),
    boilMinutes: 60,
    boilOffLPerHour: 3,
    lossL: 1,
    whirlpoolFactor: 0.15,
    carbonation: lager ? 2.5 : british ? 1.9 : 2.5,
    pitchMultiplier: 1,
    yeastId: yeast.id,
    grains: Object.entries(profiles[plan.profile]).map(([key, pct]) => ({
      ingredientId: malt[key],
      kg: (5 * pct) / 100,
    })),
    hops: [
      { ingredientId: hop, grams: 25, use: "boil", minutes: 60 },
      { ingredientId: hop, grams: 10, use: "boil", minutes: 10 },
    ],
    notes: `${plan.notes}\n\n20 L post-boil kettle volume; 1 L assumed transfer loss; 72% efficiency. Ingredient ratios are editorial choices, total grist is numerically scaled to a house ${plan.abv}% base-beer ABV target, and kettle hops to ${plan.ibu} IBU with catalog alpha acids and the app’s brewing equations. These targets are not commercial beer specifications. Mash is single-infusion; verify conversion and adjust water for your equipment. The catalog yeast is a functional house choice, not a claim about the brewery’s culture. Confirm final gravity before packaging. ${special.has(style.id) ? "Special-process additions and secondary transformations are written in these notes, not included in engine ABV, IBU, color, volume or flavor estimates." : ""}`,
  };
  for (const g of r.grains)
    if (!catalog.malts.some((m) => m.id === g.ingredientId))
      throw Error("Missing malt " + g.ingredientId);
  // Monotonic bisection uses the same deterministic engine displayed by the app.
  const base = structuredClone(r.grains);
  let lo = 0.1,
    hi = 4;
  for (let k = 0; k < 45; k++) {
    let f = (lo + hi) / 2;
    r.grains = base.map((g) => ({ ...g, kg: g.kg * f }));
    if (predict(r, catalog).abv < plan.abv) lo = f;
    else hi = f;
  }
  r.grains = r.grains.map((g) => ({ ...g, kg: +g.kg.toFixed(4) }));
  const ibu = predict(r, catalog).ibu;
  r.hops = r.hops.map((h) => ({
    ...h,
    grams: +((h.grams * plan.ibu) / ibu).toFixed(2),
  }));
  if (plan.profile === "lambic") {
    r.hops = [
      {
        ingredientId: "h-hallertau-mittelfr-h",
        grams: 20,
        use: "boil",
        minutes: 60,
        alpha: 0,
      },
    ];
    r.notes +=
      " Use 20 g well-aged noble hops per 20 L; alpha is set to zero as a low-bitterness model assumption, not a lot analysis. Actual residual bitterness depends on the aged hops used.";
  }
  if (plan.styleId === "english-ipa")
    r.hops.push({
      ingredientId: hop,
      grams: 30,
      use: "dry hop",
      minutes: 4320,
    });
  recipes.push(recipeSchema.parse(r));
}
fs.writeFileSync(
  new URL("../data/recipes.json", import.meta.url),
  JSON.stringify(recipes, null, 2) + "\n",
);
console.log(
  `Wrote ${recipes.length} recipes (${rows.length} style additions).`,
);

// Keep the recommendation engine's editorial style priors in sync with the book.
const ingredientProfiles: Record<
  string,
  {
    referenceRecipe: string;
    maltIds: string[];
    hopIds: string[];
    yeastIds: string[];
    grist: { ingredientId: string; percent: number }[];
  }
> = {};
for (const recipe of recipes) {
  const total = recipe.grains.reduce((sum, grain) => sum + grain.kg, 0);
  const profile = (ingredientProfiles[recipe.styleId] ??= {
    referenceRecipe: recipe.name,
    maltIds: [],
    hopIds: [],
    yeastIds: [],
    grist: recipe.grains.map((g) => ({
      ingredientId: g.ingredientId,
      percent: +((g.kg / total) * 100).toFixed(1),
    })),
  });
  profile.maltIds = [
    ...new Set([
      ...profile.maltIds,
      ...recipe.grains.map((g) => g.ingredientId),
    ]),
  ];
  profile.hopIds = [
    ...new Set([...profile.hopIds, ...recipe.hops.map((h) => h.ingredientId)]),
  ];
  profile.yeastIds = [...new Set([...profile.yeastIds, recipe.yeastId])];
}
fs.writeFileSync(
  new URL("../data/style-ingredient-profiles.json", import.meta.url),
  JSON.stringify(ingredientProfiles, null, 2) + "\n",
);
