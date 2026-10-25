# Brew Designer

A local recipe workbench with two visibly distinct layers: deterministic brewing calculations and subjective flavor estimates. Work in progress, built in six committed stages.

## Run

Node 22.13+ required (Node's built-in SQLite avoids native dependency compilation).

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

- OG = 1 + Σ(lb × PPG × efficiency fraction) / gallons / 1000. Extract and sugars use 100%. Seed PPG = extract % × 0.46214 (46.214 PPG sucrose basis).
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

Navigation preserves the editor and library components, their controls and each screen's scroll position. Recipe drafts are backed up to browser localStorage after edits (250ms debounce), while explicit Save writes the durable SQLite copy. A browser backup is not a cross-device sync service. The mobile navigation stays available while scrolling on brew day.
