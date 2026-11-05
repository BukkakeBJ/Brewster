import { IngredientInfo } from "./IngredientPicker";
import { useState } from "react";
import { Sparkles, Plus, ArrowRight } from "lucide-react";
import type { Catalog, Recipe } from "../engine/types";
import {
  startingPoints,
  styleMalts,
  applyStartingPoint,
  suggestionImpact,
  type SuggestionKind,
  type HopRole,
} from "../engine/suggestions";
import { kgToLb, G_PER_OZ } from "../engine/calculations";
import { Tag } from "./ui";
export default function Suggestions({
  kind,
  recipe: r,
  catalog: c,
  onChange,
  us,
}: {
  kind: SuggestionKind;
  recipe: Recipe;
  catalog: Catalog;
  onChange: (r: Recipe) => void;
  us: boolean;
}) {
  const [open, setOpen] = useState(kind === "malt"),
    [mode, setMode] = useState<"match" | "popular">("match"),
    [role, setRole] = useState<HopRole>("aroma"),
    [group, setGroup] = useState("all"),
    [limit, setLimit] = useState(3),
    [status, setStatus] = useState("");
  const [lastChange, setLastChange] = useState<{
    before: Recipe;
    after: Recipe;
  } | null>(null);
  const canUndo =
    lastChange !== null &&
    JSON.stringify(r) === JSON.stringify(lastChange.after);
  const options = startingPoints(
    kind,
    c,
    r,
    mode,
    kind === "hop" ? role : undefined,
    group,
  );
  const styleName = styleMalts(r.styleId, c).length
    ? c.styles.find((s) => s.id === r.styleId)?.name
    : undefined;
  const forStyle = options.filter((s) => s.item.fromStyle).length;
  const shown = Math.max(limit, Math.min(forStyle, 6));
  const signed = (n: number, digits = 1) =>
    (n >= 0 ? "+" : "") + n.toFixed(digits);
  return (
    <div className="suggestions">
      <button
        className="suggestions-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Sparkles size={15} />
        <span>
          {kind === "hop"
            ? "Suggested hops"
            : `Suggested malts${styleName ? ` for ${styleName}` : ""}`}
          <small>
            {styleName
              ? "From the Recipe Book's recipes for this style"
              : "Popular starting points & ideas for this recipe"}
          </small>
        </span>
        <b>{open ? "−" : "+"}</b>
      </button>
      {open && (
        <div className="suggestions-body">
          <div
            className="suggestion-modes"
            role="group"
            aria-label={`${kind} suggestion ordering`}
          >
            <button
              aria-pressed={mode === "match"}
              onClick={() => {
                setMode("match");
                setLimit(3);
              }}
            >
              {kind === "malt" ? "For this style" : "For this recipe"}
            </button>
            <button
              aria-pressed={mode === "popular"}
              onClick={() => {
                setMode("popular");
                setLimit(3);
              }}
            >
              Popular starting points
            </button>
          </div>
          <p className="suggestion-disclaimer">
            {kind === "malt"
              ? "Malts used in recipes for your beer style come first; the amount preview shows the calculated change."
              : "Editorial guidance, not measured popularity or flavor. “For this recipe” prioritizes its style family; the amount preview shows the calculated change."}
          </p>
          <label className="field">
            <span>
              {kind === "hop"
                ? "What should the hop do?"
                : "What should the malt add?"}
            </span>
            {kind === "hop" ? (
              <select
                aria-label="Suggested hop role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as HopRole);
                  setLimit(3);
                }}
              >
                <option value="aroma">Late flavor / aroma · whirlpool</option>
                <option value="bittering">Kettle bittering</option>
                <option value="dry hop">Dry hopping</option>
              </select>
            ) : (
              <select
                aria-label="Suggested malt role"
                value={group}
                onChange={(e) => {
                  setGroup(e.target.value);
                  setLimit(3);
                }}
              >
                {[
                  ["all", "All malt roles"],
                  ["base", "Base / backbone"],
                  ["malt character", "Malt character"],
                  ["caramel", "Caramel"],
                  ["body", "Body / texture"],
                  ["roast", "Roast / color"],
                  ["sugar", "Sugars"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            )}
          </label>
          <div className="suggestion-cards">
            {options.slice(0, shown).map((s) => {
              let next: Recipe | undefined,
                problem = "";
              try {
                next = applyStartingPoint(
                  r,
                  c,
                  kind,
                  s.item.ingredientId,
                  role,
                  s.item,
                );
              } catch (e) {
                problem = e instanceof Error ? e.message : "Unavailable";
              }
              let delta: ReturnType<typeof suggestionImpact> | undefined;
              if (next)
                try {
                  delta = suggestionImpact(r, next, c);
                } catch {
                  problem =
                    "Fix the current recipe settings to calculate a preview.";
                  next = undefined;
                }
              const addition = kind === "hop" ? next?.hops.at(-1) : undefined;
              const malt =
                kind === "malt"
                  ? c.malts.find((m) => m.id === s.item.ingredientId)
                  : undefined;
              const newGrain = next?.grains.find(
                (g) => g.ingredientId === s.item.ingredientId,
              );
              const replaces =
                kind === "malt" && next?.grains.length === r.grains.length;
              const source =
                s.item.source ??
                (kind === "hop"
                  ? c.hops.find((h) => h.id === s.item.ingredientId)!.source
                  : malt!.source);
              return (
                <article key={s.item.ingredientId} className="suggestion-card">
                  <div className="suggestion-card-head">
                    <div className="ingredient-name-with-info">
                      <h3>{s.name}</h3>
                      <IngredientInfo
                        item={
                          (kind === "hop"
                            ? c.hops.find((h) => h.id === s.item.ingredientId)
                            : malt)!
                        }
                        catalog={c}
                        us={us}
                      />
                    </div>
                    {s.alreadyUsed && <Tag tone="neutral">IN RECIPE</Tag>}
                  </div>
                  <Tag>
                    {s.item.fromStyle
                      ? "USED IN THIS STYLE"
                      : "EDITORIAL SUGGESTION"}
                  </Tag>
                  <p>{s.reason}</p>
                  <small className="suggestion-spec">
                    {kind === "hop"
                      ? `Reference alpha acids: ${c.hops.find((h) => h.id === s.item.ingredientId)!.alpha.join("–")}%`
                      : `Reference: ${malt!.lovibond} °L · ${malt!.ppg.toFixed(1)} PPG`}
                  </small>
                  {next && (
                    <>
                      <div className="suggested-dose">
                        {addition
                          ? `${us ? (addition.grams / G_PER_OZ).toFixed(2) : addition.grams.toFixed(0)} ${us ? "oz" : "g"} · ${addition.use} · ${addition.use === "dry hop" ? "3 days" : addition.minutes + " min"}`
                          : `${replaces ? "Replace current base with" : "Add"} ${newGrain ? (us ? kgToLb(newGrain.kg) : newGrain.kg).toFixed(2) : "—"} ${us ? "lb" : "kg"}${!replaces && r.grains.length ? ` · ${s.item.percent}% suggested grist share` : ""}`}
                      </div>
                      {delta && (
                        <div className="suggestion-impact">
                          <Tag tone="objective">CALCULATED CHANGE</Tag>
                          <span>
                            {signed(delta.abv)} ABV points · {signed(delta.ibu)}{" "}
                            IBU · {signed(delta.srm)} SRM
                          </span>
                        </div>
                      )}
                      <button
                        className="button secondary"
                        aria-label={`${replaces ? "Use as base" : "Add"} ${s.name}`}
                        onClick={() => {
                          if (next) {
                            setLastChange({ before: r, after: next });
                            onChange(next);
                            setStatus(
                              `${s.name} ${replaces ? "replaced the base malt" : "added to the recipe"}.`,
                            );
                          }
                        }}
                      >
                        {replaces ? (
                          <ArrowRight size={13} />
                        ) : (
                          <Plus size={13} />
                        )}{" "}
                        {replaces ? "Use as base malt" : "Add to recipe"}
                      </button>
                    </>
                  )}
                  {problem && (
                    <small className="suggestion-problem">{problem}</small>
                  )}
                  <a href={source.url} target="_blank" rel="noreferrer">
                    Ingredient reference ↗
                  </a>
                </article>
              );
            })}
          </div>
          {!options.length && (
            <p className="muted">
              No malts of this kind are typical for this style. Try another
              role, or see the popular starting points.
            </p>
          )}
          {options.length > shown && (
            <button
              className="text-button"
              onClick={() => setLimit(options.length)}
            >
              Show all {options.length} suggestions
            </button>
          )}
          <p className="suggestion-disclaimer">
            Hop doses are starting trials scaled to the batch, not automatic IBU
            targets. Malt additions increase total grist; a base swap adjusts
            mass by PPG to preserve gravity contribution. Review the updated
            recipe before brewing.
          </p>
          {canUndo && (
            <button
              className="text-button"
              onClick={() => {
                onChange(lastChange!.before);
                setLastChange(null);
                setStatus("Suggestion undone.");
              }}
            >
              Undo last suggestion
            </button>
          )}
          {status && (
            <p className="suggestion-status" role="status">
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
