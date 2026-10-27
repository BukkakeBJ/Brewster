import { useMemo, useState } from "react";
import { Search, Copy, ArrowUpRight, Download } from "lucide-react";
import BrandMark from "./BrandMark";
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
  lToGal,
  kgToLb,
  cToF,
  G_PER_OZ,
} from "../engine/calculations";
import { Tag } from "./ui";
import BeerGlass from "./BeerGlass";
import { ReadOnlyAdditives } from "./RecipeAdditives";
import { additiveModelNote } from "../engine/additives";
import { SavedProcessNotes } from "./RecipeNotes";
import FlavorPanel from "./FlavorPanel";
import { recipeProfile } from "../engine/recipeProfile";
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
  onOpen: (r: Recipe, startAtWater?: boolean) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState(""),
    [chosenCollection, setCollection] = useState(""),
    [brewery, setBrewery] = useState(""),
    [originKind, setOriginKind] = useState(""),
    [styleId, setStyleId] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [sort, setSort] = useState("name");
  const entries = useMemo(
    () => recipeBookEntries(saved, drafts),
    [saved, drafts],
  );
  const hasOwn = entries.some((e) => e.collection === "mine");
  const collection = chosenCollection || (hasOwn ? "mine" : "starter");
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
    community: entries.filter((e) => e.access?.visibility === "public").length,
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
  const open = (e: BookEntry, copy = false) => {
    const makeCopy = copy || e.collection === "community";
    onOpen(
      makeCopy ? copyBookRecipe(e.recipe, crypto.randomUUID()) : e.recipe,
      makeCopy,
    );
  };
  return (
    <>
      <div className="book-tabs" role="group" aria-label="Recipe collections">
        {(
          [
            ["mine", "My recipes"],
            ["draft", "Unsaved drafts"],
            ["starter", "Starter recipes"],
            ["craft", "Brewery clones"],
            ["community", "Community"],
            ["all", "Everything"],
          ] as const
        )
          .filter(
            ([key]) =>
              !["draft", "community"].includes(key) ||
              counts[key] > 0 ||
              collection === key,
          )
          .map(([key, label]) => (
            <button
              key={key}
              aria-pressed={collection === key}
              onClick={() => setCollection(key)}
            >
              {label}
              <span>{counts[key]}</span>
            </button>
          ))}
      </div>
      <div className="book-search">
        <label className="search-box">
          <Search size={17} />
          <input
            aria-label="Search recipe book"
            placeholder="Search by name, style, ingredient…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter recipe book by style"
          value={styleId}
          onChange={(e) => setStyleId(e.target.value)}
        >
          <option value="">All styles</option>
          {styleIds.map((id) => (
            <option key={id} value={id}>
              {c.styles.find((s) => s.id === id)?.name ?? "No particular style"}
            </option>
          ))}
        </select>
      </div>
      <details className="advanced book-filters">
        <summary>More filters</summary>
        <div className="field-grid">
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
          <label className="field">
            <span>Sort</span>
            <select
              aria-label="Sort recipe book"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="name">Name A–Z</option>
              <option value="collection">My work first</option>
            </select>
          </label>
        </div>
        <p className="muted">
          {covered} of {coverage.length} beer styles have a starter recipe.
          Brewery clones are adaptations of published recipes, not official
          formulas.
        </p>
      </details>
      <p className="book-count">
        {filtered.length} recipe{filtered.length === 1 ? "" : "s"}
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
          const profile = recipeProfile(r, c, prediction);
          const expanded = selected === entry.id;
          const y = c.yeasts.find((y) => y.id === r.yeastId)!;
          const total = r.grains.reduce((s, g) => s + g.kg, 0);
          return (
            <article
              className={"recipe-book-card" + (expanded ? " expanded" : "")}
              key={entry.id}
            >
              <Tag
                tone={
                  entry.collection === "starter" ? "subjective" : "objective"
                }
              >
                {entry.collection === "starter"
                  ? recipeOriginLabel(r)
                  : entry.collection === "draft"
                    ? "Unsaved draft"
                    : entry.collection === "community"
                      ? "Community"
                      : `${entry.access?.visibility === "public" ? "Mine · shared" : "Mine · private"}${entry.unsaved ? " · unsaved edits" : ""}`}
              </Tag>
              <div className="book-card-heading">
                <BeerGlass srm={prediction.srm} styleId={r.styleId} size="md" />
                <div>
                  <h3>{r.name}</h3>
                  <p>
                    {r.origin?.brewery && <>{r.origin.brewery} · </>}
                    {c.styles.find((s) => s.id === r.styleId)?.name ??
                      "Freeform recipe"}{" "}
                    · {(us ? lToGal(r.batchL) : r.batchL).toFixed(1)}{" "}
                    {us ? "gal" : "L"}
                  </p>
                </div>
              </div>
              <p className="book-description">
                {r.description ||
                  "Your own recipe. Open it in the editor to add a description and brewing notes."}
              </p>
              <div className="book-card-notices">
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
                {!!r.additives?.length && (
                  <p className="additive-model-note" role="note">
                    {additiveModelNote}
                  </p>
                )}
              </div>
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
              </div>
              <div className="book-flavor-chips">
                {profile.descriptors.slice(0, 5).map((d) => (
                  <span key={d.id}>{d.label}</span>
                ))}
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
                    ? "Brew this"
                    : entry.collection === "community"
                      ? "Make a copy"
                      : entry.collection === "draft"
                        ? "Resume"
                        : "Open"}
                </button>
                <button
                  className="button secondary"
                  aria-expanded={expanded}
                  onClick={() => setSelected(expanded ? null : entry.id)}
                >
                  {expanded ? "Hide" : "Details"}
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
                  <div className="book-details-overview">
                    <div className="book-detail-columns">
                      <div>
                        <h3>Grain bill</h3>
                        {r.grains.map((g, i) => (
                          <p key={i}>
                            <b>
                              {
                                c.malts.find((m) => m.id === g.ingredientId)!
                                  .name
                              }
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
                              {
                                c.hops.find((x) => x.id === h.ingredientId)!
                                  .name
                              }
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
                    <aside className="book-flavor-aside">
                      <FlavorPanel
                        flavor={profile.flavor}
                        catalog={c}
                        readOnly
                      />
                    </aside>
                  </div>
                  {r.notes && (
                    <>
                      <h3>Brewing notes & assumptions</h3>
                      <p className="book-notes">{r.notes}</p>
                    </>
                  )}
                  <ReadOnlyAdditives recipe={r} us={us} />
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
