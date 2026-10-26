# Brew Designer

A local recipe workbench with two visibly distinct layers: deterministic brewing calculations and subjective flavor estimates. Built in six committed stages.

## Run

Node 22.13+ required; Node 24+ recommended (Node's built-in SQLite avoids native dependency compilation).

```sh
npm install && npm run dev
```

Open http://127.0.0.1:5173. React/TypeScript/Vite + Tailwind frontend, Express/TypeScript API, SQLite in `.runtime/brew.sqlite`. No accounts or external AI services. Data stays on this machine. `npm test` runs the framework-free engine tests; `npm run build` checks TypeScript and builds the frontend. `npm start` serves the built app on port 3001.

## Architecture decision

A local Node API keeps a durable SQLite database independent of browser storage eviction and makes future Postgres migration straightforward. `server/schema.sql` uses portable SQL, UUID text keys and JSON encoded as TEXT. Postgres requires a new connection/query adapter (`?` to `$n`, transaction API) rather than schema redesign; it is not a connection-string-only switch. The engine under `src/engine` has no React, database or network dependencies. Canonical recipe units are kg/g/L/°C; US display converts at the UI boundary.

## Data sourcing

`data/*.json` is the reviewable source of truth. Numeric records are imported from Brewtarget's brewing reference tables (links on every row), not claimed as verified current manufacturer certificates. Most hop entries publish typical points rather than true ranges: `[x,x]` explicitly means a reference point. Unknown oil components, POF, diastaticus, alcohol tolerances and diastatic power are `null`, never fabricated zeros. Check the lot analysis before brewing. Original upstream descriptions are discarded. Flavor associations are editorial interpretations of reference associations; intensities and process responses are model estimates, not sourced measurements. Generic malt/body labels are low confidence heuristics. All descriptor notes are newly written. Numeric legacy style ranges are included without guideline prose and are labeled as legacy, not current BJCP guidance.

`npm run seed` regenerates reviewable JSON from upstream reference files (downloads when absent). It should only be run deliberately: it replaces manual edits. The API reseeds catalog tables from JSON at startup; recipes and brew logs survive. Source and confidence travel with every descriptor. Unknown specs remain visible.

## Adding ingredients and vocabulary

Add an objective record to `malts.json`, `hops.json`, or `yeasts.json`, using a unique stable ID and source URL/title/date. Add subjective records only to `descriptors.json`, with controlled descriptor IDs, confidence and structured context (use, min/max grist %, min/max temperature). Multiple conflicting records are allowed. Add vocabulary entries to `vocabulary.json` (`parent` groups the wheel, `axis` promotes to target sliders). No engine changes are required. Restart the API after editing seed files.

## Stages

1. Data model, normalized schema, sourced numeric seed data and separate controlled descriptors.
2. Pure calculation engine and reference-value tests.
3. Live recipe editor, units, persistence and export.
4. Contextual flavor prediction and source explanations.
5. Constrained recipe solver with ranked candidates and tradeoffs.
6. Brew logs, tasting feedback and opt-in calibration.

## Deterministic calculations and explicit approximations

- OG = 1 + Σ(lb × PPG × efficiency fraction) / gallons / 1000. Extract and sugars use 100%. Malt EBC ≈ 2.65 × °Lovibond − 1.2 (clamped at zero); this is distinct from beer EBC = 1.97 × SRM. Seed PPG = extract % × 0.46214 (46.214 PPG sucrose basis).
- FG = OG − (OG − 1) × apparent attenuation. Baseline uses midpoint of the yeast range. **Heuristic:** each °C below 65°C adds 0.75 percentage points of attenuation; each °C above subtracts 0.75, clamped to 40–95%. Each fermentable's gravity points are weighted separately: crystal/caramel uses 65% of baseline attenuation; lactose 0%; simple sugars 100%. These are rough planning assumptions, not laboratory fermentability analyses. Mash time does not change attenuation in this model.
- ABV standard = (OG − FG) × 131.25. Default accurate formula = (76.08 × (OG − FG)/(1.775 − OG)) × (FG/0.794). Both remain gravity-based estimates.
- Tinseth U = 1.65 × 0.000125^(boilSG − 1) × (1 − exp(−0.04t))/4.15. IBU = U × AA fraction × oz × 7490 / gal. Boil SG is the mean of pre/post-boil gravity (approximation). Whirlpool uses its entered duration times a configurable 0–1 multiplier (default .15); this does not model temperature decay. Dry hop IBU = 0 (no isomerized-alpha contribution; perceived bitterness can still change).
- Morey SRM = 1.4922 × MCU^0.6859; MCU = Σ(lb × °L)/gal. EBC = SRM × 1.97. Screen swatch is an illustrative exponential RGB approximation, not calibrated photometry.
- BU:GU = IBU / ((OG−1)×1000), zero for zero gravity points.
- Degrees Plato = −616.868 + 1111.14 SG − 630.272 SG² + 135.997 SG³. ABW = 76.08(OG−FG)/(1.775−OG); real extract = .1808 × OG Plato + .8192 × FG Plato. Calories per 12 US fl oz = [6.9 ABW + 4(real extract − .1)] × FG × 3.55; 330mL scales by 330/354.88235. Approximate; not nutritional labeling.
- Batch volume means **post-boil kettle volume**, before entered transfer loss. Pre-boil L = batch L + boil-off L/h × boil hours. Transfer loss reduces fermenter volume, not kettle concentration. Pre-boil SG conserves gravity points. Does not model grain absorption, shrinkage or sparge water.
- Pitch cells (billions) = 0.75 (ale) or 1.5 (lager) × volume L × degrees Plato × pitch multiplier. No viability or starter-growth model.
- Scaling multiplies all masses by new/old volume and mash grains additionally by old/new efficiency. Extract/sugars keep full yield. It preserves OG, color approximately changes when efficiency changes; hop timing and boil-off rate stay equipment settings.

Reference formula names: Tinseth hop utilization, Morey color, standard apparent attenuation/ABV and real-extract calorie estimation. Formula constants are recorded here so each can be independently checked; high gravity and extreme color recipes exceed their practical accuracy.

## Recipe editor and exchange

Every ingredient amount, hop alpha acid, addition timing/use, yeast, temperature and equipment setting is editable. Numbers update immediately; save writes explicitly to SQLite. Unsaved work is held in memory, so save before closing. US/metric preference persists in localStorage; recipe data does not depend on it. JSON import validates bounds and known ingredient IDs. BeerXML 1.0 import/export supports one recipe, one known yeast and single-infusion mash; unsupported ingredients, mash steps and hop uses are rejected so the user can resolve them rather than silently losing data. Catalog matching uses Brew Designer IDs or exact ingredient names. BeerXML volumes are L, masses kg and temperatures °C. Optional BD_* fields preserve transfer loss, whirlpool factor, pitch multiplier and style selection on round trip. Multi-strain fermentations, water, miscellaneous ingredients and complex mash profiles are outside this version's scope. Print exports the current recipe and calculated brew-day numbers.

## Flavor model (subjective)

Every score is an estimate on a 0–5 scale, never a measurement. Context is matched before consensus: addition use, min/max grist percentage, min/max fermentation °C. Confidence weights low/.45, medium/.75, high/1 multiply source weights manufacturer/1.1, literature/1, community/.8 and user/adjustable 1–3. Conflicting records are retained, with their weighted mean used in prediction. Context overlap is intentionally included; it does not select only one source.

- Malt raw intensity = consensus × sqrt(grist fraction), with ×3 for non-base ingredients. Chocolate contribution is halved above 10% roasted grist; burnt descriptors activate at 10%. These are editorial threshold models.
- Hop raw intensity = consensus × timing × [1−exp(−g/L÷3)] × sqrt(total oil÷1.5). Timing is 1 dry hop, .85 whirlpool, exp(−minutes/18) boil. Unknown oil defaults to 1.5 mL/100g and is disclosed in its explanation. Oil chemistry is not a full aroma or biotransformation model.
- Yeast esters use multiplier (.6+.9×warm-position) × (1/pitch multiplier)^.25; phenols .85+.3×warm-position. Warm-position is 0–1 within the strain temperature range. Clean/other descriptors use 1. Fermentation oxygen, pressure and hop-creep are not modeled.
- Sensory scores saturate as 5×[1−exp(−sum raw/5)]. Ingredient contribution totals are rescaled by the same saturation, so they add exactly to the displayed score.
- Structural axes replace descriptor sums: body = clamp((FG−1)×180+(mash°C−65)×.12); sweetness = clamp((FG−1)×140−BU:GU×.4); dryness = clamp((attenuation%−50)/10); bitterness = clamp(BU:GU×3.3); carbonation = clamp(volumes/3.5×5); astringency = clamp(roast fraction×15). All clamps use 0–5. These are heuristic perceptions inferred from recipe properties. Each has a process explanation instead of invented ingredient evidence.

The library exposes all records and weighted context previews. Hop Aroma/Flavor/Bittering/Dry hopping roles overlap and are editorial suitability filters, separate from analytical hop purpose. Malts filter by grist role, yeasts by family/form. Yeast tolerance filtering excludes unknowns only when a minimum is active. Potential ABV filtering uses entered OG and midpoint yeast attenuation with the accurate ABV formula; it is not a promise that a yeast produces a particular ABV. Full guides are newly written using record-specific numbers and clearly labeled process heuristics. Hop substitutions score 65% descriptor cosine similarity, 25% mean shared-oil closeness, 10% alpha similarity; missing data weakens the evidence.

Navigation preserves the editor and library components, their controls and each screen's scroll position. Recipe drafts are backed up to browser localStorage immediately after each edit, while explicit Save writes the durable SQLite copy. A browser backup is not a cross-device sync service. The mobile navigation stays available while scrolling on brew day.

## Solver

The solver runs in a dedicated browser worker and uses seeded deterministic gradient-free search. It ranks ingredients by desired descriptor overlap, filters excluded/on-hand ingredients, yeast form and alcohol tolerance, then explores 18 combinations of shortlisted base malt (6), specialty (8), hops (8) and yeast (6). Seventy local coordinate moves per start vary specialty fraction, mash/fermentation temperature, aroma/dry-hop amounts and late-boil versus whirlpool use. A gravity correction iteratively approaches target ABV and a per-gram Tinseth calculation sets remaining kettle bitterness. This is a bounded local search, not a global optimum or exhaustive recipe enumeration; unknown sensory evidence cannot guarantee the absence of a flavor.

Objective: flavor weight × mean squared 0–5 axis distance + numeric weight × squared normalized ABV(.5%)/IBU(10)/SRM(3) distance + style weight × distance outside style numeric ranges (OG .005, FG .003, ABV .5%, IBU 10, SRM 3). Optional user OG/FG ranges add the same normalized distance. Must include means score ≥1 (penalty ×8 below); avoid means ≤.3 (penalty ×10 above). These are soft sensory constraints and conflicts are explicitly reported. Ingredient exclusions, allowlist and yeast form are hard constraints; candidates over reference max grist percentages are discarded. A strict on-hand allowlist needs all required ingredient kinds. Quantities on hand are not tracked. Economy is a disclosed budget proxy (dry yeast and total hops ≤4 g/L), not a priced cost optimization. No live prices are claimed. Results are the top three starts; limited inventories can make them very similar. Recipe name, ingredient rationale, scores and numeric/sensory conflicts are exposed for review. Changing targets marks existing results stale and cancels an in-flight search.

## Brew log, tasting and personalization

Logs store the complete recipe and prediction snapshot at save time, measured OG/FG/post-boil volume/fermentation temperature, notes and only the tasting axes explicitly rated. Measurement fields begin at predicted values for convenience and must be replaced with real readings. Old predictions are never recomputed as you edit a recipe. Export all logs as JSON for backup.

Whole-beer tasting ratings show residuals (actual minus predicted); they do **not** automatically become assertions about individual ingredients. The brewer can explicitly attribute a controlled descriptor to one ingredient, at a chosen confidence. Those notes persist in the separate `flavor_descriptors` table as source_type=user. Usage context is hop use, fermentation ±1°C, or grist fraction ±2 percentage points. Personal notes remain visible in the library; including them in recipe/solver predictions is opt-in, with adjustable source weight 1–3. This learns associations, not validated causality.

Efficiency calibration solves E = (actual gravity points × actual post-boil gallons − fixed extract/sugar points) / mash potential points. Values outside 20–100% are excluded. Valid brews are averaged; applying the estimate keeps ingredient amounts fixed and changes recipe efficiency explicitly. Per-yeast calibration first inverts the model's sugar/lactose/crystal weighting and mash-temperature offset from observed attenuation, then averages valid 40–95% baseline estimates for that yeast. This avoids applying those heuristics twice. Per-yeast calibration is separately opt-in for the editor; solver uses catalog attenuation and personal descriptors, not the strain calibration, so candidate predictions should be checked in the editor. No automatic accuracy guarantee: sampling bias, measurement errors and process changes affect calibration. Preferences persist locally; stored user notes and measurements live in SQLite.

Manufacturer corrections live in `data/overrides.json`, applied after reference import. The US-05 attenuation, temperature, tolerance and POF fields were checked against [Fermentis technical specifications](https://fermentis.com/en/product/safale-us-05/); unverified remaining strain fields retain reference provenance.

Upstream Brewtarget numeric tables are pinned to commit `531d5e7523f9e72a0054349bd5b14aa1c7bf16ad`; the reference blobs match `32f20aa8f9fcf689de138d4c33cb5ac5797090a4` (XML) and `58a031c568afa19f4999b0d1c23b64b1a038ff46` (BeerJSON). Three legacy malt records lack a usable max-in-batch value; their permissive 100% model cap is not manufacturer usage advice.

## Verification

`npm test`: reference-value calculations, seed integrity, flavor attribution totals and context, solver constraints/determinism, calibration inversion, BeerXML round trip, SQLite API persistence and validation. API tests create an isolated temporary database under `.runtime` and remove it afterward. Browser checks covered mobile navigation, preserving edited amounts and scroll position across library visits, solver execution, yeast tolerance search, detailed guides and the brew-log form. `npm run build` performs strict TypeScript checking and a production build. The ingredient catalog is intentionally large and compressed transfer size is approximately 235KB for the app bundle; Vite may warn about the uncompressed catalog chunk.

## Suggested hops and malts

The recipe editor's **Suggested hops / Suggested malts** panels provide a hand-curated shortlist in `data/suggestions.json`. “For this recipe” prioritizes an editorial style-family match and ingredients not yet present; “Popular starting points” keeps the curated order. Neither mode is a measured popularity, sales or sensory ranking. The library can filter to the same beginner shortlist. Existing acid, color and potential specs stay separate from the suggestion's subjective rationale and its source link.

Hop suggestions filter bittering, late flavor/aroma and dry hopping. Trial doses are respectively 0.5, 1 and 1.5 g/L; bittering time is min(60, recipe boil minutes), whirlpool 20 minutes, dry hop 3 days. These are editable trial heuristics, not optimized IBU targets. Bittering suggestions require a positive boil duration. Each card previews deterministic changes in ABV percentage points, IBU and SRM before applying. Adding a hop preserves previous additions.

Malt suggestions filter base, malt character, caramel, body and roast roles. A base swap replaces the first base malt and adjusts mass by old PPG/new PPG to retain that grain's gravity contribution. Other grains remain fixed. A new specialty's mass = existing total × desired final grist fraction/(1−fraction), bounded by the catalog max share. Duplicate malts are directed to the existing editor row. With an empty grist, add a base first (initial base trial 0.2 kg/L). Suggestions never silently remove an existing recipe to install a full preset. Actual flavor impact is uncertain and should be evaluated on the live profile.

An applied suggestion can be undone from its panel while the recipe still matches that suggestion’s result. Later manual edits or other additions disable that undo so it cannot overwrite newer work.

## Recipe Book

The Recipe Book opens on **Style collection**, with **All recipes**, **My recipes** saved to SQLite, and browser-backed **Drafts** also available. Search matches names, breweries, styles, ingredients, tags, descriptions and notes; filters select collection, brewery, style or source type. Each card displays current catalog-based calculated ABV/IBU/SRM, with full ingredients, process, notes and exports available under View recipe. These card calculations use reference yeast attenuation, not optional personal calibration, so check a loaded recipe in the editor when calibration is enabled.

`data/recipes.json` includes 19 entries: seven original educational formulations, three brewery-recipe adaptations, one published-clone adaptation and eight independent house clones. The [Sierra Nevada Pale Ale adaptation](https://sierranevada.com/blog/our-beer/pale-ale-homebrew-recipe) retains 92/8 grain percentages and the published Cascade masses/timings; the source does not give a total grain weight in its ingredient list, so this template assumes 4.5kg and documents efficiency, catalog mapping, volume and equipment assumptions. The source's mash-out remains in notes because the engine supports one mash rest. Descriptions and instructions are newly written, and no brewery validation is claimed. Original starter recipes are not presented as established commercial recipes or successful brew trials.

Using a starter always creates a new ID. Saved recipes can be reopened, duplicated or saved as a copy. Saving in the editor adds/updates My recipes; a copy does not overwrite the original. Description, notes, tags and source attribution persist in SQLite's existing recipe document and JSON, and round-trip through NOTES/BD_* BeerXML fields. Per-recipe drafts are kept in localStorage (`brew-drafts`) so opening another recipe retains earlier work. A saved recipe with local edits appears once, marked Unsaved edits, and opens its draft. Drafts remain browser-local; Save is the durable database step. No existing saved recipes are replaced when the starter collection changes.

### Craft brewery and clone collection

The Recipe Book includes the original 12 craft interpretations and seven original starters, plus 70 style-coverage templates. Brewery and source-type filters distinguish (1) brewery-provided recipes adapted to the app, (2) published third-party clone adaptations, and (3) independently authored house approximations based on official commercial beer descriptions. A commercial product page is never presented as a disclosed brewing formula. Existing saved recipes and browser drafts are untouched; recipe origin metadata survives copies and exports.

The collection covers Sierra Nevada Pale Ale, Torpedo and Celebration; Bell’s Two Hearted; Stone Ruination; Founders All Day IPA; Deschutes Fresh Squeezed; New Belgium Fat Tire **Classic Amber**; Dogfish Head 60 Minute IPA; Ballast Point Sculpin; Lagunitas IPA; and Left Hand Milk Stout. Version-sensitive names matter: Classic Amber is explicitly distinct from the lighter reformulated Fat Tire, and Milk Stout does not model nitro dispensing.

Three entries adapt brewery-provided numeric recipes (Sierra Nevada Pale Ale/Torpedo, and the Bell’s staff recipe published by the Homebrewers Association); Celebration is labeled as a published clone. Each records catalog mappings, single-rest process limitations, volume interpretation and other assumptions. Unspecified whirlpool times remain zero rather than inventing isomerization; process instructions remain in notes. Eight house clones choose their own grist percentages, doses, timing and strain. Their grain mass and bittering quantities were adjusted using this app’s deterministic formulas toward advertised ABV/IBU. Matching those two numbers does not establish sensory equivalence. Fat Tire’s 22-IBU trial is a house choice where the linked Classic Amber page gives no IBU; Ruination uses 100 as a planning target for a 100+ reference. Dogfish Head’s continuous-hopping idea is represented by twelve discrete timed kettle charges, not an exact continuous-extraction model.

Published source numbers are stored separately in `origin.referenceSpecs` and displayed in recipe details apart from recalculated recipe predictions. All links, authorship and editorial caveats are in `data/recipes.json`. House clones are neither endorsed nor authenticated brewery recipes. Briess Carapils used by the Celebration adaptation is classified as dextrin/specialty rather than caramel, using the producer’s explanation; its body intensity remains a subjective model estimate. That correction and descriptor replacement are preserved by `data/overrides.json` when reseeding ingredients.


### Recipe coverage by beer style

The shipped book contains **89 recipes covering all 80 beer-style entries** in the app's legacy numeric catalog. **Style collection** shows all built-ins; **Craft & clones** shows the 75 brewery-associated entries. Expand **Browse by style** to see coverage and jump directly to a style. Coverage uses shipped recipes, independent of user saves, drafts and search filters. `data/non-beer-styles.json` explicitly excludes the 18 cider, perry, mead and honey-hybrid entries from the beer requirement. A newly added beer style counts as missing until a recipe is added; the coverage test catches gaps. This is complete coverage of this catalog, not a claim to include every modern or regional style worldwide.

The 70 additions comprise 63 independent brewery-inspired interpretations and seven original house starters. Their commercial names and historical style associations were checked against the [BJCP 2008 commercial examples](https://www.bjcp.org/wp-content/uploads/2019/08/2008_stylebook.pdf), with Baltic Porter verified against its [category page](https://legacy.bjcp.org/2008styles/style12.php) after a PDF extraction error. `data/style-recipe-references.json` records selected names and category codes; links on each recipe lead to the corresponding historical reference. These are historical associations, not claims of present brewery ownership, availability, or current product specifications. Known craft examples are favored; traditional breweries cover some regional styles. No guideline descriptions or brewery marketing prose are copied.

**These are authored homebrew interpretations, not disclosed brewery formulas.** Each style plan in `scripts/expand-style-recipes.ts` explicitly chooses its grist, yeast, fermentation, mash, house ABV/IBU targets and process instructions. The existing deterministic engine scales total grist by bisection to the house ABV target and scales kettle hop weights linearly to the house IBU target. Published commercial numbers are not invented or inferred from those targets. The script regenerates only `style-*` templates in `data/recipes.json`; review and commit that JSON after generation (`npx tsx scripts/expand-style-recipes.ts`). Existing built-in recipes and user SQLite data are not rewritten. Flavor descriptions express intent and remain subjective.

Special-process cards explicitly label the calculated values as **base beer estimates**. Fruit, spices, oak, extended mixed-culture fermentation, aged blending and ice concentration appear as quantified instructions in brewing notes, because the current model cannot represent their full extract, attenuation, acidity, color, volume, carbonation or sensory effects. Eisbock is a base bock plus concentration instructions, and gueuze is a base wort plus a long-term blend plan; their card numbers are not finished-product predictions. Malt, hop, yeast, main mash and fermentation settings remain editable. Source and limitations survive copies and JSON/BeerXML exports through existing notes, tags and origin metadata.
