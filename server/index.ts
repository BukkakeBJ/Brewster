import express from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { db } from "./db";
import { recipeSchema, logSchema } from "../src/validation";
import { predict } from "../src/engine/calculations";
import { catalog } from "../src/catalog";
const app = express();
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (
    origin &&
    !/^http:\/\/(127\.0\.0\.1|localhost):(5173|3001|3002)$/.test(origin)
  )
    return res.status(403).json({ error: "Origin not allowed" });
  next();
});
app.use(express.json({ limit: "2mb" }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/recipes", (_req, res) =>
  res.json(
    db
      .prepare("SELECT document FROM recipes ORDER BY updated_at DESC")
      .all()
      .map((r) => JSON.parse(r.document as string)),
  ),
);
app.put("/api/recipes/:id", (req, res) => {
  try {
    const r = recipeSchema.parse(req.body);
    if (r.id !== req.params.id) throw new Error("Recipe ID mismatch");
    predict(r, catalog);
    db.prepare(
      "INSERT INTO recipes(id,name,document,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,document=excluded.document,updated_at=excluded.updated_at",
    ).run(r.id, r.name, JSON.stringify(r), new Date().toISOString());
    res.json(r);
  } catch (e) {
    res
      .status(400)
      .json({ error: e instanceof Error ? e.message : "Invalid recipe" });
  }
});
app.delete("/api/recipes/:id", (req, res) => {
  db.prepare("DELETE FROM recipes WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});
app.get("/api/logs", (_req, res) =>
  res.json(
    db
      .prepare("SELECT document FROM brew_logs ORDER BY date DESC")
      .all()
      .map((r) => JSON.parse(r.document as string)),
  ),
);
app.put("/api/logs/:id", (req, res) => {
  try {
    const log = logSchema.parse(req.body);
    if (log.id !== req.params.id) throw new Error("Log ID mismatch");
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
        "INSERT INTO brew_logs(id,recipe_id,date,document) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET recipe_id=excluded.recipe_id,date=excluded.date,document=excluded.document",
      ).run(log.id, log.recipe.id, log.date, JSON.stringify(log));
      db.exec("COMMIT");
      res.json(log);
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
app.listen(Number(process.env.PORT ?? 3001), "127.0.0.1", () =>
  console.log("Brew Designer API: http://127.0.0.1:3001"),
);
