import { useRef, useState, useEffect } from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";
import type { Catalog, Recipe, Target } from "../engine/types";
import type { Candidate } from "../engine/solver";
import { defaultTarget } from "../defaults";
import { Field, Section, Tag, HelpLabel, InfoTip } from "./ui";
import { Radar } from "./FlavorPanel";
import { L_PER_GAL, lToGal, predict } from "../engine/calculations";
import designHelp from "../../data/design-help.json";
import {
  closestStyles,
  matchStyleToTargets,
  selectDesignStyle,
} from "../engine/styleMatch";
import IngredientMatches from "./IngredientMatches";
import HopCharacterHelp from "./HopCharacterHelp";
import hopDirections from "../../data/hop-flavor-directions.json";
import { starterRecipes } from "../engine/recipeBook";
import { flavorPredict } from "../engine/flavor";
import { recipeDesignBrief, styleFlavorBrief } from "../engine/recommendations";
import { alphabetical, searchByName } from "../engine/search";
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
  const [autoStyle, setAutoStyle] = useState(true);
  const help = designHelp.fields as Record<string, string>;
  const flavorHelp = (id: string, label: string) =>
    `${(designHelp.flavors as Record<string, string>)[id] ?? `${label} is a sensory descriptor.`} ${help["Flavor intensity"]}`;
  const [t, setT] = useState<Target>(() =>
      matchStyleToTargets(defaultTarget, c),
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
  useEffect(() => {
    if (!fromRecipe) return;
    worker.current?.terminate();
    setBusy(false);
    setResults([]);
    setError("");
    setAutoStyle(true);
    setT(
      matchStyleToTargets(
        recipeDesignBrief(fromRecipe, c, defaultTarget, userWeight),
        c,
      ),
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
            <div className="help-option">
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
                />{" "}
                Automatically match style to numeric targets
              </label>
              <InfoTip
                label="Automatic style matching"
                content={help["Automatic style matching"]}
              />
            </div>
            {fromRecipe && (
              <p className="muted">
                Starting from {fromRecipe.name}. Change targets to explore a
                redesigned copy; your current draft stays in the Recipe Book.
                The new version keeps your name and experiment notes, but may
                use different ingredients.
              </p>
            )}
            <div className="field">
              <HelpLabel
                label="Base style · legacy numeric ranges"
                help={help["Base style · legacy numeric ranges"]}
                htmlFor="design-option-0"
              />
              <select
                id="design-option-0"
                aria-label="Design beer style"
                value={t.styleId}
                onChange={(e) => {
                  setAutoStyle(false);
                  update(selectDesignStyle(t, e.target.value), false);
                }}
              >
                <option value="">Freeform / no style penalty</option>
                {alphabetical(c.styles, (s) => s.name).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="design-style-match">
              <p role="status">
                {autoStyle
                  ? `Closest numeric match: ${bestStyle?.style.name ?? "No comparable style"}`
                  : `Manual style: ${selectedStyle?.name ?? "Freeform"}`}
              </p>
              {selectedStyle && (
                <p>
                  {selectedStyle.abv.join("–")}% ABV ·{" "}
                  {selectedStyle.ibu.join("–")} IBU ·{" "}
                  {selectedStyle.srm.join("–")} SRM
                </p>
              )}
              <p className="muted">
                {autoStyle
                  ? bestStyle?.withinRanges
                    ? "Targets fit the compared ranges. Flavor and process may differ."
                    : "Closest available style; some targets fall outside its ranges. Flavor and process may differ."
                  : "Style locked. Enable automatic matching to follow target edits."}
              </p>
              {selectedStyle && (
                <a
                  href={selectedStyle.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Legacy numeric reference ↗
                </a>
              )}
            </div>
            <div className="field-grid">
              <Field
                label="Target ABV"
                help={help["Target ABV"]}
                suffix="%"
                value={t.abv}
                min={0.5}
                max={18}
                onChange={(n) => update({ abv: n })}
              />
              <Field
                label="Target bitterness"
                help={help["Target bitterness"]}
                suffix="IBU"
                value={t.ibu}
                min={0}
                max={150}
                step={1}
                onChange={(n) => update({ ibu: n })}
              />
              <div className="optional-color">
                <div className="field-label">
                  Color (optional)
                  <InfoTip
                    label="Target color"
                    content={help["Target color"]}
                  />
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={t.srm !== undefined}
                    onChange={(e) =>
                      update({
                        srm: e.target.checked
                          ? lastColorTarget.current
                          : undefined,
                      })
                    }
                  />
                  Set a color target
                </label>
                {t.srm === undefined ? (
                  <p className="muted">
                    Any color · Predicted SRM is still shown. Color does not
                    affect style matching or recipe scoring.
                  </p>
                ) : (
                  <Field
                    label="Target color"
                    suffix="SRM"
                    value={t.srm}
                    min={1}
                    max={60}
                    onChange={(n) => update({ srm: n })}
                  />
                )}
              </div>
              <Field
                label="Post-boil batch"
                help={help["Post-boil batch"]}
                suffix={us ? "gal" : "L"}
                value={us ? lToGal(t.batchL) : t.batchL}
                min={us ? 0.3 : 1}
                onChange={(n) => update({ batchL: us ? n * L_PER_GAL : n })}
              />
              <Field
                label="Efficiency"
                help={help["Efficiency"]}
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
              <div className="help-option">
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
                <InfoTip
                  label="Add OG / FG constraints"
                  content={help["Add OG / FG constraints"]}
                />
              </div>
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
              <div className="field-grid">
                <Field
                  label="Boil time"
                  help={help["Boil time"]}
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
                  help={help["Boil-off"]}
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
                  help={help["Transfer loss"]}
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
          <Section
            title="Find your flavor"
            eyebrow="02 / SUBJECTIVE TARGETS"
            action={
              <InfoTip
                label="Flavor intensity"
                content={help["Flavor intensity"]}
              />
            }
          >
            <Tag>ESTIMATED SENSORY INTENSITY · 0–5</Tag>
            <p className="muted">
              Choose a hop direction or set individual flavors below. Automatic
              style matching keeps your numeric and flavor targets. Choose the
              style starting-point button only when you want to replace flavor
              targets.
            </p>
            <div className="help-action">
              <InfoTip
                label="Use style flavor starting point"
                content={help["Use style flavor starting point"]}
              />
              <button
                className="button secondary"
                disabled={!starterRecipes.some((r) => r.styleId === t.styleId)}
                onClick={() => applyStyleFlavor()}
              >
                Use style flavor starting point
              </button>
            </div>
            <div className="field">
              <HelpLabel
                label="Hop flavor direction"
                help={help["Hop flavor direction"]}
                htmlFor="design-option-1"
              />
              <select
                id="design-option-1"
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
            </div>
            <div className="field">
              <HelpLabel
                label="Evaluate hop character for"
                help={help["Evaluate hop character for"]}
                htmlFor="design-option-2"
              />
              <select
                id="design-option-2"
                aria-label="Hop recommendation use"
                aria-describedby="hop-character-explanation"
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
            </div>
            <HopCharacterHelp focus={t.hopFocus ?? "aroma"} />
            <div className="help-option">
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
              <InfoTip
                label="Hop evidence filter"
                content={help["Hop evidence filter"]}
              />
            </div>
            <div className="flavor-sliders">
              {c.vocabulary
                .filter((v) => v.axis)
                .map((v) => (
                  <div className="flavor-slider-row" key={v.id}>
                    <HelpLabel
                      label={v.label}
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
                  </div>
                ))}
            </div>
            <div className="descriptor-constraints">
              <div className="field">
                <HelpLabel
                  label="Must include descriptor"
                  help={help["Must include descriptor"]}
                  htmlFor="design-option-3"
                />
                <select
                  id="design-option-3"
                  aria-label="Must include descriptor"
                  value=""
                  onChange={(e) => toggle("must", e.target.value)}
                >
                  <option value="">Choose a descriptor…</option>
                  {alphabetical(c.vocabulary, (v) => v.label).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <HelpLabel
                  label="Avoid descriptor"
                  help={help["Avoid descriptor"]}
                  htmlFor="design-option-4"
                />
                <select
                  id="design-option-4"
                  aria-label="Avoid descriptor"
                  value=""
                  onChange={(e) => toggle("avoid", e.target.value)}
                >
                  <option value="">Choose a descriptor…</option>
                  {alphabetical(c.vocabulary, (v) => v.label).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
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
                  <div className="flavor-slider-row" key={v.id}>
                    <HelpLabel
                      label={v.label}
                      help={flavorHelp(v.id, v.label)}
                      htmlFor={`design-flavor-${v.id}`}
                    />
                    <input
                      id={`design-flavor-${v.id}`}
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
                  </div>
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
          <Section
            title="Your constraints"
            eyebrow="03 / WHAT YOU HAVE"
            action={
              <InfoTip
                label="On hand & excluded ingredients"
                content={help["On hand & excluded ingredients"]}
              />
            }
          >
            <div className="field-grid">
              <div className="field">
                <HelpLabel
                  label="Yeast form"
                  help={help["Yeast form"]}
                  htmlFor="design-option-5"
                />
                <select
                  id="design-option-5"
                  aria-label="Yeast form"
                  value={t.yeastForm}
                  onChange={(e) =>
                    update({ yeastForm: e.target.value as Target["yeastForm"] })
                  }
                >
                  <option value="any">Dry or liquid</option>
                  <option value="dry">Dry only</option>
                  <option value="liquid">Liquid only</option>
                </select>
              </div>
              <div className="field">
                <HelpLabel
                  label="Budget approach"
                  help={help["Budget approach"]}
                  htmlFor="design-option-6"
                />
                <select
                  id="design-option-6"
                  aria-label="Budget approach"
                  value={t.budget}
                  onChange={(e) =>
                    update({ budget: e.target.value as Target["budget"] })
                  }
                >
                  <option value="any">Unrestricted</option>
                  <option value="economy">Economy · dry yeast, hop cap</option>
                </select>
              </div>
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
          </Section>
        </div>
        <aside className="design-preview">
          <Section
            title="Your flavor brief"
            eyebrow="THE BEER YOU IMAGINE"
            action={
              <InfoTip
                label="Find my recipes"
                content={help["Find my recipes"]}
              />
            }
          >
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
                            additives: fromRecipe.additives?.map((a) => ({
                              ...a,
                              amount:
                                (a.amount * b.recipe.batchL) /
                                fromRecipe.batchL,
                            })),
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
