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
