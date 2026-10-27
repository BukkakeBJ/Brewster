import { useEffect, useState, useRef, useLayoutEffect, useMemo } from "react";
import {
  NotebookPen,
  BookOpen,
  BookMarked,
  Copy,
  FlaskConical,
  Download,
  Home as HomeIcon,
  Save,
  Printer,
  Upload,
  Check,
  Plus,
  Wand2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { ensureWorkspace, getJson } from "./api";
import RecipeSharing from "./components/RecipeSharing";
import type { SavedRecipe, SavedBrewLog, Visibility } from "./sharing";
import { catalog as baseCatalog } from "./catalog";
import BrandMark from "./components/BrandMark";
import BuilderHeader from "./components/BuilderHeader";
import BrewLog, { type Preferences } from "./components/BrewLog";
import { calibrate } from "./engine/feedback";
import { recipeSchema } from "./validation";
import RecipeBook from "./components/RecipeBook";
import { createAdditiveAddition } from "./engine/additives";
import RecipeNotes from "./components/RecipeNotes";
import RecipeAdditives from "./components/RecipeAdditives";
import { readDraftBank, copyBookRecipe } from "./engine/recipeBook";
import {
  defaultRecipe,
  defaultRecipeForWater,
  defaultTarget,
} from "./defaults";
import type {
  Recipe,
  Prediction,
  Target,
  Style,
  Catalog,
} from "./engine/types";
import { predict, lToGal } from "./engine/calculations";
import { download, exportBeerXML, importRecipe } from "./io";
import Editor from "./components/Editor";
import Library from "./components/Library";
import Design from "./components/Design";
import FlavorPanel from "./components/FlavorPanel";
import Home from "./components/Home";
import PredictionBar from "./components/PredictionBar";
import BeerGlass from "./components/BeerGlass";
import { colorName } from "./engine/glassware";
import { flavorPredict } from "./engine/flavor";
import { Section, HelpTerm } from "./components/ui";
import { alphabetical } from "./engine/search";
import {
  builderSteps,
  isBuilderStep,
  recipeAtFixedWater,
  type BuilderStep,
} from "./engine/builder";
import { planFromWater, waterSettings } from "./engine/waterPlan";
import WaterPlanner from "./components/WaterPlanner";
import RecipeSummary from "./components/RecipeSummary";
import {
  guidance,
  matchTargetAbv,
  matchTargetIbu,
  type Tip,
} from "./engine/guidance";

type View = "home" | "build" | "book" | "log" | "library";
const views: { id: View; label: string; icon: typeof HomeIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "build", label: "Build", icon: FlaskConical },
  { id: "book", label: "Recipes", icon: BookMarked },
  { id: "log", label: "Brew Log", icon: NotebookPen },
  { id: "library", label: "Ingredients", icon: BookOpen },
];
const isView = (v: string | null): v is View => views.some((x) => x.id === v);

function printBrewSheet() {
  const panels = [
    ...document.querySelectorAll<HTMLDetailsElement>(
      "#builder-recipe details:not([open])",
    ),
  ];
  const restore = () =>
    panels.forEach((panel) => {
      panel.open = false;
    });
  panels.forEach((panel) => {
    panel.open = true;
  });
  window.addEventListener("afterprint", restore, { once: true });
  window.print();
}

/** The numbers each builder step can move, so tips stay relevant to the page. */
const stepTips: Partial<Record<BuilderStep, Tip["key"][]>> = {
  malts: ["abv", "srm", "fg"],
  hops: ["ibu"],
  yeast: ["abv", "fg"],
};

function StyleCheck({ p, style }: { p: Prediction; style?: Style }) {
  if (!style) return null;
  return (
    <Section title="Style check">
      <p className="muted">How this recipe compares with {style.name}.</p>
      {(["og", "fg", "abv", "ibu", "srm"] as const).map((k) => {
        const range = style[k];
        const value = p[k];
        const status =
          value < range[0] ? "low" : value > range[1] ? "high" : "ok";
        return (
          <div className={`style-row ${status}`} key={k}>
            <div>
              <b>
                <HelpTerm label={k.toUpperCase()} />
              </b>
              <span>
                {value.toFixed(k === "og" || k === "fg" ? 3 : 1)}
                <small>
                  {status === "ok"
                    ? "In range"
                    : status === "low"
                      ? "Below"
                      : "Above"}
                </small>
              </span>
            </div>
            <div className="range-meter">
              <i
                style={{
                  left: `${Math.max(0, Math.min(100, ((value - range[0]) / (range[1] - range[0] || 1)) * 60 + 20))}%`,
                }}
              />
            </div>
            <small>
              {range
                .map((n) => n.toFixed(k === "og" || k === "fg" ? 3 : 1))
                .join(" – ")}
            </small>
          </div>
        );
      })}
    </Section>
  );
}

export default function App() {
  const sharedWorkspace = !["localhost", "127.0.0.1", "[::1]"].includes(
    window.location.hostname,
  );
  const [builderStep, setBuilderStep] = useState<BuilderStep>(() => {
    const savedStep = localStorage.getItem("brew-builder-step");
    return savedStep === "additives"
      ? "summary"
      : isBuilderStep(savedStep)
        ? savedStep
        : "water";
  });
  const [goalResetKey, setGoalResetKey] = useState(0);
  const [designTarget, setDesignTarget] = useState<Target>(
    structuredClone(defaultTarget),
  );
  const [view, setActiveView] = useState<View>(() => {
    const stored = localStorage.getItem("brew-view");
    return isView(stored) ? stored : "home";
  });
  const [recipe, setRecipe] = useState<Recipe>(() => {
      try {
        return recipeSchema.parse(
          JSON.parse(localStorage.getItem("brew-draft") ?? "null"),
        );
      } catch {
        return defaultRecipeForWater();
      }
    }),
    [saved, setSaved] = useState<SavedRecipe[]>([]),
    [us, setUs] = useState(
      () => localStorage.getItem("brew-units") !== "metric",
    ),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [logs, setLogs] = useState<SavedBrewLog[]>([]);
  const [saving, setSaving] = useState(false);
  const ownedRecipes = saved.filter((r) => r.access.owned);
  const storedRecipe = saved.find((r) => r.id === recipe.id);
  const personalLogs = useMemo(
    () => logs.filter((l) => l.access.owned),
    [logs],
  );
  const [designFromRecipe, setDesignFromRecipe] = useState<Recipe>();
  const [returning, setReturning] = useState(
    () => localStorage.getItem("brew-draft") !== null,
  );
  const [drafts, setDrafts] = useState<Record<string, Recipe>>(() => {
    try {
      return readDraftBank(localStorage.getItem("brew-drafts"));
    } catch {
      return {};
    }
  });
  const draftBankRef = useRef(drafts);
  const [prefs, setPrefs] = useState<Preferences>(() => {
    try {
      return {
        personalize: false,
        userWeight: 2,
        calibrateYeast: false,
        ...JSON.parse(localStorage.getItem("brew-preferences") ?? "{}"),
      };
    } catch {
      return { personalize: false, userWeight: 2, calibrateYeast: false };
    }
  });
  const libraryCatalog = useMemo<Catalog>(
    () => ({
      ...baseCatalog,
      descriptors: [
        ...baseCatalog.descriptors,
        ...personalLogs.flatMap((l) => l.descriptors),
      ],
    }),
    [personalLogs],
  );
  const catalog = prefs.personalize ? libraryCatalog : baseCatalog;
  const calibration = useMemo(
    () => calibrate(personalLogs, baseCatalog),
    [personalLogs],
  );
  useEffect(() => {
    try {
      localStorage.setItem("brew-preferences", JSON.stringify(prefs));
    } catch {}
  }, [prefs]);
  useEffect(() => {
    getJson<SavedBrewLog[]>("/api/logs")
      .then(setLogs)
      .catch(() => setError("Brew log API unavailable."));
  }, []);
  const scrollPositions = useRef<Record<string, number>>({});
  const scrollKey = view === "build" ? `build:${builderStep}` : view;
  const setView = (next: View) => {
    scrollPositions.current[scrollKey] = window.scrollY;
    setActiveView(next);
  };
  const goToStep = (step: BuilderStep) => {
    scrollPositions.current[scrollKey] = window.scrollY;
    setReturning(true);
    setBuilderStep(step);
    setActiveView("build");
  };
  useEffect(() => {
    localStorage.setItem("brew-builder-step", builderStep);
  }, [builderStep]);
  useEffect(() => {
    localStorage.setItem("brew-view", view);
  }, [view]);
  useLayoutEffect(() => {
    window.scrollTo(0, scrollPositions.current[scrollKey] ?? 0);
  }, [scrollKey]);
  const changeIngredients = (next: Recipe) => {
    try {
      const settings = waterSettings(recipe, catalog);
      const adjusted =
        next.grains !== recipe.grains ||
        next.boilMinutes !== recipe.boilMinutes ||
        next.boilOffLPerHour !== recipe.boilOffLPerHour
          ? recipeAtFixedWater(
              next,
              catalog,
              settings.startingWaterL,
              settings.absorptionLPerKg,
            )
          : next;
      setRecipe({ ...adjusted, waterPlan: settings });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const startNewRecipe = () => {
    setRecipe({ ...defaultRecipeForWater(), name: "Untitled recipe" });
    setDesignFromRecipe(undefined);
    setGoalResetKey((key) => key + 1);
    scrollPositions.current = {};
    goToStep("water");
  };
  const openRecipe = (r: Recipe, step: BuilderStep = "summary") => {
    setRecipe(r);
    setDesignFromRecipe(r);
    scrollPositions.current[`build:${step}`] = 0;
    goToStep(step);
  };
  useLayoutEffect(() => {
    try {
      localStorage.setItem("brew-draft", JSON.stringify(recipe));
      const next = { ...draftBankRef.current, [recipe.id]: recipe };
      localStorage.setItem("brew-drafts", JSON.stringify(next));
      draftBankRef.current = next;
      setDrafts(next);
    } catch {
      setError(
        "Draft backup unavailable; save the recipe before leaving this page.",
      );
    }
  }, [recipe]);
  useEffect(() => {
    getJson<SavedRecipe[]>("/api/recipes")
      .then(setSaved)
      .catch(() =>
        setError("API unavailable. Start the app with npm run dev."),
      );
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("recipe");
    if (!id) return;
    getJson<SavedRecipe>("/api/recipes/" + encodeURIComponent(id))
      .then((r) =>
        openRecipe(
          r.access.owned
            ? recipeSchema.parse(r)
            : copyBookRecipe(r, crypto.randomUUID()),
        ),
      )
      .catch(() => setError("This recipe is private or no longer shared."));
  }, []);
  const notify = (s: string) => {
    setMessage(s);
    setTimeout(() => setMessage(""), 4500);
  };
  let calculationError = "";
  let p: Prediction | undefined;
  try {
    p = predict(
      recipe,
      catalog,
      prefs.calibrateYeast
        ? calibration.yeasts[recipe.yeastId]?.attenuation
        : undefined,
    );
  } catch (e) {
    calculationError = String(e);
  }
  const style = catalog.styles.find((s) => s.id === recipe.styleId);
  let bottles: number | undefined;
  try {
    const plan = waterSettings(recipe, catalog);
    bottles = planFromWater(
      recipe,
      catalog,
      plan.startingWaterL,
      plan.absorptionLPerKg,
      plan.packagingLossL,
      plan.bottleMl,
    ).bottles;
  } catch {}
  async function save(
    asCopy = false,
    requestedVisibility?: Visibility,
  ): Promise<boolean> {
    const isNew = asCopy || !storedRecipe?.access.owned;
    const baseSave = asCopy
      ? copyBookRecipe(recipe, crypto.randomUUID())
      : isNew
        ? { ...recipe, id: crypto.randomUUID() }
        : recipe;
    const toSave = { ...baseSave, designTargets: designTarget };
    const visibility =
      requestedVisibility ??
      (isNew ? "private" : storedRecipe!.access.visibility);
    setSaving(true);
    setError("");
    try {
      await ensureWorkspace();
      const response = await fetch(
        "/api/recipes/" + encodeURIComponent(toSave.id),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...recipeSchema.parse(toSave), visibility }),
        },
      );
      if (!response.ok) throw new Error((await response.json()).error);
      const stored: SavedRecipe = await response.json();
      setSaved((s) => [stored, ...s.filter((r) => r.id !== stored.id)]);
      if (isNew && !asCopy) {
        const bank = { ...draftBankRef.current };
        delete bank[recipe.id];
        draftBankRef.current = bank;
        setDrafts(bank);
        try {
          localStorage.setItem("brew-drafts", JSON.stringify(bank));
        } catch {}
      }
      setRecipe(recipeSchema.parse(stored));
      notify(
        visibility === "public"
          ? "Recipe shared publicly"
          : "Saved to your Recipe Book",
      );
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }
  const matchGoal = (kind: "abv" | "ibu") => {
    try {
      setRecipe(
        kind === "abv"
          ? matchTargetAbv(recipe, catalog, designTarget.abv)
          : matchTargetIbu(recipe, catalog, designTarget.ibu),
      );
      setError("");
      notify(
        kind === "abv"
          ? `Malts adjusted for ${designTarget.abv}% ABV`
          : `Boil hops adjusted for ${designTarget.ibu} IBU`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const stepIndex = builderSteps.findIndex((s) => s.id === builderStep);
  const nextStep = builderSteps[stepIndex + 1];
  const prevStep = builderSteps[stepIndex - 1];
  const tips =
    p && stepTips[builderStep]
      ? guidance(p, designTarget, style).filter((t) =>
          stepTips[builderStep]!.includes(t.key),
        )
      : [];
  const flavor = p
    ? flavorPredict(recipe, catalog, p, prefs.userWeight)
    : undefined;
  const unitToggle = (
    <div className="unit-toggle" role="group" aria-label="Measurement units">
      {([true, false] as const).map((imperial) => (
        <button
          type="button"
          key={String(imperial)}
          aria-pressed={us === imperial}
          title={
            imperial
              ? "US gallons, pounds, ounces and °F"
              : "Liters, kilograms, grams and °C"
          }
          onClick={() => {
            setUs(imperial);
            localStorage.setItem("brew-units", imperial ? "us" : "metric");
          }}
        >
          {imperial ? "US" : "Metric"}
        </button>
      ))}
    </div>
  );
  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="brand"
          aria-label="BrewMaster home"
          onClick={() => setView("home")}
        >
          <BrandMark size={40} />
          <span>BrewMaster</span>
        </button>
        <nav className="top-nav" aria-label="Main">
          {views.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={view === id ? "page" : undefined}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {unitToggle}
      </header>
      <main className="page">
        {(error || calculationError) && (
          <div className="alert" role="alert">
            <span>{error || calculationError}</span>
            <button className="text-button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        {message && (
          <div className="toast" role="status">
            <Check size={17} />
            {message}
          </div>
        )}
        {view === "home" && (
          <Home
            recipe={recipe}
            prediction={returning ? p : undefined}
            step={builderStep}
            saved={alphabetical(ownedRecipes, (r) => r.name)}
            catalog={baseCatalog}
            onContinue={() => goToStep(builderStep)}
            onNew={startNewRecipe}
            onOpen={(r) =>
              openRecipe(drafts[r.id] ?? recipeSchema.parse(r), "summary")
            }
            onBook={() => setView("book")}
            onLog={() => setView("log")}
          />
        )}
        <div hidden={view !== "build"} className="builder">
          <BuilderHeader
            stage={builderStep}
            onStage={goToStep}
            recipeName={recipe.name}
          />
          {p && builderStep !== "water" && builderStep !== "goals" && (
            <PredictionBar
              p={p}
              target={designTarget}
              style={style}
              bottles={bottles}
              us={us}
            />
          )}
          {builderStep === "water" && (
            <WaterPlanner
              recipe={recipe}
              catalog={catalog}
              us={us}
              onChange={setRecipe}
            />
          )}
          <div hidden={builderStep !== "goals"}>
            <Design
              fromRecipe={designFromRecipe}
              waterRecipe={recipe}
              onTargetChange={setDesignTarget}
              resetKey={goalResetKey}
              catalog={catalog}
              userWeight={prefs.userWeight}
              us={us}
              onOpen={(r) => {
                setRecipe({
                  ...r,
                  name:
                    recipe.name === "Untitled recipe" ? r.name : recipe.name,
                  notes: recipe.notes,
                  processNotes: recipe.processNotes,
                  additives: r.additives ?? recipe.additives,
                });
                goToStep("malts");
              }}
            />
          </div>
          {p &&
            flavor &&
            (builderStep === "malts" ||
              builderStep === "hops" ||
              builderStep === "yeast") && (
              <div className="builder-grid">
                <div className="builder-main">
                  <div className={`guide ${tips.length ? "" : "ok"}`}>
                    {tips.length ? (
                      <>
                        <ul>
                          {tips.map((t) => (
                            <li key={t.key}>{t.text}</li>
                          ))}
                        </ul>
                        {builderStep === "malts" &&
                          tips.some((t) => t.key === "abv") && (
                            <button
                              className="button primary small"
                              onClick={() => matchGoal("abv")}
                            >
                              <Wand2 size={15} /> Adjust malts to{" "}
                              {designTarget.abv}% ABV
                            </button>
                          )}
                        {builderStep === "hops" &&
                          tips.some((t) => t.key === "ibu") && (
                            <button
                              className="button primary small"
                              onClick={() => matchGoal("ibu")}
                            >
                              <Wand2 size={15} /> Adjust boil hops to{" "}
                              {designTarget.ibu} IBU
                            </button>
                          )}
                      </>
                    ) : (
                      <p>
                        <Check size={16} /> On track with your goals. Keep
                        going, or fine-tune below.
                      </p>
                    )}
                  </div>
                  <Editor
                    recipe={recipe}
                    onChange={changeIngredients}
                    onSettings={setRecipe}
                    catalog={catalog}
                    us={us}
                    section={builderStep}
                    target={designTarget}
                    userWeight={prefs.userWeight}
                  />
                  {builderStep === "yeast" &&
                    p.warnings
                      .filter((w) => /Fermentation|tolerance/.test(w))
                      .map((w) => (
                        <p className="notice" role="note" key={w}>
                          {w}
                        </p>
                      ))}
                </div>
                <aside className="builder-aside">
                  <Section title="Your beer">
                    <div className="beer-preview">
                      <BeerGlass
                        srm={p.srm}
                        styleId={recipe.styleId}
                        size="lg"
                      />
                      <div>
                        <b>{colorName(p.srm)}</b>
                        <span>
                          {p.srm.toFixed(1)} SRM
                          {designTarget.srm === undefined
                            ? ""
                            : ` · goal ${designTarget.srm}`}
                        </span>
                        <span>
                          {p.abv.toFixed(1)}% ABV · {p.ibu.toFixed(0)} IBU
                        </span>
                        <small>{style?.name ?? "No particular style"}</small>
                      </div>
                    </div>
                  </Section>
                  <FlavorPanel
                    target={designTarget.flavors}
                    flavor={flavor}
                    catalog={catalog}
                  />
                  {builderStep === "malts" && (
                    <StyleCheck p={p} style={style} />
                  )}
                </aside>
              </div>
            )}
          {p && flavor && builderStep === "summary" && (
            <div id="builder-recipe" className="review-grid">
              <div className="review-main">
                <Section title="Name your beer">
                  <div className="name-row">
                    <figure className="beer-portrait">
                      <BeerGlass
                        srm={p.srm}
                        styleId={recipe.styleId}
                        size="lg"
                      />
                      <figcaption>
                        {colorName(p.srm)} · {p.abv.toFixed(1)}% ABV
                      </figcaption>
                    </figure>
                    <div className="name-fields">
                      <label className="field">
                        <span>Recipe name</span>
                        <input
                          className="recipe-name"
                          aria-label="Recipe name"
                          value={recipe.name}
                          onChange={(e) =>
                            setRecipe({ ...recipe, name: e.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Style</span>
                        <select
                          aria-label="Beer style"
                          value={recipe.styleId}
                          onChange={(e) =>
                            setRecipe({ ...recipe, styleId: e.target.value })
                          }
                        >
                          <option value="">No particular style</option>
                          {alphabetical(catalog.styles, (s) => s.name).map(
                            (s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="save-row">
                    <button
                      className="button primary large"
                      disabled={saving}
                      onClick={() => save()}
                    >
                      <Save size={17} />{" "}
                      {saving
                        ? "Saving…"
                        : storedRecipe?.access.owned
                          ? storedRecipe.access.visibility === "public"
                            ? "Update public recipe"
                            : "Save changes"
                          : "Save recipe"}
                    </button>
                    <button
                      className="button secondary"
                      disabled={saving}
                      onClick={() => save(true)}
                    >
                      <Copy size={15} /> Save a copy
                    </button>
                  </div>
                  <RecipeSharing
                    recipe={recipe}
                    stored={storedRecipe}
                    busy={saving}
                    error={error}
                    onVisibility={(visibility) => save(false, visibility)}
                  />
                </Section>
                <RecipeSummary
                  recipe={recipe}
                  catalog={catalog}
                  us={us}
                  target={designTarget}
                  onEdit={goToStep}
                />
                <details id="extras" className="panel advanced-panel">
                  <summary>
                    Extras: fruit, spices, oak & more
                    {recipe.additives?.length
                      ? ` · ${recipe.additives.length} added`
                      : " (optional)"}
                  </summary>
                  <RecipeAdditives
                    recipe={recipe}
                    onChange={setRecipe}
                    us={us}
                  />
                  <p className="muted">
                    Browse every extra, with suggested amounts, under{" "}
                    <button
                      className="text-button"
                      onClick={() => setView("library")}
                    >
                      Ingredients
                    </button>
                    .
                  </p>
                </details>
                <RecipeNotes recipe={recipe} onChange={setRecipe} us={us} />
                {p.warnings.length > 0 && (
                  <div className="notice">
                    <b>Before you brew</b>
                    <ul>
                      {p.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <aside className="builder-aside">
                <FlavorPanel
                  target={designTarget.flavors}
                  flavor={flavor}
                  catalog={catalog}
                  readOnly
                />
                <StyleCheck p={p} style={style} />
                <Section title="Brew-day numbers">
                  <dl className="details" id="brew-details">
                    {[
                      ["Pre-boil gravity", p.preBoilGravity.toFixed(3)],
                      [
                        "Pre-boil volume",
                        (us ? lToGal(p.preBoilL) : p.preBoilL).toFixed(2) +
                          (us ? " gal" : " L"),
                      ],
                      ["Attenuation", p.attenuation.toFixed(1) + "%"],
                      ["BU:GU", p.bugu.toFixed(2)],
                      [
                        "Cells to pitch",
                        p.pitchBillion.toFixed(0) + " billion",
                      ],
                      ["Calories / 12 oz", p.calories12oz.toFixed(0)],
                      ["ABV · standard", p.abvStandard.toFixed(2) + "%"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt>
                          <HelpTerm label={k} />
                        </dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {prefs.calibrateYeast &&
                    calibration.yeasts[recipe.yeastId] && (
                      <p className="muted">
                        Using your own attenuation from past brews.
                      </p>
                    )}
                </Section>
                <Section title="Print & export">
                  <div className="export-buttons">
                    <button
                      className="button secondary"
                      onClick={printBrewSheet}
                    >
                      <Printer size={16} /> Print brew sheet
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        download(
                          recipe.name + ".xml",
                          exportBeerXML(recipe, catalog),
                          "application/xml",
                        )
                      }
                    >
                      <Download size={16} /> BeerXML
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        download(
                          recipe.name + ".json",
                          JSON.stringify(recipe, null, 2),
                        )
                      }
                    >
                      <Download size={16} /> JSON
                    </button>
                    <label className="button secondary">
                      <Upload size={16} /> Import a recipe
                      <input
                        type="file"
                        accept=".json,.xml"
                        hidden
                        onChange={async (e) => {
                          try {
                            const f = e.target.files?.[0];
                            if (f) {
                              const imported = importRecipe(
                                await f.text(),
                                catalog,
                                defaultRecipe,
                              );
                              openRecipe(imported);
                              notify("Recipe imported");
                            }
                          } catch (err) {
                            setError(String(err));
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </Section>
              </aside>
            </div>
          )}
          <nav className="step-footer" aria-label="Continue recipe builder">
            {prevStep ? (
              <button
                type="button"
                className="button ghost"
                onClick={() => goToStep(prevStep.id)}
              >
                <ArrowLeft size={16} /> {prevStep.label}
              </button>
            ) : (
              <span />
            )}
            {nextStep ? (
              <button
                type="button"
                className="button primary large"
                onClick={() => {
                  if (builderStep === "goals")
                    setRecipe({
                      ...recipe,
                      styleId: designTarget.styleId,
                      designTargets: designTarget,
                    });
                  goToStep(nextStep.id);
                }}
              >
                Next: {nextStep.label} <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="button primary large"
                disabled={saving}
                onClick={() => save()}
              >
                <Save size={16} /> {saving ? "Saving…" : "Save recipe"}
              </button>
            )}
          </nav>
        </div>
        <div hidden={view !== "book"}>
          <header className="page-header">
            <div>
              <h1>Recipe Book</h1>
              <p className="lede">
                Your saved recipes, plus a starter recipe for every beer style.
                Open one to brew it as-is or make it your own.
              </p>
            </div>
            <button className="button primary" onClick={startNewRecipe}>
              <Plus size={16} /> New recipe
            </button>
          </header>
          <RecipeBook
            saved={saved}
            drafts={drafts}
            catalog={baseCatalog}
            us={us}
            onOpen={(r, startAtWater) =>
              openRecipe(
                recipeSchema.parse(r),
                startAtWater ? "water" : "summary",
              )
            }
            onNew={startNewRecipe}
          />
        </div>
        <div hidden={view !== "library"}>
          <header className="page-header">
            <div>
              <h1>Ingredients</h1>
              <p className="lede">
                Every malt, hop, yeast and extra, with what it tastes like and
                how to use it.
              </p>
            </div>
          </header>
          <Library
            catalog={libraryCatalog}
            us={us}
            batchL={recipe.batchL}
            selectedYeastId={recipe.yeastId}
            onChooseYeast={(yeastId) => {
              setRecipe({ ...recipe, yeastId });
              notify("Yeast updated in your current recipe.");
            }}
            onAddCustomAdditive={(addition) => {
              setRecipe({
                ...recipe,
                additives: [...(recipe.additives ?? []), addition],
              });
              notify("Extra added to your current recipe.");
            }}
            onAddAdditive={(id) => {
              setRecipe({
                ...recipe,
                additives: [
                  ...(recipe.additives ?? []),
                  createAdditiveAddition(
                    id,
                    recipe.batchL,
                    crypto.randomUUID(),
                  ),
                ],
              });
              notify(
                "Added to your current recipe. Adjust it under Build → Review → Extras.",
              );
            }}
          />
        </div>
        <div hidden={view !== "log"}>
          <header className="page-header">
            <div>
              <h1>Brew Log</h1>
              <p className="lede">
                Record what actually happened on brew day for{" "}
                <b>{recipe.name}</b>, then compare it with the prediction.
              </p>
            </div>
          </header>
          {p && (
            <BrewLog
              recipe={recipe}
              prediction={p}
              flavor={flavorPredict(recipe, catalog, p, prefs.userWeight)}
              catalog={catalog}
              logs={logs}
              onSaved={(l) => {
                setLogs((a) => [l, ...a.filter((b) => b.id !== l.id)]);
              }}
              us={us}
              prefs={prefs}
              setPrefs={setPrefs}
              onEfficiency={(efficiency) => {
                setRecipe({ ...recipe, efficiency });
                notify("Efficiency applied; ingredient amounts kept");
              }}
            />
          )}
        </div>
        <footer className="app-footer">
          <BrandMark size={26} />
          <span>
            {sharedWorkspace
              ? "Recipes are private to this browser unless you share them."
              : "Recipes are saved on this computer."}
          </span>
        </footer>
      </main>
      <nav className="bottom-nav" aria-label="Main">
        {views.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={view === id ? "page" : undefined}
            onClick={() => setView(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="print-footer">
        Brew sheet · {recipe.name} · Mash {recipe.mashC}°C for{" "}
        {recipe.mashMinutes} min · Ferment {recipe.fermentC}°C · Pitch{" "}
        {p?.pitchBillion.toFixed(0)} billion cells
      </div>
    </div>
  );
}
