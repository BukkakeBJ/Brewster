import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { catalog as c } from "../src/catalog";
mkdirSync(".runtime", { recursive: true });
export const db = new DatabaseSync(
  process.env.BREW_DB ?? ".runtime/brew.sqlite",
);
db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
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
      attenuation_min: y.attenuation[0],
      attenuation_max: y.attenuation[1],
      flocculation: y.flocculation,
      temp_min_c: y.tempC[0],
      temp_max_c: y.tempC[1],
      alcohol_tolerance: y.alcoholTolerance,
      pof: y.pof,
      diastaticus: y.diastaticus,
    });
  for (const v of c.vocabulary) insert("vocabulary", { ...v });
  for (const d of c.descriptors)
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
