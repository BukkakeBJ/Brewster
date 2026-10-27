import { beforeAll, afterAll, it, expect } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { defaultRecipe } from "../src/defaults";
import { catalog } from "../src/catalog";
import { predict } from "../src/engine/calculations";
import { browserClient } from "./browserClient";

mkdirSync(".runtime", { recursive: true });
const directory = mkdtempSync(".runtime/sharing-test-");
const filename = join(directory, "brew.sqlite");
const alice = browserClient(),
  bob = browserClient();
const json = (body: unknown): RequestInit => ({
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const recipe = {
  ...defaultRecipe,
  id: "private-new",
  notes: "Private recipe notes",
  processNotes: { mash: "Private experiment" },
};
const predicted = predict(defaultRecipe, catalog);
const brew = (id: string) => ({
  id,
  date: "2026-10-26",
  recipe: defaultRecipe,
  predicted,
  predictedFlavor: {},
  actualOg: predicted.og,
  actualFg: predicted.fg,
  actualVolumeL: defaultRecipe.batchL,
  actualTempC: defaultRecipe.fermentC,
  tasting: {},
  notes: "Private tasting",
  descriptors: [],
});
let child: ChildProcess;
let api = "";
beforeAll(async () => {
  const legacy = new DatabaseSync(filename);
  legacy.exec(
    "CREATE TABLE recipes(id TEXT PRIMARY KEY,name TEXT NOT NULL,document TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE brew_logs(id TEXT PRIMARY KEY,recipe_id TEXT NOT NULL,date TEXT NOT NULL,document TEXT NOT NULL);",
  );
  const old = {
    ...defaultRecipe,
    id: "legacy-public",
    name: "Previously shared recipe",
  };
  legacy
    .prepare("INSERT INTO recipes VALUES(?,?,?,?)")
    .run(old.id, old.name, JSON.stringify(old), "2026-10-26");
  const oldLog = { ...brew("legacy-log"), notes: "Previously shared tasting" };
  legacy
    .prepare("INSERT INTO brew_logs VALUES(?,?,?,?)")
    .run(oldLog.id, oldLog.recipe.id, oldLog.date, JSON.stringify(oldLog));
  legacy.close();
  let output = "";
  child = spawn(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "server/index.ts"],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "0",
        BREW_DB: filename,
      },
      stdio: "pipe",
    },
  );
  child.stdout?.on("data", (data) => {
    output += data;
  });
  child.stderr?.on("data", (data) => {
    output += data;
  });
  for (let i = 0; i < 100; i++) {
    const address = output.match(
      /BrewMaster API: (http:\/\/127\.0\.0\.1:\d+)/,
    )?.[1];
    if (address) {
      api = address;
      return;
    }
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(output);
}, 10000);
afterAll(async () => {
  if (child && child.exitCode === null) {
    const done = new Promise<void>((resolve) =>
      child.once("exit", () => resolve()),
    );
    child.kill("SIGTERM");
    await done;
  }
  rmSync(directory, { recursive: true, force: true });
});

it("issues a secure browser-owned workspace without exposing its secret", async () => {
  const response = await alice(api + "/api/workspace");
  expect(response.headers.get("set-cookie")).toMatch(
    /^__Host-brewmaster_owner=/,
  );
  expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/);
  expect(response.headers.get("set-cookie")).toMatch(/Secure/);
  expect(response.headers.get("set-cookie")).toMatch(/SameSite=Lax/);
  expect(response.headers.get("set-cookie")).not.toMatch(/Domain=/i);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ newRecipes: "private" });
});
it("defaults new recipes to private and hides them from another browser", async () => {
  const saved = await alice(api + "/api/recipes/" + recipe.id, json(recipe));
  expect(saved.status).toBe(200);
  expect((await saved.json()).access).toEqual({
    visibility: "private",
    owned: true,
  });
  const own = await (await alice(api + "/api/recipes")).json();
  expect(own.find((r: { id: string }) => r.id === recipe.id).notes).toBe(
    recipe.notes,
  );
  const other = await (await bob(api + "/api/recipes")).json();
  expect(other.some((r: { id: string }) => r.id === recipe.id)).toBe(false);
  expect((await bob(api + "/api/recipes/" + recipe.id)).status).toBe(404);
  expect(JSON.stringify(own)).not.toContain("owner_id");
});
it("rejects overwrite and deletion by another browser", async () => {
  expect(
    (
      await bob(
        api + "/api/recipes/" + recipe.id,
        json({ ...recipe, name: "Overwritten", access: { owned: true } }),
      )
    ).status,
  ).toBe(403);
  expect(
    (await bob(api + "/api/recipes/" + recipe.id, { method: "DELETE" })).status,
  ).toBe(404);
  expect(
    (await (await alice(api + "/api/recipes/" + recipe.id)).json()).name,
  ).toBe(recipe.name);
});
it("shares only on explicit opt-in, allows private copies, and revokes public access", async () => {
  const source = { ...recipe, id: "sharing-flow", name: "Opt-in public beer" };
  const shared = await (
    await alice(
      api + "/api/recipes/" + source.id,
      json({ ...source, visibility: "public" }),
    )
  ).json();
  expect(shared.access).toEqual({ visibility: "public", owned: true });
  const publicCopy = await (
    await bob(api + "/api/recipes/" + source.id)
  ).json();
  expect(publicCopy.access).toEqual({ visibility: "public", owned: false });
  expect(publicCopy.processNotes).toEqual(source.processNotes);
  expect(
    (await bob(api + "/api/recipes/" + source.id, json(source))).status,
  ).toBe(403);
  const copy = await (
    await bob(
      api + "/api/recipes/bobs-copy",
      json({ ...publicCopy, id: "bobs-copy" }),
    )
  ).json();
  expect(copy.access).toEqual({ visibility: "private", owned: true });
  expect((await alice(api + "/api/recipes/bobs-copy")).status).toBe(404);
  const update = await (
    await alice(
      api + "/api/recipes/" + source.id,
      json({ ...source, name: "Still public" }),
    )
  ).json();
  expect(update.access.visibility).toBe("public");
  expect(
    (
      await alice(
        api + "/api/recipes/" + source.id,
        json({ ...source, visibility: "private" }),
      )
    ).status,
  ).toBe(200);
  expect((await bob(api + "/api/recipes/" + source.id)).status).toBe(404);
  expect((await bob(api + "/api/recipes/bobs-copy")).status).toBe(200);
});
it("keeps new brew snapshots and tasting notes private even for a public recipe", async () => {
  const publicRecipe = {
    ...defaultRecipe,
    id: "public-brew-recipe",
    visibility: "public",
  };
  await alice(api + "/api/recipes/" + publicRecipe.id, json(publicRecipe));
  const log = { ...brew("private-brew"), recipe: publicRecipe };
  expect((await alice(api + "/api/logs/" + log.id, json(log))).status).toBe(
    200,
  );
  const own = await (await alice(api + "/api/logs")).json();
  expect(own.find((l: { id: string }) => l.id === log.id).access).toEqual({
    visibility: "private",
    owned: true,
  });
  const other = await (await bob(api + "/api/logs")).json();
  expect(other.some((l: { id: string }) => l.id === log.id)).toBe(false);
  expect((await bob(api + "/api/logs/" + log.id, json(log))).status).toBe(403);
});
it("preserves previously public data as read-only without letting a visitor claim it", async () => {
  const old = await (await alice(api + "/api/recipes/legacy-public")).json();
  expect(old.access).toEqual({ visibility: "public", owned: false });
  expect(
    (await alice(api + "/api/recipes/legacy-public", json(old))).status,
  ).toBe(403);
  const logs = await (await bob(api + "/api/logs")).json();
  expect(
    logs.find((l: { id: string }) => l.id === "legacy-log").access,
  ).toEqual({ visibility: "public", owned: false });
  expect(
    (await bob(api + "/api/logs/legacy-log", json(brew("legacy-log")))).status,
  ).toBe(403);
});
it("rejects unsupported visibility instead of silently publishing", async () => {
  expect(
    (
      await alice(
        api + "/api/recipes/invalid-visibility",
        json({ ...recipe, id: "invalid-visibility", visibility: "friends" }),
      )
    ).status,
  ).toBe(400);
  expect((await bob(api + "/api/recipes/invalid-visibility")).status).toBe(404);
});
