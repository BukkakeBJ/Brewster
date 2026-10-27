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
2. **Goals** — style (choosing one sets its typical ABV, IBU and flavor), sliders for alcohol, bitterness and optional color with the style's range shaded, flavor sliders and hop-character presets. "Suggest recipes for me" designs three options; **Next** keeps the current ingredients. Ingredient limits and solver weights are under "Ingredient limits & fine-tuning".
3. **Malts**, 4. **Hops**, 5. **Yeast** — each shows a plain-language tip when a number is off its goal. Malts and Hops offer one-click "Adjust malts to X% ABV" / "Adjust boil hops to X IBU" (`src/engine/guidance.ts`). A flavor estimate and style check sit beside the editor.
6. **Review** — name, style, save/share, the full recipe with edit links, optional extras (additives), notes, brew-day numbers, print and export.

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
