import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { additives, additiveDescriptors } from "../src/engine/additives";
import { catalog as c } from "../src/catalog";
const filename = process.env.BREW_DB ?? ".runtime/brew.sqlite";
mkdirSync(dirname(filename), { recursive: true });
export const db = new DatabaseSync(filename);
db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
db.exec(schema);
// Older catalogs required brewing figures even for non-brewing cultures.
// Make unknown specs nullable, preserving all rows and recipe/log documents.
if (
  db
    .prepare("PRAGMA table_info(yeast_specs)")
    .all()
    .some((column) => column.name === "attenuation_min" && column.notnull === 1)
) {
  db.exec("BEGIN");
  try {
    db.exec("ALTER TABLE yeast_specs RENAME TO yeast_specs_legacy");
    db.exec(
      schema.match(/CREATE TABLE IF NOT EXISTS yeast_specs \([^;]+;/)![0],
    );
    db.exec(
      "INSERT INTO yeast_specs SELECT * FROM yeast_specs_legacy; DROP TABLE yeast_specs_legacy; COMMIT",
    );
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
// Existing records were deliberately public before optional sharing existed.
// Preserve them as read-only community records; never assign them to a visitor.
for (const table of ["recipes", "brew_logs"]) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === "owner_id"))
    db.exec(`ALTER TABLE ${table} ADD COLUMN owner_id TEXT`);
}
const recipeColumns = db.prepare("PRAGMA table_info(recipes)").all();
if (!recipeColumns.some((column) => column.name === "visibility"))
  db.exec(
    "ALTER TABLE recipes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('private','public'))",
  );
db.exec(
  "CREATE INDEX IF NOT EXISTS recipes_owner_visibility ON recipes(owner_id,visibility); CREATE INDEX IF NOT EXISTS brew_logs_owner ON brew_logs(owner_id);",
);
const insert = (table: string, values: Record<string, unknown>) => {
  const cols = Object.keys(values);
  db.prepare(
    `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")}) ON CONFLICT DO UPDATE SET ${cols.map((k) => `${k}=excluded.${k}`).join(",")}`,
  ).run(
    ...(Object.values(values).map((v) =>
      typeof v === "boolean" ? Number(v) : v,
    ) as (string | number | null)[]),
  );
};
db.exec("BEGIN");
try {
  for (const i of [...c.malts, ...c.hops, ...c.yeasts])
    insert("ingredients", {
      id: i.id,
      kind: i.kind,
      name: i.name,
      source: JSON.stringify(i.source),
    });
  for (const a of additives) {
    insert("ingredients", {
      id: a.id,
      kind: "additive",
      name: a.name,
      source: JSON.stringify(a.source),
    });
    insert("additive_specs", {
      ingredient_id: a.id,
      category: a.category,
      form: a.form,
      stages: JSON.stringify(a.stages),
      usage_guide: JSON.stringify(a.guide),
    });
  }
  for (const m of c.malts)
    insert("malt_specs", {
      ingredient_id: m.id,
      maltster: m.maltster,
      type: m.type,
      lovibond: m.lovibond,
      ebc: m.ebc,
      ppg: m.ppg,
      extract_percent: m.extractPercent,
      diastatic_power: m.diastaticPower,
      requires_mash: m.requiresMash,
      max_percent: m.maxPercent,
      fermentability_notes: m.fermentabilityNotes,
      body_contribution: m.bodyContribution,
    });
  for (const h of c.hops)
    insert("hop_specs", {
      ingredient_id: h.id,
      origin: h.origin,
      purpose: h.purpose,
      alpha_min: h.alpha[0],
      alpha_max: h.alpha[1],
      beta_min: h.beta?.[0] ?? null,
      beta_max: h.beta?.[1] ?? null,
      cohumulone: h.cohumulone,
      total_oil: h.totalOil,
      oils: JSON.stringify(h.oils),
      substitutes: JSON.stringify(h.substitutes),
    });
  for (const y of c.yeasts)
    insert("yeast_specs", {
      ingredient_id: y.id,
      lab: y.lab,
      code: y.code,
      form: y.form,
      type: y.type,
      attenuation_min: y.attenuation?.[0] ?? null,
      attenuation_max: y.attenuation?.[1] ?? null,
      flocculation: y.flocculation,
      temp_min_c: y.tempC?.[0] ?? null,
      temp_max_c: y.tempC?.[1] ?? null,
      alcohol_tolerance: y.alcoholTolerance,
      pof: y.pof,
      diastaticus: y.diastaticus,
    });
  for (const v of c.vocabulary) insert("vocabulary", { ...v });
  for (const d of [...c.descriptors, ...additiveDescriptors])
    insert("flavor_descriptors", {
      id: d.id,
      ingredient_id: d.ingredientId,
      descriptor: d.descriptor,
      intensity: d.intensity,
      usage_context: d.usageContext,
      context: JSON.stringify(d.context),
      source_type: d.sourceType,
      confidence: d.confidence,
      note: d.note,
      source: JSON.stringify(d.source),
    });
  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
}
