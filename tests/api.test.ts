import { beforeAll, afterAll, it, expect } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { unlinkSync } from "node:fs";
import { defaultRecipe as r } from "../src/defaults";
import { catalog as c } from "../src/catalog";
import { predict } from "../src/engine/calculations";
import { flavorPredict } from "../src/engine/flavor";
let child: ChildProcess;
const filename = `.runtime/api-test-${process.pid}.sqlite`;
const api = "http://127.0.0.1:3002";
let output = "";
beforeAll(async () => {
  child = spawn(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "server/index.ts"],
    { env: { ...process.env, PORT: "3002", BREW_DB: filename }, stdio: "pipe" },
  );
  child.stderr?.on("data", (x) => (output += x));
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(api + "/api/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Test API did not start: " + output);
}, 10000);
afterAll(async () => {
  child?.kill();
  await new Promise((r) => setTimeout(r, 150));
  for (const suffix of ["", "-wal", "-shm"])
    try {
      unlinkSync(filename + suffix);
    } catch {}
});
it("persists recipes and returns actionable validation errors", async () => {
  const good = await fetch(api + "/api/recipes/" + r.id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(r),
  });
  expect(good.status).toBe(200);
  const list = await (await fetch(api + "/api/recipes")).json();
  expect(list[0].grains).toEqual(r.grains);
  const bad = await fetch(api + "/api/recipes/" + r.id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...r, batchL: 0 }),
  });
  expect(bad.status).toBe(400);
});
it("stores brew snapshots and subjective user descriptors atomically", async () => {
  const p = predict(r, c);
  const log = {
    id: "test-log",
    date: "2026-10-25",
    recipe: r,
    predicted: p,
    predictedFlavor: flavorPredict(r, c, p).scores,
    actualOg: p.og,
    actualFg: p.fg,
    actualVolumeL: r.batchL,
    actualTempC: r.fermentC,
    tasting: { citrus: 3 },
    notes: "Test",
    descriptors: [
      {
        ...c.descriptors[0],
        id: "temporary",
        ingredientId: r.yeastId,
        sourceType: "user",
        descriptor: "clean",
        intensity: 3,
      },
    ],
  };
  const response = await fetch(api + "/api/logs/test-log", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(log),
  });
  expect(response.status).toBe(200);
  const saved = await (await fetch(api + "/api/logs")).json();
  expect(saved[0].predicted).toEqual(p);
  expect(saved[0].descriptors[0].id).toBe("test-log-note-0");
  const bad = await fetch(api + "/api/logs/test-log", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...log,
      descriptors: [{ ...log.descriptors[0], descriptor: "nonexistent" }],
    }),
  });
  expect(bad.status).toBe(400);
  expect(
    (await (await fetch(api + "/api/logs")).json())[0].descriptors,
  ).toHaveLength(1);
});
it("rejects cross-origin mutation of the local workspace", async () => {
  const response = await fetch(api + "/api/recipes/" + r.id, {
    method: "DELETE",
    headers: { origin: "https://example.com" },
  });
  expect(response.status).toBe(403);
});
