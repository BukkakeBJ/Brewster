import express from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { db } from "./db";
import { recipeSchema, logSchema } from "../src/validation";
import { predict } from "../src/engine/calculations";
import { catalog } from "../src/catalog";
import { workspace } from "./workspace";
const app = express();
// Railway terminates HTTPS at its reverse proxy. Trust its nearest proxy so
// same-origin saves use the public HTTPS URL rather than the internal HTTP URL.
app.set("trust proxy", 1);
app.use((req, res, next) => {
  const origin = req.get("origin");
  const sameOrigin = `${req.protocol}://${req.get("host")}`;
  const localDevOrigin =
    process.env.NODE_ENV !== "production" &&
    /^http:\/\/(127\.0\.0\.1|localhost):(5173|3001|3002)$/.test(origin ?? "");
  if (origin && origin !== sameOrigin && !localDevOrigin)
    return res.status(403).json({ error: "Origin not allowed" });
  next();
});
app.use(express.json({ limit: "2mb" }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api", workspace);
app.get("/api/workspace", (_req, res) => res.json({ newRecipes: "private" }));
app.get("/api/recipes", (_req, res) =>
  res.json(
    db
      .prepare(
        "SELECT document,owner_id,visibility FROM recipes WHERE owner_id=? OR visibility='public' ORDER BY updated_at DESC",
      )
      .all(res.locals.ownerId)
      .map((r) => ({
        ...JSON.parse(r.document as string),
        access: {
          visibility: r.visibility,
          owned: r.owner_id === res.locals.ownerId,
        },
      })),
  ),
);
app.get("/api/recipes/:id", (req, res) => {
  const row = db
    .prepare(
      "SELECT document,owner_id,visibility FROM recipes WHERE id=? AND (owner_id=? OR visibility='public')",
    )
    .get(req.params.id, res.locals.ownerId);
  if (!row) return res.status(404).json({ error: "Recipe not found" });
  res.json({
    ...JSON.parse(row.document as string),
    access: {
      visibility: row.visibility,
      owned: row.owner_id === res.locals.ownerId,
    },
  });
});
app.put("/api/recipes/:id", (req, res) => {
  try {
    const r = recipeSchema.parse(req.body);
    if (r.id !== req.params.id) throw new Error("Recipe ID mismatch");
    const existing = db
      .prepare("SELECT owner_id,visibility FROM recipes WHERE id=?")
      .get(r.id);
    if (existing && existing.owner_id !== res.locals.ownerId)
      return res
        .status(403)
        .json({
          error:
            "This recipe is read-only. Save your own private copy to customize it.",
        });
    const visibility = req.body.visibility ?? existing?.visibility ?? "private";
    if (visibility !== "private" && visibility !== "public")
      throw new Error("Choose private or public visibility");
    predict(r, catalog);
    db.prepare(
      "INSERT INTO recipes(id,name,document,updated_at,owner_id,visibility) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,document=excluded.document,updated_at=excluded.updated_at,visibility=excluded.visibility",
    ).run(
      r.id,
      r.name,
      JSON.stringify(r),
      new Date().toISOString(),
      res.locals.ownerId,
      visibility,
    );
    res.json({ ...r, access: { visibility, owned: true } });
  } catch (e) {
    res
      .status(400)
      .json({ error: e instanceof Error ? e.message : "Invalid recipe" });
  }
});
app.delete("/api/recipes/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM recipes WHERE id=? AND owner_id=?")
    .run(req.params.id, res.locals.ownerId);
  if (!result.changes)
    return res
      .status(404)
      .json({ error: "Recipe not found in this workspace" });
  res.json({ ok: true });
});
app.get("/api/logs", (_req, res) =>
  res.json(
    db
      .prepare(
        "SELECT document,owner_id FROM brew_logs WHERE owner_id=? OR owner_id IS NULL ORDER BY date DESC",
      )
      .all(res.locals.ownerId)
      .map((r) => ({
        ...JSON.parse(r.document as string),
        access: {
          visibility: r.owner_id === null ? "public" : "private",
          owned: r.owner_id === res.locals.ownerId,
        },
      })),
  ),
);
app.put("/api/logs/:id", (req, res) => {
  try {
    const log = logSchema.parse(req.body);
    if (log.id !== req.params.id) throw new Error("Log ID mismatch");
    const owner = db
      .prepare("SELECT owner_id FROM brew_logs WHERE id=?")
      .get(log.id);
    if (owner && owner.owner_id !== res.locals.ownerId)
      return res
        .status(403)
        .json({ error: "This brew log belongs to another workspace." });
    predict(log.recipe, catalog);
    for (const d of log.descriptors) {
      if (!catalog.vocabulary.some((v) => v.id === d.descriptor))
        throw new Error("Unknown descriptor");
      const ids = [
        log.recipe.yeastId,
        ...log.recipe.grains.map((g) => g.ingredientId),
        ...log.recipe.hops.map((h) => h.ingredientId),
      ];
      if (!ids.includes(d.ingredientId))
        throw new Error(
          "Tasting attribution must refer to an ingredient in this brew.",
        );
      d.id = log.id + "-note-" + log.descriptors.indexOf(d);
    }
    db.exec("BEGIN");
    try {
      const existing = db
        .prepare("SELECT document FROM brew_logs WHERE id=?")
        .get(log.id);
      if (existing) {
        const old = JSON.parse(existing.document as string);
        for (const d of old.descriptors)
          db.prepare(
            "DELETE FROM flavor_descriptors WHERE id=? AND source_type=?",
          ).run(d.id, "user");
      }
      for (const d of log.descriptors)
        db.prepare(
          "INSERT INTO flavor_descriptors(id,ingredient_id,descriptor,intensity,usage_context,context,source_type,confidence,note,source) VALUES (?,?,?,?,?,?,?,?,?,?)",
        ).run(
          d.id,
          d.ingredientId,
          d.descriptor,
          d.intensity,
          d.usageContext,
          JSON.stringify(d.context),
          "user",
          d.confidence,
          d.note,
          JSON.stringify(d.source),
        );
      db.prepare(
        "INSERT INTO brew_logs(id,recipe_id,date,document,owner_id) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET recipe_id=excluded.recipe_id,date=excluded.date,document=excluded.document",
      ).run(
        log.id,
        log.recipe.id,
        log.date,
        JSON.stringify(log),
        res.locals.ownerId,
      );
      db.exec("COMMIT");
      res.json({ ...log, access: { visibility: "private", owned: true } });
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  } catch (e) {
    res
      .status(400)
      .json({ error: e instanceof Error ? e.message : "Invalid brew log" });
  }
});
if (existsSync("dist/index.html")) {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
}
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(400).json({ error: err.message });
  },
);
const host =
  process.env.HOST ??
  (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const server = app.listen(Number(process.env.PORT ?? 3001), host, () => {
  const address = server.address();
  console.log(
    `BrewMaster API: http://${host}:${typeof address === "object" ? address?.port : process.env.PORT}`,
  );
});
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
