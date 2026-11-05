# BrewMaster design

BrewMaster helps homebrewers design a recipe, predict how it will turn out, and keep their recipes and brew days in one place. The interface is built around one idea: **water comes first**, because the amount of water sets the size of every malt, hop and yeast addition.

## Navigation

Five destinations, the same on every screen size: **Home**, **Build**, **Recipes**, **Brew Log** and **Ingredients**. Desktop shows them in the top bar; phones show them in a bottom tab bar. The US/Metric switch is always at the top right (US by default).

- **Home** explains the four-step flow, offers "Start a new recipe" or "Start from a proven recipe", lets a returning brewer continue their draft, and lists saved recipes.
- **Build** is the six-step recipe builder below.
- **Recipes** (Recipe Book) opens on the brewer's own recipes when they have any, otherwise on the starter collection. Starter recipes open at the Water step so they are resized for the brewer's water.
- **Brew Log** and **Ingredients** keep their existing features.

## Recipe builder

1. **Water** — starting water with quick sizes, a water → kettle → finished beer → bottles flow, and equipment settings tucked under "Equipment & losses".
2. **Goals** — style (choosing one sets its typical ABV, IBU and flavor), sliders for alcohol, bitterness and optional color with the style's range shaded, flavor sliders and hop-character presets. Moving on **builds the recipe from these goals** (below). "Compare 3 recipe options first" runs the solver instead. Ingredient limits and solver weights are under "Ingredient limits & fine-tuning".
3. **Malts**, 4. **Hops**, 5. **Yeast** — filled in from the goals and fully editable. Each shows a plain-language tip when a number is off its goal; Malts and Hops offer one-click "Adjust malts to X% ABV" / "Adjust boil hops to X IBU" (`src/engine/guidance.ts`). Malt suggestions come from the Recipe Book recipes for the chosen style, biggest share of the grain bill first. A flavor estimate and style check sit beside the editor.
6. **Review** — name, style, save/share, the full recipe with edit links, optional extras (additives), notes, brew-day numbers, print and export.

### Building from goals

`buildFromGoals` (`src/engine/goalBuild.ts`) uses the style's Recipe Book recipe as a pattern for malts, hop schedule, yeast and process, then fits the amounts to the brewer's starting water and their ABV, IBU and color goals. Late hops change only when a swap clearly suits the flavor goals better, and excluded or not-on-hand ingredients are replaced. With no style it uses the closest beer style. Cider and mead have no beer pattern, so their ingredients are left alone.

**Color picks the malts.** The Goals page always shows the color slider and, beside the goals, the malts Next will use, updating as they change. `fitColor` scales the pattern's color malts up to their usual share, adds the style's own darker malts, a caramel malt or roasted malts if that isn't enough, and swaps kilned base malts for a paler one if the beer is still too dark, holding the alcohol goal throughout. A very strong beer can't go paler than its palest malt allows.

Edits are never overwritten by accident: the build runs only for a new draft or when the goal choices changed (`goalsSignature`; water and equipment changes don't count), and going backward or opening a recipe doesn't trigger it. A notice on the next pages names the pattern and offers "Restore my previous recipe".

### Changing malts

The malt picker opens with suggestions ahead of the full list (`suggestedMalts` in `src/engine/ingredientFit.ts`): the style's own malts in the same role and similar malts when swapping, and the style's malts or popular choices when adding. Nothing offered would raise the question below.

### Searching by what relates

The ingredient pickers, the Ingredients page and the ingredient limits on Goals search malts, hops and yeast by name and by what relates to them (`searchIngredients` in `src/engine/ingredientSearch.ts`), and the pickers and Ingredients page offer flavor chips (`FlavorChips.tsx`).

- **Flavor:** "caramel" or "coffee" for malts, "banana" or "tart" for yeast, "grapefruit" for hops. Everyday words work too ("nutty", "espresso", "sour", "phenolic", "piney"). "Citrus" also finds grapefruit, lemon and orange hops, and "tropical" also finds mango, passionfruit and pineapple.
- **Role and color for malts:** "base", "adjunct", "pale", "amber", "dark" or "black".
- **Family and form for yeast:** "lager", "belgian", "kveik", "dry" or "liquid".
- **Beer style for malts and yeast:** "stout", "IPA" or "dry stout" find what that style's Recipe Book recipes use, with a "Used in Dry Stout" note when the name doesn't explain the match. Nicknames work ("hefeweizen", "pils"). General style words such as "ale" or "american" don't count, because they'd match nearly everything. Hops don't relate to styles this way: most styles list only Hallertau Mittelfrüh or East Kent Goldings as a placeholder.

Every word or chip has to match. A whole flavor word means that flavor exactly ("pine" isn't "pineapple"), and a partial one matches as you type. Flavor notes come from `data/descriptors.json`; anything without notes can't match a flavor search, and the chips say how many that leaves out.

### Unusual picks

A malt, hop or yeast pick that looks strange for the style opens a pop-up (`IngredientQuestion.tsx`) that says why it may be unusual and offers three answers: keep the style with the ingredient in the recipe, change the style (three close matches that suit the ingredient, or any style), or undo the change. Pressing Esc counts as keeping the style, and an answered ingredient isn't asked about again for that style. It runs when an ingredient is newly picked or a hop moves from a long boil to a late addition (`unusualPick` in `src/engine/ingredientFit.ts`), never for a change of amount. The "When" menu checks right away; the time field checks when the brewer leaves it, since it saves on every keystroke and 60 → 45 passes through 4.

Changing style keeps the step the pick was made at and those before it, and later steps follow the new style: a malt pick keeps the malts, a hop pick keeps malts and hops, and a yeast pick keeps everything. The goals move to match the beer, and a notice offers to restore.

What counts as strange:

- **Malts** (`unusualMalt`): a roasted malt in a style that tops out under 15 SRM, a dark caramel malt (40 °L or more) in one under 8 SRM, or smoke in any style, unless the style's own malts already include that kind; going well past the malt's usual share of the grain bill; or pushing color more than 1 SRM further out of range. Another pale base or similar caramel malt is never strange. A pick moving toward a color goal set outside the style isn't questioned on color.
- **Hops** (`unusualHop`): a late addition of a hop with bold flavors (grapefruit, tropical fruit, pine, resin or dank, and not noble) in a style whose own hops are all restrained, unless the flavor goals ask for that flavor; or, for a newly added hop, pushing bitterness more than 5 IBU further out of range. A long boil addition isn't questioned on flavor, since it only adds bitterness.
- **Yeast** (`unusualYeast`): a yeast from a different family than the style's own (lager, ale, wheat, Belgian, sour, wine or baking); a beer stronger than the strain's alcohol tolerance; or a finish more than 0.004 further outside the style's FG range. Different ale strains in the same family are never strange.

Specialty styles with open-ended ranges, cider, mead and beers with no style are never questioned. Hop and yeast suggestions leave out anything that would raise the question.

From Malts onward a sticky **prediction bar** shows alcohol, bitterness, color, OG, FG and fermenter volume, each compared with the goal or style range. On phones it shows the first three.

## Beer illustrations

Every beer is drawn as an illustrated glass filled with its **predicted color**, so a recipe's look changes as you change malts. Glasses appear on Recipe Book cards, the home screen, the builder sidebar ("Your beer"), the Goals step, suggested recipes and the Review step.

- **Artwork:** seven glasses generated with Canva's image generator in one consistent hand-painted style, then cut out with Canva's background remover: pint, pilsner, wheat (weizen), tulip, snifter, dimpled mug and wine glass. The full-size cutouts live on pages 9–15 of the Canva design [BrewMaster beer glass illustrations](https://canva.link/kh7d4ddemmibnjm).
- **Glass per style:** `src/engine/glassware.ts` maps each style to its traditional glass (for example wheat beers → weizen, Belgian and sour ales → tulip, barleywine and imperial stout → snifter, Märzen and bocks → mug, cider and mead → wine glass, everything else → pint).
- **Color:** each glass was drawn with golden beer. `scripts/beer-art.py` turns the beer into neutral grey shading (`public/beers/<glass>.webp`) and writes a mask of the beer (`<glass>-beer.webp`). `BeerGlass.tsx` lays the recipe's SRM color over the mask with a multiply blend, so highlights and the foam head stay white while the beer goes from pale straw to stout black. Colors come from a common SRM display chart (`beerColor` in `src/engine/calculations.ts`).
- **Regenerating:** export pages 9–15 as transparent PNGs named `pint.png`, `pilsner.png`, `weizen.png`, `tulip.png`, `snifter.png`, `mug.png` and `wine.png`, then run `python3 scripts/beer-art.py --src-dir <folder> --outdir public/beers` (needs Pillow and numpy). `--preview` writes a contact sheet of every glass in six colors.

## Visual system

All styling lives in `src/app.css`: color tokens on `:root` (oat background, white cards, forest green `#1f4d3c` for actions, amber `#c47a2c` for accents, green/amber for on-target/off-target), Fraunces for headings and Inter for text, 16 px card radius and pill-shaped buttons. The botanical hop-and-barley logo (`public/brand/hop-barley-botanical.png`, framed by `BrandMark.tsx`) is unchanged.

Calculated numbers still come only from the engine; flavor values are labeled as estimates. Printing the Review step produces a brew sheet without navigation or buttons.
