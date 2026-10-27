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

## Visual system

All styling lives in `src/app.css`: color tokens on `:root` (oat background, white cards, forest green `#1f4d3c` for actions, amber `#c47a2c` for accents, green/amber for on-target/off-target), Fraunces for headings and Inter for text, 16 px card radius and pill-shaped buttons. The botanical hop-and-barley logo (`public/brand/hop-barley-botanical.png`, framed by `BrandMark.tsx`) is unchanged.

Calculated numbers still come only from the engine; flavor values are labeled as estimates. Printing the Review step produces a brew sheet without navigation or buttons.
