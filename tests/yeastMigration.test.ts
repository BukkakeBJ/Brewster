import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { defaultRecipe } from "../src/defaults";

it("migrates required legacy yeast specs to unknown-capable fields without losing saved work, twice safely", () => {
  const directory = mkdtempSync(".runtime/yeast-migration-");
  const filename = join(directory, "brew.sqlite");
  try {
    const legacy = new DatabaseSync(filename);
    let schema = readFileSync("server/schema.sql", "utf8");
    for (const name of [
      "attenuation_min",
      "attenuation_max",
      "temp_min_c",
      "temp_max_c",
    ])
      schema = schema.replace(`${name} REAL,`, `${name} REAL NOT NULL,`);
    legacy.exec(schema);
    legacy
      .prepare("INSERT INTO ingredients VALUES(?,?,?,?)")
      .run("legacy-yeast", "yeast", "Legacy strain", "{}");
    legacy
      .prepare("INSERT INTO yeast_specs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        "legacy-yeast",
        "Legacy lab",
        "OLD",
        "dry",
        "ale",
        70,
        80,
        "medium",
        18,
        22,
        10,
        null,
        null,
      );
    const document = JSON.stringify({
      ...defaultRecipe,
      notes: "Keep my private experiment",
    });
    legacy
      .prepare("INSERT INTO recipes VALUES(?,?,?,?,?,?)")
      .run(
        "keep",
        "Saved experiment",
        document,
        "2026-10-26",
        "owner-hash",
        "private",
      );
    legacy
      .prepare("INSERT INTO brew_logs VALUES(?,?,?,?,?)")
      .run("log-keep", "keep", "2026-10-26", document, "owner-hash");
    legacy.close();
    for (let n = 0; n < 2; n++) {
      const run = spawnSync(
        process.execPath,
        [
          "node_modules/tsx/dist/cli.mjs",
          "-e",
          "import('./server/db.ts').then(({db})=>db.close())",
        ],
        {
          env: { ...process.env, BREW_DB: filename },
          encoding: "utf8",
          timeout: 10000,
        },
      );
      expect(run.status, run.stderr).toBe(0);
      const db = new DatabaseSync(filename);
      expect(
        db
          .prepare(
            "SELECT document,visibility,owner_id FROM recipes WHERE id='keep'",
          )
          .get(),
      ).toEqual({ document, visibility: "private", owner_id: "owner-hash" });
      expect(
        db.prepare("SELECT document FROM brew_logs WHERE id='log-keep'").get()
          ?.document,
      ).toBe(document);
      expect(
        db
          .prepare(
            "SELECT attenuation_min FROM yeast_specs WHERE ingredient_id='legacy-yeast'",
          )
          .get()?.attenuation_min,
      ).toBe(70);
      expect(
        db
          .prepare(
            "SELECT attenuation_min,alcohol_tolerance,temp_min_c FROM yeast_specs WHERE ingredient_id='y-fleischmann-active-dry'",
          )
          .get(),
      ).toEqual({
        attenuation_min: null,
        alcohol_tolerance: null,
        temp_min_c: null,
      });
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      db.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
