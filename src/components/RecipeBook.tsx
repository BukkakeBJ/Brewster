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
  isCraftRecipe,
  beerStyleCoverage,
  recipeOriginLabel,
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
import { SavedProcessNotes } from "./RecipeNotes";
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
    [collection, setCollection] = useState("starter"),
    [brewery, setBrewery] = useState(""),
    [originKind, setOriginKind] = useState(""),
    [styleId, setStyleId] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [sort, setSort] = useState("collection");
  const entries = useMemo(
    () => recipeBookEntries(saved, drafts),
    [saved, drafts],
  );
  const filtered = filterBook(entries, c, {
    query,
    collection,
    styleId,
    brewery,
    originKind,
  });
  if (sort === "name")
    filtered.sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));
  const counts = {
    all: entries.length,
    craft: entries.filter(
      (e) => e.collection === "starter" && isCraftRecipe(e.recipe),
    ).length,
    mine: entries.filter((e) => e.collection === "mine").length,
    draft: entries.filter((e) => e.collection === "draft").length,
    starter: entries.filter((e) => e.collection === "starter").length,
  };
  const breweries = [
    ...new Set(
      entries
        .map((e) => e.recipe.origin?.brewery)
        .filter((s): s is string => !!s),
    ),
  ].sort();
  const coverage = beerStyleCoverage(c);
  const covered = coverage.filter((s) => s.recipes.length > 0).length;
  const styleIds = [...new Set(entries.map((e) => e.recipe.styleId))].sort(
    (a, b) =>
      (c.styles.find((s) => s.id === a)?.name ?? a).localeCompare(
        c.styles.find((s) => s.id === b)?.name ?? b,
      ),
  );
  const browseStyle = (id = "") => {
    setCollection("starter");
    setStyleId(id);
    setBrewery("");
    setOriginKind("");
    setQuery("");
  };
  const open = (e: BookEntry, copy = false) =>
    onOpen(copy ? copyBookRecipe(e.recipe, crypto.randomUUID()) : e.recipe);
  return (
    <>
      <div className="book-intro">
        <div>
          <BookOpen size={22} />
          <p>
            Explore familiar brewery beers, published clone recipes and
            independent house approximations. Source badges tell you which is
            which. Your own saved recipes and drafts remain in their
            collections. Every beer style in the catalog has a starting recipe;
            historical brewery inspirations are labeled separately from
            published formulas.
          </p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={15} /> New recipe
        </button>
      </div>
      <div className="book-tabs" role="group" aria-label="Recipe collections">
        {[
          ["all", "All recipes"],
          ["starter", "Style collection"],
          ["craft", "Craft & clones"],
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
      <details className="panel book-coverage">
        <summary>
          {covered} of {coverage.length} beer styles covered · Browse by style
        </summary>
        <p className="muted">
          Coverage includes all beer styles in this app’s legacy reference
          catalog. Cider, mead, perry and honey hybrids are separate. Known
          brewery examples are historical inspirations; original house starters
          fill gaps without claiming a brewery formula.
        </p>
        <button className="text-button" onClick={() => browseStyle()}>
          Show all style recipes
        </button>
        <div className="book-style-list">
          {coverage.map(({ style, recipes }) => (
            <button
              className="text-button"
              key={style.id}
              onClick={() => browseStyle(style.id)}
            >
              {style.name} · {recipes.length} recipe
              {recipes.length === 1 ? "" : "s"}
            </button>
          ))}
        </div>
      </details>
      <div className="book-search">
        <Search size={17} />
        <input
          aria-label="Search recipe book"
          placeholder="Search recipes, styles, ingredients, or tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Sort recipe book"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="collection">My work first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      <div className="book-filters">
        <label className="field">
          <span>Beer style</span>
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
        </label>
        <label className="field">
          <span>Brewery</span>
          <select
            aria-label="Filter recipe book by brewery"
            value={brewery}
            onChange={(e) => setBrewery(e.target.value)}
          >
            <option value="">All breweries</option>
            {breweries.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Recipe source</span>
          <select
            aria-label="Filter recipe book by source type"
            value={originKind}
            onChange={(e) => setOriginKind(e.target.value)}
          >
            <option value="">All source types</option>
            <option value="published-adaptation">
              Brewery recipe · adapted
            </option>
            <option value="published-clone">Published clone · adapted</option>
            <option value="clone-inspired">House clone · approximate</option>
            <option value="original-starter">Original starter</option>
          </select>
        </label>
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
                      ? recipeOriginLabel(r)
                      : entry.collection === "draft"
                        ? "UNSAVED DRAFT"
                        : entry.unsaved
                          ? "SAVED · UNSAVED EDITS"
                          : "MY SAVED RECIPE"}
                  </Tag>
                  <h2>{r.name}</h2>
                  <p>
                    {r.origin?.brewery && <>{r.origin.brewery} · </>}
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
              {entry.collection !== "starter" &&
                r.origin &&
                r.origin.kind !== "original-starter" && (
                  <Tag>{recipeOriginLabel(r)}</Tag>
                )}
              {r.tags?.includes("special process") && (
                <p className="muted" role="note">
                  Base beer estimates only. Follow the brewing notes for
                  additions, souring, aging, blending or concentration; those
                  effects are outside the calculations.
                </p>
              )}
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
                  <SavedProcessNotes recipe={r} />
                  {r.origin && (
                    <div className="book-source">
                      <h3>Recipe provenance</h3>
                      <p>
                        {r.origin.author} · {r.origin.title}
                      </p>
                      <Tag>{recipeOriginLabel(r)}</Tag>
                      <p>{r.origin.adaptations}</p>
                      {r.origin.referenceSpecs && (
                        <div className="source-reference-specs">
                          <Tag tone="objective">PUBLISHED SOURCE NUMBERS</Tag>
                          <p>
                            Reference values from the linked source, separate
                            from this recipe’s calculated predictions.
                          </p>
                          <dl>
                            {Object.entries(r.origin.referenceSpecs).map(
                              ([key, value]) => (
                                <div key={key}>
                                  <dt>
                                    {key === "ibuAtLeast"
                                      ? "IBU (at least)"
                                      : key.toUpperCase()}
                                  </dt>
                                  <dd>
                                    {value}
                                    {key === "abv"
                                      ? "%"
                                      : key === "ibuAtLeast"
                                        ? "+"
                                        : ""}
                                  </dd>
                                </div>
                              ),
                            )}
                          </dl>
                        </div>
                      )}
                      {r.origin.url && (
                        <a href={r.origin.url} target="_blank" rel="noreferrer">
                          {r.origin.kind === "clone-inspired"
                            ? "Read source reference ↗"
                            : "Read published recipe ↗"}
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
              setBrewery("");
              setOriginKind("");
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
