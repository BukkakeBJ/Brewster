import { useMemo, useState } from "react";
import {
  Search,
  BookOpen,
  Copy,
  ArrowUpRight,
  Download,
  Plus,
} from "lucide-react";
import type { Catalog, Recipe } from "../engine/types";
import {
  recipeBookEntries,
  filterBook,
  copyBookRecipe,
  type BookEntry,
} from "../engine/recipeBook";
import {
  predict,
  beerColor,
  lToGal,
  kgToLb,
  cToF,
  G_PER_OZ,
} from "../engine/calculations";
import { Tag } from "./ui";
import { download, exportBeerXML } from "../io";
export default function RecipeBook({
  saved,
  drafts,
  catalog: c,
  us,
  onOpen,
  onNew,
}: {
  saved: Recipe[];
  drafts: Record<string, Recipe>;
  catalog: Catalog;
  us: boolean;
  onOpen: (r: Recipe) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState(""),
    [collection, setCollection] = useState("all"),
    [styleId, setStyleId] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [sort, setSort] = useState("collection");
  const entries = useMemo(
    () => recipeBookEntries(saved, drafts),
    [saved, drafts],
  );
  const filtered = filterBook(entries, c, { query, collection, styleId });
  if (sort === "name")
    filtered.sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));
  const counts = {
    all: entries.length,
    mine: entries.filter((e) => e.collection === "mine").length,
    draft: entries.filter((e) => e.collection === "draft").length,
    starter: entries.filter((e) => e.collection === "starter").length,
  };
  const styleIds = [...new Set(entries.map((e) => e.recipe.styleId))];
  const open = (e: BookEntry, copy = false) =>
    onOpen(copy ? copyBookRecipe(e.recipe, crypto.randomUUID()) : e.recipe);
  return (
    <>
      <div className="book-intro">
        <div>
          <BookOpen size={22} />
          <p>
            Start with a recipe, then make it yours. Saved recipes live in
            SQLite; unsaved drafts stay in this browser. Starter originals and
            published adaptations are labeled.
          </p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={15} /> New recipe
        </button>
      </div>
      <div className="book-tabs" role="group" aria-label="Recipe collections">
        {[
          ["all", "All recipes"],
          ["starter", "Starter collection"],
          ["mine", "My recipes"],
          ["draft", "Drafts"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={collection === key}
            onClick={() => setCollection(key)}
          >
            {label}
            <span>{counts[key as keyof typeof counts]}</span>
          </button>
        ))}
      </div>
      <div className="book-search">
        <Search size={17} />
        <input
          aria-label="Search recipe book"
          placeholder="Search recipes, styles, ingredients, or tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filter recipe book by style"
          value={styleId}
          onChange={(e) => setStyleId(e.target.value)}
        >
          <option value="">All styles</option>
          {styleIds.map((id) => (
            <option key={id} value={id}>
              {c.styles.find((s) => s.id === id)?.name ?? "Freeform"}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort recipe book"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="collection">My work first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      <p className="book-count">
        {filtered.length} recipe{filtered.length === 1 ? "" : "s"} · Numbers are
        calculated predictions; descriptions are intended flavor directions.
      </p>
      <div className="book-grid">
        {filtered.map((entry) => {
          const r = entry.recipe;
          let prediction;
          try {
            prediction = predict(r, c);
          } catch {
            return (
              <article className="panel" key={entry.id}>
                <h3>{r.name}</h3>
                <p className="muted">
                  Ingredient references or settings need attention.
                </p>
                <button className="text-button" onClick={() => open(entry)}>
                  Open to review
                </button>
              </article>
            );
          }
          const expanded = selected === entry.id;
          const y = c.yeasts.find((y) => y.id === r.yeastId)!;
          const total = r.grains.reduce((s, g) => s + g.kg, 0);
          return (
            <article
              className={"recipe-book-card" + (expanded ? " expanded" : "")}
              key={entry.id}
            >
              <div className="book-card-heading">
                <div>
                  <Tag
                    tone={
                      entry.collection === "starter"
                        ? "subjective"
                        : "objective"
                    }
                  >
                    {entry.collection === "starter"
                      ? r.origin?.kind === "published-adaptation"
                        ? "PUBLISHED ADAPTATION"
                        : "ORIGINAL STARTER"
                      : entry.collection === "draft"
                        ? "UNSAVED DRAFT"
                        : entry.unsaved
                          ? "SAVED · UNSAVED EDITS"
                          : "MY SAVED RECIPE"}
                  </Tag>
                  <h2>{r.name}</h2>
                  <p>
                    {c.styles.find((s) => s.id === r.styleId)?.name ??
                      "Freeform recipe"}{" "}
                    · {(us ? lToGal(r.batchL) : r.batchL).toFixed(1)}{" "}
                    {us ? "gal" : "L"}
                  </p>
                </div>
                <div
                  className="book-beer"
                  aria-label={`Approximate beer color, ${prediction.srm.toFixed(1)} SRM`}
                  style={{ background: beerColor(prediction.srm) }}
                >
                  <i />
                </div>
              </div>
              <p className="book-description">
                {r.description ||
                  "Your own recipe. Open it in the editor to add a description and brewing notes."}
              </p>
              <div className="book-stats">
                <div>
                  <strong>
                    {prediction.abv.toFixed(1)}
                    <small>%</small>
                  </strong>
                  <span>ABV</span>
                </div>
                <div>
                  <strong>{prediction.ibu.toFixed(0)}</strong>
                  <span>IBU</span>
                </div>
                <div>
                  <strong>{prediction.srm.toFixed(1)}</strong>
                  <span>SRM</span>
                </div>
                <Tag tone="objective">CALCULATED</Tag>
              </div>
              <div className="book-tags">
                {r.tags?.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <div className="book-card-actions">
                <button
                  className="button primary"
                  onClick={() => open(entry, entry.collection === "starter")}
                >
                  {entry.collection === "starter" ? (
                    <Copy size={14} />
                  ) : (
                    <ArrowUpRight size={14} />
                  )}
                  {entry.collection === "starter"
                    ? "Use a copy"
                    : entry.collection === "draft"
                      ? "Resume draft"
                      : "Open recipe"}
                </button>
                <button
                  className="button secondary"
                  aria-expanded={expanded}
                  onClick={() => setSelected(expanded ? null : entry.id)}
                >
                  {expanded ? "Hide details" : "View recipe"}
                </button>
                {entry.collection !== "starter" && (
                  <button
                    className="icon-button"
                    aria-label={`Duplicate ${r.name}`}
                    onClick={() => open(entry, true)}
                  >
                    <Copy size={16} />
                  </button>
                )}
              </div>
              {expanded && (
                <div className="book-recipe-details">
                  <div className="book-detail-columns">
                    <div>
                      <h3>Grain bill</h3>
                      {r.grains.map((g, i) => (
                        <p key={i}>
                          <b>
                            {c.malts.find((m) => m.id === g.ingredientId)!.name}
                          </b>
                          <span>
                            {(us ? kgToLb(g.kg) : g.kg).toFixed(2)}{" "}
                            {us ? "lb" : "kg"} ·{" "}
                            {total ? ((100 * g.kg) / total).toFixed(1) : "0"}%
                          </span>
                        </p>
                      ))}
                      <h3>Hop schedule</h3>
                      {r.hops.map((h, i) => (
                        <p key={i}>
                          <b>
                            {c.hops.find((x) => x.id === h.ingredientId)!.name}
                          </b>
                          <span>
                            {(us ? h.grams / G_PER_OZ : h.grams).toFixed(
                              us ? 2 : 0,
                            )}{" "}
                            {us ? "oz" : "g"} · {h.use} ·{" "}
                            {h.use === "dry hop"
                              ? (h.minutes / 1440).toFixed(1) + " days"
                              : h.minutes + " min"}
                          </span>
                        </p>
                      ))}
                    </div>
                    <div>
                      <h3>Yeast & process</h3>
                      <p>
                        {y.lab} {y.code} · {y.name}
                      </p>
                      <p>
                        Mash {(us ? cToF(r.mashC) : r.mashC).toFixed(1)}{" "}
                        {us ? "°F" : "°C"} for {r.mashMinutes} min
                      </p>
                      <p>
                        Ferment{" "}
                        {(us ? cToF(r.fermentC) : r.fermentC).toFixed(1)}{" "}
                        {us ? "°F" : "°C"}
                      </p>
                      <p>
                        Boil {r.boilMinutes} min · Efficiency {r.efficiency}%
                      </p>
                      <p>
                        OG {prediction.og.toFixed(3)} · FG{" "}
                        {prediction.fg.toFixed(3)}
                      </p>
                      {prediction.warnings.map((w) => (
                        <p className="book-warning" key={w}>
                          {w}
                        </p>
                      ))}
                    </div>
                  </div>
                  {r.notes && (
                    <>
                      <h3>Brewing notes & assumptions</h3>
                      <p className="book-notes">{r.notes}</p>
                    </>
                  )}
                  {r.origin && (
                    <div className="book-source">
                      <h3>Recipe provenance</h3>
                      <p>
                        {r.origin.author} · {r.origin.title}
                      </p>
                      <p>{r.origin.adaptations}</p>
                      {r.origin.url && (
                        <a href={r.origin.url} target="_blank" rel="noreferrer">
                          Read the published source ↗
                        </a>
                      )}
                      {r.origin.accessed && (
                        <small>Source checked {r.origin.accessed}</small>
                      )}
                    </div>
                  )}
                  <div className="book-export">
                    <button
                      className="text-button"
                      onClick={() =>
                        download(r.name + ".json", JSON.stringify(r, null, 2))
                      }
                    >
                      <Download size={14} /> JSON
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        download(
                          r.name + ".xml",
                          exportBeerXML(r, c),
                          "application/xml",
                        )
                      }
                    >
                      <Download size={14} /> BeerXML
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <h3>
            {collection === "mine"
              ? "Your recipe collection starts here."
              : "No matching recipes."}
          </h3>
          <p>
            {collection === "mine"
              ? "Save a recipe from the editor and it will appear here."
              : "Try another search or clear the style filter."}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery("");
              setStyleId("");
              setCollection("all");
            }}
          >
            Browse all recipes
          </button>
        </div>
      )}
    </>
  );
}
