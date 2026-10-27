import React, { useRef, useState, useEffect } from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";
import type { Catalog, Recipe, Target } from "../engine/types";
import type { Candidate } from "../engine/solver";
import { defaultTarget } from "../defaults";
import { Field, Section, HelpLabel, InfoTip, RangeField } from "./ui";
import { Radar } from "./FlavorPanel";
import { predict } from "../engine/calculations";
import designHelp from "../../data/design-help.json";
import {
  closestStyles,
  matchStyleToTargets,
  selectDesignStyle,
} from "../engine/styleMatch";
import IngredientMatches from "./IngredientMatches";
import hopDirections from "../../data/hop-flavor-directions.json";
import { starterRecipes } from "../engine/recipeBook";
import { flavorPredict } from "../engine/flavor";
import { recipeDesignBrief, styleFlavorBrief } from "../engine/recommendations";
import { alphabetical, searchByName } from "../engine/search";
import { targetSchema } from "../validation";
import { waterSettings } from "../engine/waterPlan";
export default function Design({
  catalog: c,
  onOpen,
  us,
  userWeight = 1,
  fromRecipe,
  waterRecipe,
  onTargetChange,
  onConfirm,
  resetKey = 0,
}: {
  catalog: Catalog;
  onOpen: (r: Recipe) => void;
  us: boolean;
  userWeight?: number;
  fromRecipe?: Recipe;
  waterRecipe?: Recipe;
  onTargetChange?: (target: Target) => void;
  onConfirm?: (target: Target) => void;
  resetKey?: number;
}) {
  const [autoStyle, setAutoStyle] = useState(true);
  const help = designHelp.fields as Record<string, string>;
  const flavorHelp = (id: string, label: string) =>
    `${(designHelp.flavors as Record<string, string>)[id] ?? `${label} is a sensory descriptor.`} ${help["Flavor intensity"]}`;
  const [t, setT] = useState<Target>(() =>
      (() => {
        try {
          return targetSchema.parse(
            JSON.parse(
              localStorage.getItem(`brew-goals:${waterRecipe?.id}`) ?? "null",
            ),
          );
        } catch {
          return (
            waterRecipe?.designTargets ?? matchStyleToTargets(defaultTarget, c)
          );
        }
      })(),
    ),
    [results, setResults] = useState<Candidate[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false),
    [ingredientQuery, setIngredientQuery] = useState("");
  const lastColorTarget = useRef(defaultTarget.srm ?? 6);
  useEffect(() => {
    if (t.srm !== undefined) lastColorTarget.current = t.srm;
  }, [t.srm]);
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
  const goalRecipeId = useRef(waterRecipe?.id);
  useEffect(() => {
    if (!waterRecipe || goalRecipeId.current === waterRecipe.id) return;
    goalRecipeId.current = waterRecipe.id;
    let restored: Target | undefined;
    try {
      restored = targetSchema.parse(
        JSON.parse(
          localStorage.getItem(`brew-goals:${waterRecipe.id}`) ?? "null",
        ),
      );
    } catch {}
    if (restored ?? waterRecipe.designTargets)
      setT(restored ?? waterRecipe.designTargets!);
  }, [waterRecipe?.id]);
  useEffect(() => {
    if (!waterRecipe || goalRecipeId.current !== waterRecipe.id) return;
    try {
      localStorage.setItem(`brew-goals:${waterRecipe.id}`, JSON.stringify(t));
    } catch {}
  }, [t]);
  useEffect(() => {
    onTargetChange?.(t);
  }, [t, onTargetChange]);
  useEffect(() => {
    if (!waterRecipe) return;
    worker.current?.terminate();
    setBusy(false);
    setStale(true);
    setT((current) => ({
      ...current,
      batchL: waterRecipe.batchL,
      efficiency: waterRecipe.efficiency,
      waterPlan: waterSettings(waterRecipe, c),
      equipment: {
        boilMinutes: waterRecipe.boilMinutes,
        boilOffLPerHour: waterRecipe.boilOffLPerHour,
        lossL: waterRecipe.lossL,
      },
    }));
  }, [waterRecipe, c]);
  useEffect(() => {
    if (!resetKey) return;
    worker.current?.terminate();
    setBusy(false);
    setResults([]);
    setAutoStyle(true);
    setT(
      matchStyleToTargets(
        {
          ...structuredClone(defaultTarget),
          ...(waterRecipe
            ? {
                batchL: waterRecipe.batchL,
                efficiency: waterRecipe.efficiency,
                waterPlan: waterSettings(waterRecipe, c),
                equipment: {
                  boilMinutes: waterRecipe.boilMinutes,
                  boilOffLPerHour: waterRecipe.boilOffLPerHour,
                  lossL: waterRecipe.lossL,
                },
              }
            : {}),
        },
        c,
      ),
    );
  }, [resetKey]);
  useEffect(() => {
    if (!fromRecipe) return;
    worker.current?.terminate();
    setBusy(false);
    setResults([]);
    setError("");
    setAutoStyle(false);
    setT(
      fromRecipe.designTargets ?? {
        ...recipeDesignBrief(fromRecipe, c, defaultTarget, userWeight),
        waterPlan: waterSettings(fromRecipe, c),
      },
    );
    setStale(true);
  }, [fromRecipe]);
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    worker.current?.terminate();
    setBusy(false);
    setStale(true);
  }, [c, userWeight]);
  const update = (patch: Partial<Target>, matchAutomatically = autoStyle) => {
    worker.current?.terminate();
    setBusy(false);
    setT((current) => {
      const next = { ...current, ...patch };
      return matchAutomatically &&
        ["abv", "ibu", "srm", "og", "fg"].some((key) => key in patch)
        ? matchStyleToTargets(next, c)
        : next;
    });
    setStale(true);
  };
  const styleMatches = closestStyles(t, c);
  const selectedStyle = c.styles.find((s) => s.id === t.styleId);
  const bestStyle = styleMatches[0];
  const toggle = (key: "must" | "avoid" | "onHand" | "exclude", id: string) =>
    update({
      [key]: t[key].includes(id)
        ? t[key].filter((i) => i !== id)
        : [...t[key], id],
    });
  const openCandidate = (candidate: Recipe) =>
    onOpen({
      ...candidate,
      id: crypto.randomUUID(),
      designTargets: t,
      ...(fromRecipe
        ? {
            name: fromRecipe.name,
            description: fromRecipe.description,
            notes: fromRecipe.notes,
            additives: fromRecipe.additives?.map((a) => ({
              ...a,
              amount: (a.amount * candidate.batchL) / fromRecipe.batchL,
            })),
            processNotes: structuredClone(fromRecipe.processNotes),
            tags: fromRecipe.tags,
          }
        : {}),
    });
  function run(continueToMalts = false) {
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
        setTimeout(
          () =>
            document
              .getElementById("suggested-recipes")
              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
          50,
        );
        if (continueToMalts && e.data.candidates.length)
          openCandidate(e.data.candidates[0].recipe);
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
  const chooseStyle = (id: string) => {
    setAutoStyle(false);
    const style = c.styles.find((s) => s.id === id);
    const mid = (r: [number, number]) => +((r[0] + r[1]) / 2).toFixed(1);
    update(
      style
        ? {
            ...selectDesignStyle(t, id),
            abv: mid(style.abv),
            ibu: Math.round(mid(style.ibu)),
            ...(t.srm === undefined ? {} : { srm: mid(style.srm) }),
          }
        : selectDesignStyle(t, id),
      false,
    );
    if (style) applyStyleFlavor(id);
  };
  const mainFlavors = [
    "bready",
    "caramel",
    "roast",
    "citrus",
    "tropical",
    "pine",
    "floral",
    "body",
  ];
  const extraFlavors = c.vocabulary.filter(
    (v) => v.axis && !mainFlavors.includes(v.id),
  );
  const flavorLabels: Record<string, string> = {
    bready: "Bready / malty",
    caramel: "Caramel / toffee",
    roast: "Roasty / coffee",
    body: "Full body",
  };
  const flavorControls = (items: Catalog["vocabulary"]) => (
    <div className="flavor-sliders">
      {items.map((v) => (
        <div className="flavor-slider-row" key={v.id}>
          <HelpLabel
            label={flavorLabels[v.id] ?? v.label}
            help={flavorHelp(v.id, v.label)}
            htmlFor={`design-flavor-${v.id}`}
          />
          <input
            id={`design-flavor-${v.id}`}
            aria-label={`Target flavor ${v.label}`}
            type="range"
            min="0"
            max="5"
            step=".25"
            value={t.flavors[v.id] ?? 0}
            style={
              {
                "--fill": `${((t.flavors[v.id] ?? 0) / 5) * 100}%`,
              } as React.CSSProperties
            }
            onChange={(e) =>
              update({
                flavors: { ...t.flavors, [v.id]: Number(e.target.value) },
              })
            }
          />
          <b>{intensityWord(t.flavors[v.id] ?? 0)}</b>
        </div>
      ))}
    </div>
  );
  const band = (k: "abv" | "ibu" | "srm") =>
    selectedStyle?.[k] as [number, number] | undefined;
  return (
    <>
      <div className="goals-grid">
        <div className="goals-inputs">
          <Section title="Beer style">
            {fromRecipe && (
              <p className="notice">
                These goals come from <b>{fromRecipe.name}</b>. Change them
                here; your ingredients only change if you pick a suggested
                recipe below.
              </p>
            )}
            <label className="field">
              <span>Style</span>
              <select
                id="design-option-0"
                aria-label="Design beer style"
                value={t.styleId}
                onChange={(e) => chooseStyle(e.target.value)}
              >
                <option value="">No particular style</option>
                {alphabetical(c.styles, (s) => s.name).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedStyle ? (
              <p className="style-summary" role="status">
                <b>{selectedStyle.name}</b> usually runs{" "}
                {selectedStyle.abv.join("–")}% ABV,{" "}
                {selectedStyle.ibu.join("–")} IBU and{" "}
                {selectedStyle.srm.join("–")} SRM.
                {autoStyle && bestStyle && !bestStyle.withinRanges
                  ? " Your targets are outside this range."
                  : ""}
              </p>
            ) : (
              <p className="muted">
                No style limits. Set your own numbers below.
              </p>
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                aria-label="Automatic style matching"
                checked={autoStyle}
                onChange={(e) => {
                  setAutoStyle(e.target.checked);
                  if (e.target.checked)
                    update({ styleId: bestStyle?.style.id ?? t.styleId });
                }}
              />
              Suggest the closest style as I change the numbers
            </label>
          </Section>
          <Section title="Targets">
            <RangeField
              label="Alcohol"
              help={help["Target ABV"]}
              unit="% ABV"
              value={t.abv}
              min={2}
              max={14}
              step={0.1}
              band={band("abv")}
              onChange={(n) => update({ abv: n })}
            />
            <RangeField
              label="Bitterness"
              help={help["Target bitterness"]}
              unit="IBU"
              value={t.ibu}
              min={0}
              max={120}
              step={1}
              band={band("ibu")}
              onChange={(n) => update({ ibu: n })}
            />
            {t.srm === undefined ? (
              <div className="range-field">
                <div className="range-field-head">
                  <span className="field-label">
                    Color
                    <InfoTip
                      label="Target color"
                      content={help["Target color"]}
                    />
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => update({ srm: lastColorTarget.current })}
                  >
                    Set a color goal
                  </button>
                </div>
                <p className="muted">Any color is fine.</p>
              </div>
            ) : (
              <RangeField
                label="Color"
                help={help["Target color"]}
                unit="SRM"
                value={t.srm}
                min={1}
                max={40}
                step={0.5}
                band={band("srm")}
                colorTrack
                onChange={(n) => update({ srm: n })}
                action={
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => update({ srm: undefined })}
                  >
                    Any color
                  </button>
                }
              />
            )}
          </Section>
          <Section title="Flavor">
            <div className="field">
              <span>Hop character</span>
              <div className="chip-row" role="group" aria-label="Hop flavor direction">
                {hopDirections.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    className="chip"
                    onClick={() => {
                      const hopIds = c.vocabulary
                        .filter((v) => v.parent === "hops")
                        .map((v) => v.id);
                      update({
                        flavors: {
                          ...t.flavors,
                          ...Object.fromEntries(hopIds.map((id) => [id, 0])),
                          ...Object.fromEntries(
                            Object.entries(d.flavors).filter(
                              ([, value]) => typeof value === "number",
                            ),
                          ),
                        },
                        matchHopFlavor: true,
                        hopChoices: [],
                      });
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            {flavorControls(
              mainFlavors
                .map((id) => c.vocabulary.find((v) => v.id === id)!)
                .filter(Boolean),
            )}
            <details className="advanced">
              <summary>
                More flavors
                {extraFlavors.some((v) => (t.flavors[v.id] ?? 0) > 0)
                  ? ` · ${extraFlavors.filter((v) => (t.flavors[v.id] ?? 0) > 0).length} set`
                  : ""}
              </summary>
              {flavorControls(alphabetical(extraFlavors, (v) => v.label))}
              <h4>Specific hop flavors</h4>
              {flavorControls(
                c.vocabulary.filter((v) => v.parent === "hops" && !v.axis),
              )}
            </details>
            <details className="advanced">
              <summary>
                Must have / must avoid
                {t.must.length + t.avoid.length
                  ? ` · ${t.must.length + t.avoid.length} set`
                  : ""}
              </summary>
              <div className="field-grid">
                <label className="field">
                  <span>Must taste of</span>
                  <select
                    aria-label="Must include descriptor"
                    value=""
                    onChange={(e) => toggle("must", e.target.value)}
                  >
                    <option value="">Choose a flavor…</option>
                    {alphabetical(c.vocabulary, (v) => v.label).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Must not taste of</span>
                  <select
                    aria-label="Avoid descriptor"
                    value=""
                    onChange={(e) => toggle("avoid", e.target.value)}
                  >
                    <option value="">Choose a flavor…</option>
                    {alphabetical(c.vocabulary, (v) => v.label).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
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
          <details className="panel advanced-panel">
            <summary>
              Ingredient limits & fine-tuning
              {t.onHand.length + t.exclude.length
                ? ` · ${t.onHand.length + t.exclude.length} set`
                : ""}
            </summary>
            <p className="muted">
              Only used when you ask for suggested recipes.
            </p>
            <div className="field-grid">
              <label className="field">
                <span>Yeast form</span>
                <select
                  aria-label="Yeast form"
                  value={t.yeastForm}
                  onChange={(e) =>
                    update({
                      yeastForm: e.target.value as Target["yeastForm"],
                    })
                  }
                >
                  <option value="any">Dry or liquid</option>
                  <option value="dry">Dry only</option>
                  <option value="liquid">Liquid only</option>
                </select>
              </label>
              <label className="field">
                <span>Budget</span>
                <select
                  aria-label="Budget approach"
                  value={t.budget}
                  onChange={(e) =>
                    update({ budget: e.target.value as Target["budget"] })
                  }
                >
                  <option value="any">No limit</option>
                  <option value="economy">Economy · dry yeast, fewer hops</option>
                </select>
              </label>
            </div>
            <h4>Ingredients you have or want to avoid</h4>
            <p className="muted">
              Marking anything "I have it" limits suggestions to those
              ingredients, so include a base malt, a hop and a yeast.
            </p>
            <input
              className="ingredient-search"
              placeholder="Search ingredients…"
              value={ingredientQuery}
              onChange={(e) => setIngredientQuery(e.target.value)}
            />
            {searchByName(
              [...c.malts, ...c.hops, ...c.yeasts],
              ingredientQuery,
              (i) => i.name,
              (i) => i.kind,
            )
              .filter(() => !!ingredientQuery.trim())
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
                    I have it
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={t.exclude.includes(i.id)}
                      onChange={() => toggle("exclude", i.id)}
                    />{" "}
                    Avoid
                  </label>
                </div>
              ))}
            <div className="filter-chips">
              {(["onHand", "exclude"] as const).flatMap((k) =>
                t[k].map((id) => (
                  <button key={k + id} onClick={() => toggle(k, id)}>
                    {k === "onHand" ? "Have" : "Avoid"}:{" "}
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
            <label className="checkbox">
              <input
                type="checkbox"
                checked={t.matchHopFlavor ?? false}
                onChange={(e) =>
                  update({ matchHopFlavor: e.target.checked, hopChoices: [] })
                }
              />
              Only suggest hops known for the hop flavors I chose
            </label>
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
              />
              Set gravity limits
            </label>
            {t.og && t.fg && (
              <div className="field-grid">
                <Field
                  label="OG minimum"
                  help={help["OG minimum"]}
                  value={t.og[0]}
                  min={1.001}
                  max={t.og[1]}
                  step={0.001}
                  onChange={(n) => update({ og: [n, t.og![1]] })}
                />
                <Field
                  label="OG maximum"
                  help={help["OG maximum"]}
                  value={t.og[1]}
                  min={t.og[0]}
                  max={1.2}
                  step={0.001}
                  onChange={(n) => update({ og: [t.og![0], n] })}
                />
                <Field
                  label="FG minimum"
                  help={help["FG minimum"]}
                  value={t.fg[0]}
                  min={1}
                  max={t.fg[1]}
                  step={0.001}
                  onChange={(n) => update({ fg: [n, t.fg![1]] })}
                />
                <Field
                  label="FG maximum"
                  help={help["FG maximum"]}
                  value={t.fg[1]}
                  min={t.fg[0]}
                  max={1.08}
                  step={0.001}
                  onChange={(n) => update({ fg: [t.fg![0], n] })}
                />
              </div>
            )}
            <details className="advanced">
              <summary>What matters most when suggesting</summary>
              <div className="field-grid">
                {(["flavor", "numbers", "style"] as const).map((k) => (
                  <Field
                    key={k}
                    label={k + " weight"}
                    help={help[k + " weight"]}
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
            <details className="advanced">
              <summary>Browse ingredients that fit these goals</summary>
              <IngredientMatches
                target={t}
                catalog={c}
                us={us}
                update={update}
                userWeight={userWeight}
              />
            </details>
          </details>
        </div>
        <aside className="goals-aside">
          <Section title="Your flavor goal">
            <Radar scores={t.flavors} />
            <p className="muted">
              Want a head start? We'll design three recipes that hit these
              goals with your water. Or press <b>Next</b> to choose
              ingredients yourself.
            </p>
            <button
              className="button primary wide"
              disabled={busy}
              onClick={() => run()}
            >
              <Sparkles size={16} />
              {busy ? "Designing recipes…" : "Suggest recipes for me"}
            </button>
            {busy && (
              <button
                className="text-button"
                onClick={() => {
                  worker.current?.terminate();
                  setBusy(false);
                }}
              >
                Cancel
              </button>
            )}
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
          </Section>
        </aside>
      </div>
      {results.length > 0 && (
        <section className="solver-results" id="suggested-recipes">
          <h2>Suggested recipes</h2>
          <p className="muted">
            Ordered by how closely each one matches your goals.
            {stale ? " Your goals changed — suggest again to refresh." : ""}
          </p>
          <div className="candidate-grid">
            {results.map((b, i) => (
              <article className="candidate panel" key={b.recipe.id}>
                <p className="eyebrow">
                  {i === 0 ? "Closest match" : `Option ${i + 1}`}
                </p>
                <h3>{b.recipe.name}</h3>
                <div className="candidate-numbers">
                  <span>
                    <b>{b.prediction.abv.toFixed(1)}%</b> ABV
                  </span>
                  <span>
                    <b>{b.prediction.ibu.toFixed(0)}</b> IBU
                  </span>
                  <span>
                    <b>{b.prediction.srm.toFixed(1)}</b> SRM
                  </span>
                </div>
                <Radar scores={b.flavor.scores} target={t.flavors} />
                <ul className="candidate-reasons">
                  {b.explanations.slice(0, 3).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                {b.tradeoffs.length > 0 && (
                  <details className="advanced">
                    <summary>Trade-offs ({b.tradeoffs.length})</summary>
                    {b.tradeoffs.map((x) => (
                      <p key={x}>{x}</p>
                    ))}
                  </details>
                )}
                <button
                  className="button primary wide"
                  onClick={() => openCandidate(b.recipe)}
                >
                  Use this recipe <ArrowUpRight size={14} />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function intensityWord(n: number) {
  return n === 0
    ? "None"
    : n <= 1
      ? "Hint"
      : n <= 2.25
        ? "Light"
        : n <= 3.5
          ? "Medium"
          : "Strong";
}
