import { useRef, useState, useEffect } from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";
import type { Catalog, Recipe, Target } from "../engine/types";
import type { Candidate } from "../engine/solver";
import { defaultTarget } from "../defaults";
import { Field, Section, Tag } from "./ui";
import { Radar } from "./FlavorPanel";
import { L_PER_GAL, lToGal, predict } from "../engine/calculations";
import IngredientMatches from "./IngredientMatches";
import hopDirections from "../../data/hop-flavor-directions.json";
import { starterRecipes } from "../engine/recipeBook";
import { flavorPredict } from "../engine/flavor";
import { recipeDesignBrief, styleFlavorBrief } from "../engine/recommendations";
export default function Design({
  catalog: c,
  onOpen,
  us,
  userWeight = 1,
  fromRecipe,
}: {
  catalog: Catalog;
  onOpen: (r: Recipe) => void;
  us: boolean;
  userWeight?: number;
  fromRecipe?: Recipe;
}) {
  const [t, setT] = useState<Target>(defaultTarget),
    [results, setResults] = useState<Candidate[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false),
    [ingredientQuery, setIngredientQuery] = useState("");
  const applyStyleFlavor = (id = t.styleId) => {
    const recipe = starterRecipes.find((r) => r.styleId === id);
    if (recipe)
      update({
        flavors: styleFlavorBrief(
          flavorPredict(recipe, c, predict(recipe, c), userWeight).scores,
          c,
        ),
      });
  };
  const worker = useRef<Worker | null>(null);
  useEffect(() => {
    if (!fromRecipe) return;
    worker.current?.terminate();
    setBusy(false);
    setResults([]);
    setError("");
    setT(recipeDesignBrief(fromRecipe, c, defaultTarget, userWeight));
    setStale(true);
  }, [fromRecipe]);
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    worker.current?.terminate();
    setBusy(false);
    setStale(true);
  }, [c, userWeight]);
  const update = (patch: Partial<Target>) => {
    worker.current?.terminate();
    setBusy(false);
    setT({ ...t, ...patch });
    setStale(true);
  };
  const toggle = (key: "must" | "avoid" | "onHand" | "exclude", id: string) =>
    update({
      [key]: t[key].includes(id)
        ? t[key].filter((i) => i !== id)
        : [...t[key], id],
    });
  function run() {
    worker.current?.terminate();
    setBusy(true);
    setError("");
    setStale(false);
    worker.current = new Worker(
      new URL("../solver.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current.onmessage = (e) => {
      setBusy(false);
      if (e.data.error) setError(e.data.error);
      else {
        setResults(e.data.candidates);
        if (!e.data.candidates.length)
          setError(
            "No recipe met the hard ingredient and grist constraints. Relax constraints and try again.",
          );
      }
      worker.current?.terminate();
    };
    worker.current.onerror = () => {
      setBusy(false);
      setError("Solver could not run. Please try again.");
      worker.current?.terminate();
    };
    worker.current.postMessage({ target: t, catalog: c, userWeight });
  }
  return (
    <>
      <div className="design-grid">
        <div className="design-inputs">
          <Section title="Define your beer" eyebrow="01 / MEASURABLE TARGETS">
            {fromRecipe && (
              <p className="muted">
                Starting from {fromRecipe.name}. Change targets to explore a
                redesigned copy; your current draft stays in the Recipe Book.
                The new version keeps your name and experiment notes, but may
                use different ingredients.
              </p>
            )}
            <label className="field">
              <span>Base style · legacy numeric ranges</span>
              <select
                aria-label="Design beer style"
                value={t.styleId}
                onChange={(e) => {
                  const s = c.styles.find((s) => s.id === e.target.value);
                  update({
                    styleId: e.target.value,
                    hopChoices: [],
                    baseMaltChoice: undefined,
                    yeastChoice: undefined,
                    ...(s
                      ? {
                          abv: (s.abv[0] + s.abv[1]) / 2,
                          ibu: (s.ibu[0] + s.ibu[1]) / 2,
                          srm: (s.srm[0] + s.srm[1]) / 2,
                        }
                      : {}),
                  });
                }}
              >
                <option value="">Freeform / no style penalty</option>
                {c.styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="field-grid">
              <Field
                label="Target ABV"
                suffix="%"
                value={t.abv}
                min={0.5}
                max={18}
                onChange={(n) => update({ abv: n })}
              />
              <Field
                label="Target bitterness"
                suffix="IBU"
                value={t.ibu}
                min={0}
                max={150}
                step={1}
                onChange={(n) => update({ ibu: n })}
              />
              <Field
                label="Target color"
                suffix="SRM"
                value={t.srm}
                min={1}
                max={60}
                onChange={(n) => update({ srm: n })}
              />
              <Field
                label="Post-boil batch"
                suffix={us ? "gal" : "L"}
                value={us ? lToGal(t.batchL) : t.batchL}
                min={us ? 0.3 : 1}
                onChange={(n) => update({ batchL: us ? n * L_PER_GAL : n })}
              />
              <Field
                label="Efficiency"
                suffix="%"
                value={t.efficiency}
                min={1}
                max={100}
                step={1}
                onChange={(n) => update({ efficiency: n })}
              />
            </div>
            <details className="advanced">
              <summary>Gravity ranges & equipment</summary>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={!!t.og}
                  onChange={(e) =>
                    update({
                      og: e.target.checked ? [1.045, 1.06] : undefined,
                      fg: e.target.checked ? [1.008, 1.015] : undefined,
                    })
                  }
                />{" "}
                Add OG / FG constraints
              </label>
              {t.og && t.fg && (
                <div className="field-grid">
                  <Field
                    label="OG minimum"
                    value={t.og[0]}
                    min={1.001}
                    max={t.og[1]}
                    step={0.001}
                    onChange={(n) => update({ og: [n, t.og![1]] })}
                  />
                  <Field
                    label="OG maximum"
                    value={t.og[1]}
                    min={t.og[0]}
                    max={1.2}
                    step={0.001}
                    onChange={(n) => update({ og: [t.og![0], n] })}
                  />
                  <Field
                    label="FG minimum"
                    value={t.fg[0]}
                    min={1}
                    max={t.fg[1]}
                    step={0.001}
                    onChange={(n) => update({ fg: [n, t.fg![1]] })}
                  />
                  <Field
                    label="FG maximum"
                    value={t.fg[1]}
                    min={t.fg[0]}
                    max={1.08}
                    step={0.001}
                    onChange={(n) => update({ fg: [t.fg![0], n] })}
                  />
                </div>
              )}
              <div className="field-grid">
                <Field
                  label="Boil time"
                  suffix="min"
                  value={t.equipment.boilMinutes}
                  min={0}
                  max={180}
                  step={1}
                  onChange={(n) =>
                    update({ equipment: { ...t.equipment, boilMinutes: n } })
                  }
                />
                <Field
                  label="Boil-off"
                  suffix={us ? "gal/h" : "L/h"}
                  value={
                    us
                      ? lToGal(t.equipment.boilOffLPerHour)
                      : t.equipment.boilOffLPerHour
                  }
                  min={0}
                  onChange={(n) =>
                    update({
                      equipment: {
                        ...t.equipment,
                        boilOffLPerHour: us ? n * L_PER_GAL : n,
                      },
                    })
                  }
                />
                <Field
                  label="Transfer loss"
                  suffix={us ? "gal" : "L"}
                  value={us ? lToGal(t.equipment.lossL) : t.equipment.lossL}
                  min={0}
                  onChange={(n) =>
                    update({
                      equipment: {
                        ...t.equipment,
                        lossL: us ? n * L_PER_GAL : n,
                      },
                    })
                  }
                />
              </div>
            </details>
          </Section>
          <Section title="Find your flavor" eyebrow="02 / SUBJECTIVE TARGETS">
            <Tag>ESTIMATED SENSORY INTENSITY · 0–5</Tag>
            <p className="muted">
              Choose a hop direction or set individual flavors below. Style
              changes update numeric ranges; your custom flavor targets stay
              until you choose a new starting point.
            </p>
            <button
              className="button secondary"
              disabled={!starterRecipes.some((r) => r.styleId === t.styleId)}
              onClick={() => applyStyleFlavor()}
            >
              Use style flavor starting point
            </button>
            <label className="field">
              <span>Hop flavor direction</span>
              <select
                aria-label="Hop flavor direction"
                value=""
                onChange={(e) => {
                  const direction = hopDirections.find(
                    (d) => d.id === e.target.value,
                  );
                  if (direction) {
                    const hopIds = c.vocabulary
                      .filter((v) => v.parent === "hops")
                      .map((v) => v.id);
                    update({
                      flavors: {
                        ...t.flavors,
                        ...Object.fromEntries(hopIds.map((id) => [id, 0])),
                        ...Object.fromEntries(
                          Object.entries(direction.flavors).filter(
                            ([, value]) => typeof value === "number",
                          ),
                        ),
                      },
                      matchHopFlavor: true,
                      hopChoices: [],
                    });
                  }
                }}
              >
                <option value="">Choose a direction or customize below…</option>
                {hopDirections.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Evaluate hop character for</span>
              <select
                aria-label="Hop recommendation use"
                value={t.hopFocus ?? "aroma"}
                onChange={(e) =>
                  update({
                    hopFocus: e.target.value as Target["hopFocus"],
                    hopChoices: [],
                  })
                }
              >
                <option value="bittering">Kettle bittering</option>
                <option value="flavor">Late-boil flavor</option>
                <option value="aroma">Whirlpool aroma</option>
                <option value="dry hop">Dry hopping</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.matchHopFlavor ?? false}
                onChange={(e) =>
                  update({ matchHopFlavor: e.target.checked, hopChoices: [] })
                }
              />{" "}
              Only suggest hops with evidence for at least one positive
              hop-flavor target
            </label>
            <div className="flavor-sliders">
              {c.vocabulary
                .filter((v) => v.axis)
                .map((v) => (
                  <label key={v.id}>
                    <span>{v.label}</span>
                    <input
                      aria-label={`Target flavor ${v.label}`}
                      type="range"
                      min="0"
                      max="5"
                      step=".25"
                      value={t.flavors[v.id] ?? 0}
                      onChange={(e) =>
                        update({
                          flavors: {
                            ...t.flavors,
                            [v.id]: Number(e.target.value),
                          },
                        })
                      }
                    />
                    <b>{(t.flavors[v.id] ?? 0).toFixed(1)}</b>
                  </label>
                ))}
            </div>
            <div className="descriptor-constraints">
              <label className="field">
                <span>Must include descriptor</span>
                <select
                  value=""
                  onChange={(e) => toggle("must", e.target.value)}
                >
                  <option value="">Choose a descriptor…</option>
                  {c.vocabulary.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Avoid descriptor</span>
                <select
                  value=""
                  onChange={(e) => toggle("avoid", e.target.value)}
                >
                  <option value="">Choose a descriptor…</option>
                  {c.vocabulary.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="filter-chips">
              {t.must.map((a) => (
                <button onClick={() => toggle("must", a)} key={"must" + a}>
                  Must: {a} ×
                </button>
              ))}
              {t.avoid.map((a) => (
                <button onClick={() => toggle("avoid", a)} key={"avoid" + a}>
                  Avoid: {a} ×
                </button>
              ))}
            </div>
          </Section>
          <details className="advanced hop-flavor-detail">
            <summary>Fine-tune individual hop flavors</summary>
            <div className="flavor-sliders">
              {c.vocabulary
                .filter((v) => v.parent === "hops" && !v.axis)
                .map((v) => (
                  <label key={v.id}>
                    <span>{v.label}</span>
                    <input
                      aria-label={`Target hop flavor ${v.label}`}
                      type="range"
                      min="0"
                      max="5"
                      step=".25"
                      value={t.flavors[v.id] ?? 0}
                      onChange={(e) =>
                        update({
                          flavors: {
                            ...t.flavors,
                            [v.id]: Number(e.target.value),
                          },
                        })
                      }
                    />
                    <b>{(t.flavors[v.id] ?? 0).toFixed(1)}</b>
                  </label>
                ))}
            </div>
          </details>
          <IngredientMatches
            target={t}
            catalog={c}
            us={us}
            update={update}
            userWeight={userWeight}
          />
          <Section title="Your constraints" eyebrow="03 / WHAT YOU HAVE">
            <div className="field-grid">
              <label className="field">
                <span>Yeast form</span>
                <select
                  value={t.yeastForm}
                  onChange={(e) =>
                    update({ yeastForm: e.target.value as Target["yeastForm"] })
                  }
                >
                  <option value="any">Dry or liquid</option>
                  <option value="dry">Dry only</option>
                  <option value="liquid">Liquid only</option>
                </select>
              </label>
              <label className="field">
                <span>Budget approach</span>
                <select
                  value={t.budget}
                  onChange={(e) =>
                    update({ budget: e.target.value as Target["budget"] })
                  }
                >
                  <option value="any">Unrestricted</option>
                  <option value="economy">Economy · dry yeast, hop cap</option>
                </select>
              </label>
            </div>
            <details className="advanced">
              <summary>On hand & excluded ingredients</summary>
              <p className="muted">
                An empty on-hand list permits all ingredients. Once selected, it
                becomes a strict allowlist: include a base malt, hops and yeast.
                Quantities on hand are not tracked.
              </p>
              <input
                className="ingredient-search"
                placeholder="Search ingredients for constraints…"
                value={ingredientQuery}
                onChange={(e) => setIngredientQuery(e.target.value)}
              />
              {[...c.malts, ...c.hops, ...c.yeasts]
                .filter(
                  (i) =>
                    ingredientQuery &&
                    `${i.name} ${i.kind}`
                      .toLowerCase()
                      .includes(ingredientQuery.toLowerCase()),
                )
                .slice(0, 12)
                .map((i) => (
                  <div className="constraint-row" key={i.id}>
                    <span>
                      {i.name} <small>{i.kind}</small>
                    </span>
                    <label>
                      <input
                        type="checkbox"
                        checked={t.onHand.includes(i.id)}
                        onChange={() => toggle("onHand", i.id)}
                      />{" "}
                      On hand
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={t.exclude.includes(i.id)}
                        onChange={() => toggle("exclude", i.id)}
                      />{" "}
                      Exclude
                    </label>
                  </div>
                ))}
              <div className="filter-chips">
                {(["onHand", "exclude"] as const).flatMap((k) =>
                  t[k].map((id) => (
                    <button key={k + id} onClick={() => toggle(k, id)}>
                      {k === "onHand" ? "On hand" : "Exclude"}:{" "}
                      {
                        [...c.malts, ...c.hops, ...c.yeasts].find(
                          (i) => i.id === id,
                        )?.name
                      }{" "}
                      ×
                    </button>
                  )),
                )}
              </div>
            </details>
            <details className="advanced">
              <summary>Optimization weights</summary>
              <div className="field-grid">
                {(["flavor", "numbers", "style"] as const).map((k) => (
                  <Field
                    key={k}
                    label={k + " weight"}
                    value={t.weights[k]}
                    min={0}
                    max={10}
                    onChange={(n) =>
                      update({ weights: { ...t.weights, [k]: n } })
                    }
                  />
                ))}
              </div>
            </details>
          </Section>
        </div>
        <aside className="design-preview">
          <Section title="Your flavor brief" eyebrow="THE BEER YOU IMAGINE">
            <Radar scores={t.flavors} />
            <p className="muted">
              Numeric targets are calculated with brewing formulas. Flavor
              targets are compared against a transparent consensus model.
            </p>
            <button
              className="button primary solve-button"
              disabled={busy}
              onClick={run}
            >
              <Sparkles size={16} />
              {busy ? "Exploring recipes…" : "Find my recipes"}
            </button>
            <p className="solver-note">
              18 ingredient combinations · deterministic local search · no
              external AI
            </p>
            {busy && (
              <button
                className="text-button"
                onClick={() => {
                  worker.current?.terminate();
                  setBusy(false);
                }}
              >
                Cancel search
              </button>
            )}
          </Section>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <div className="design-tip">
            <span>THE BREWER’S NOTE</span>
            <h3>Balance is a conversation.</h3>
            <p>
              A bigger aroma doesn’t have to mean a bigger bitterness. Whirlpool
              and dry-hop additions can help you find both.
            </p>
          </div>
        </aside>
      </div>
      {results.length > 0 && (
        <div className="solver-results">
          <div className="results-heading">
            <div className="eyebrow">EXPLORE YOUR POSSIBILITIES</div>
            <h2>Three starting points.</h2>
            <p className="muted">
              Ranked by weighted distance. Lower scores are closer, not
              guaranteed perfect matches.
              {stale
                ? " Targets changed — run the solver again to refresh these results."
                : ""}
            </p>
          </div>
          <div className="candidate-grid">
            {results.map((b, i) => (
              <article className="candidate panel" key={b.recipe.id}>
                <div className="eyebrow">
                  0{i + 1} / {i === 0 ? "CLOSEST MATCH" : "ANOTHER APPROACH"}
                </div>
                <h3>{b.recipe.name}</h3>
                <div className="candidate-numbers">
                  <b>
                    {b.prediction.abv.toFixed(1)}
                    <small>% ABV</small>
                  </b>
                  <b>
                    {b.prediction.ibu.toFixed(0)}
                    <small>IBU</small>
                  </b>
                  <b>
                    {b.prediction.srm.toFixed(1)}
                    <small>SRM</small>
                  </b>
                </div>
                <Tag tone="objective">CALCULATED</Tag>
                <Radar scores={b.flavor.scores} target={t.flavors} />
                <Tag>SUBJECTIVE ESTIMATE</Tag>
                <div className="candidate-reasons">
                  {b.explanations.map((x) => (
                    <p key={x}>{x}</p>
                  ))}
                </div>
                <details className="advanced">
                  <summary>
                    Tradeoffs & target conflicts ({b.tradeoffs.length})
                  </summary>
                  {b.tradeoffs.length ? (
                    b.tradeoffs.map((x) => <p key={x}>{x}</p>)
                  ) : (
                    <p>
                      No numeric target conflicts within planning tolerances.
                      Sensory results remain estimates.
                    </p>
                  )}
                  <p>Objective score: {b.score.toFixed(3)}</p>
                </details>
                <button
                  className="button primary"
                  onClick={() =>
                    onOpen({
                      ...b.recipe,
                      id: crypto.randomUUID(),
                      ...(fromRecipe
                        ? {
                            name: fromRecipe.name.slice(0, 180) + " (redesign)",
                            description: fromRecipe.description,
                            notes: fromRecipe.notes,
                            processNotes: structuredClone(
                              fromRecipe.processNotes,
                            ),
                            tags: [
                              ...(fromRecipe.tags ?? []).slice(0, 19),
                              "redesign",
                            ],
                          }
                        : {}),
                    })
                  }
                >
                  Make it my own <ArrowUpRight size={14} />
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
