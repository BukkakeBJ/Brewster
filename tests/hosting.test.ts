import { afterAll, beforeAll, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { defaultRecipe } from "../src/defaults";
import { predict } from "../src/engine/calculations";
import { catalog } from "../src/catalog";

mkdirSync(".runtime", { recursive: true });
const directory = mkdtempSync(".runtime/hosting-test-");
let child: ChildProcess | undefined;
let api = "";
const publicHeaders = {
  "Content-Type": "application/json",
  "X-Forwarded-Proto": "https",
  Origin: "",
};

async function start() {
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
        BREW_DB: join(directory, "nested", "brew.sqlite"),
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
  for (let n = 0; n < 100; n++) {
    const address = output.match(
      /BrewMaster API: (http:\/\/127\.0\.0\.1:\d+)/,
    )?.[1];
    if (address) {
      try {
        if ((await fetch(address + "/api/health")).ok) {
          api = address;
          publicHeaders.Origin = address.replace("http:", "https:");
          return;
        }
      } catch {}
    }
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Production API did not start: " + output);
}

async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise<void>((resolve) =>
    child!.once("exit", () => resolve()),
  );
  child.kill("SIGTERM");
  await exited;
}

beforeAll(start, 10000);
afterAll(async () => {
  await stop();
  rmSync(directory, { recursive: true, force: true });
});

it("accepts same-origin HTTPS saves behind the hosting proxy", async () => {
  const response = await fetch(api + "/api/recipes/" + defaultRecipe.id, {
    method: "PUT",
    headers: publicHeaders,
    body: JSON.stringify(defaultRecipe),
  });
  expect(response.status).toBe(200);
  expect((await response.json()).name).toBe(defaultRecipe.name);
});

it("rejects foreign and development origins in production", async () => {
  for (const origin of ["https://foreign.example", "http://localhost:5173"]) {
    const response = await fetch(api + "/api/recipes/" + defaultRecipe.id, {
      method: "DELETE",
      headers: { ...publicHeaders, Origin: origin },
    });
    expect(response.status).toBe(403);
  }
});

it("keeps recipes and brew logs after restarting with the mounted database", async () => {
  const recipe = {
    ...defaultRecipe,
    id: "restart-test",
    name: "Persistent brew",
  };
  const saved = await fetch(api + "/api/recipes/" + recipe.id, {
    method: "PUT",
    headers: publicHeaders,
    body: JSON.stringify(recipe),
  });
  expect(saved.status).toBe(200);
  const predicted = predict(recipe, catalog);
  const log = {
    id: "restart-log",
    date: "2026-10-26",
    recipe,
    predicted,
    predictedFlavor: {},
    actualOg: predicted.og,
    actualFg: predicted.fg,
    actualVolumeL: recipe.batchL,
    actualTempC: recipe.fermentC,
    tasting: {},
    notes: "Persistence test",
    descriptors: [],
  };
  const logged = await fetch(api + "/api/logs/" + log.id, {
    method: "PUT",
    headers: publicHeaders,
    body: JSON.stringify(log),
  });
  expect(logged.status).toBe(200);
  await stop();
  await start();
  const recipes = await (await fetch(api + "/api/recipes")).json();
  const logs = await (await fetch(api + "/api/logs")).json();
  expect(recipes.find((r: { id: string }) => r.id === recipe.id)).toEqual(
    recipe,
  );
  expect(logs.find((r: { id: string }) => r.id === log.id)).toEqual(log);
}, 15000);
