import { useEffect, useState, useRef, useLayoutEffect, useMemo } from "react";
import {
  NotebookPen,
  BookOpen,
  BookMarked,
  Copy,
  FlaskConical,
  Download,
  Save,
  Printer,
  Upload,
  ArrowUpRight,
  Check,
  Plus,
} from "lucide-react";
import { ensureWorkspace, getJson } from "./api";
import RecipeSharing from "./components/RecipeSharing";
import type { SavedRecipe, SavedBrewLog, Visibility } from "./sharing";
import { catalog as baseCatalog } from "./catalog";
import BrandMark from "./components/BrandMark";
import StudioHero from "./components/StudioHero";
import BuilderHeader from "./components/BuilderHeader";
import BrewLog, { type Preferences } from "./components/BrewLog";
import { calibrate } from "./engine/feedback";
import { recipeSchema } from "./validation";
import RecipeBook from "./components/RecipeBook";
import { createAdditiveAddition } from "./engine/additives";
import RecipeNotes from "./components/RecipeNotes";
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
  BrewLog as Log,
} from "./engine/types";
import { beerColor, predict, lToGal } from "./engine/calculations";
import { download, exportBeerXML, importRecipe } from "./io";
import Editor from "./components/Editor";
import Library from "./components/Library";
import Design from "./components/Design";
import FlavorPanel from "./components/FlavorPanel";
import { flavorPredict } from "./engine/flavor";
import { Section, Tag, HelpTerm } from "./components/ui";
import { alphabetical } from "./engine/search";
import {
  builderSteps,
  isBuilderStep,
  recipeAtFixedWater,
  type BuilderStep,
} from "./engine/builder";
import { waterSettings } from "./engine/waterPlan";
import WaterPlanner from "./components/WaterPlanner";
import HopSuggestions from "./components/HopSuggestions";
import RecipeSummary from "./components/RecipeSummary";
import { ingredientMatches } from "./engine/recommendations";
import { IngredientInfo } from "./components/IngredientPicker";
function printBrewSheet() {
  const panels = [
    ...document.querySelectorAll<HTMLDetailsElement>(
      "#builder-recipe details.builder-optional:not([open])",
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
export default function App() {
  const sharedWorkspace = !["localhost", "127.0.0.1", "[::1]"].includes(
    window.location.hostname,
  );
  const [builderStep, setBuilderStep] = useState<BuilderStep>(() => {
    const savedStep = localStorage.getItem("brew-builder-step");
    return isBuilderStep(savedStep) ? savedStep : "water";
  });
  const [goalResetKey, setGoalResetKey] = useState(0);
  const [designTarget, setDesignTarget] = useState<Target>(
    structuredClone(defaultTarget),
  );
  const [tab, setActiveTab] = useState(() =>
      localStorage.getItem("brew-builder-step") === "goals"
        ? "Design"
        : "Recipe Editor",
    ),
    [recipe, setRecipe] = useState<Recipe>(() => {
      try {
        return recipeSchema.parse(
          JSON.parse(localStorage.getItem("brew-draft") ?? "null"),
        );
      } catch {
        return defaultRecipeForWater();
      }
    }),
    [saved, setSaved] = useState<SavedRecipe[]>([]),
    [us, setUs] = useState(() => localStorage.getItem("brew-units") === "us"),
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
  const libraryCatalog = useMemo(
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
  const inBuilder = tab === "Design" || tab === "Recipe Editor";
  const activeNavigation = inBuilder ? "Recipe Builder" : tab;
  const scrollKey = inBuilder ? `builder:${builderStep}` : tab;
  const setTab = (next: string) => {
    scrollPositions.current[scrollKey] = window.scrollY;
    setActiveTab(next);
  };
  const goToStep = (step: BuilderStep) => {
    scrollPositions.current[scrollKey] = window.scrollY;
    setBuilderStep(step);
    setActiveTab(step === "goals" ? "Design" : "Recipe Editor");
  };
  useEffect(() => {
    localStorage.setItem("brew-builder-step", builderStep);
  }, [builderStep]);
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
  useLayoutEffect(() => {
    try {
      localStorage.setItem("brew-draft", JSON.stringify(recipe));
      const next = { ...draftBankRef.current, [recipe.id]: recipe };
      localStorage.setItem("brew-drafts", JSON.stringify(next));
      draftBankRef.current = next;
      setDrafts(next);
    } catch {
      setError(
        "Draft backup unavailable; save the recipe to SQLite before leaving.",
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
      .then((r) => {
        setRecipe(
          r.access.owned
            ? recipeSchema.parse(r)
            : copyBookRecipe(r, crypto.randomUUID()),
        );
        setDesignFromRecipe(recipeSchema.parse(r));
        goToStep("summary");
      })
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
          : "Recipe saved privately in My recipes",
      );
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }
  const tabs = [
    { label: "Recipe Builder", icon: FlaskConical },
    { label: "Ingredient Library", icon: BookOpen },
    { label: "Recipe Book", icon: BookMarked },
    { label: "Brew Log", icon: NotebookPen },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          aria-label="BrewMaster"
          onClick={(e) => e.preventDefault()}
        >
          <span className="brand-icon">
            <BrandMark size={60} />
          </span>
          <span>
            Brew<span className="brand-light">Master</span>
            <small>FROM IDEA TO FIRST POUR</small>
          </span>
        </a>
        <div className="sidebar-label">WORKBENCH</div>
        <nav>
          {tabs.map(({ label, icon: Icon }) => (
            <button
              className={
                activeNavigation === label ? "nav-item active" : "nav-item"
              }
              key={label}
              aria-label={label}
              aria-current={activeNavigation === label ? "page" : undefined}
              onClick={() =>
                setTab(
                  label === "Recipe Builder"
                    ? builderStep === "goals"
                      ? "Design"
                      : "Recipe Editor"
                    : label,
                )
              }
            >
              <Icon size={19} />
              <span className="nav-label">{label}</span>
              {activeNavigation === label && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-label saved-label">
          YOUR RECIPES <span>{ownedRecipes.length}</span>
        </div>
        {alphabetical(ownedRecipes, (r) => r.name)
          .slice(0, 6)
          .map((r) => (
            <button
              className="saved-recipe"
              key={r.id}
              onClick={() => {
                setRecipe(drafts[r.id] ?? recipeSchema.parse(r));
                setDesignFromRecipe(drafts[r.id] ?? recipeSchema.parse(r));
                goToStep("summary");
              }}
            >
              <span className="mini-dot" />
              {r.name}
            </button>
          ))}
        <button className="text-button new-recipe" onClick={startNewRecipe}>
          <Plus size={15} /> New recipe
        </button>
        <div className="sidebar-botanical" aria-hidden="true">
          <BrandMark size={190} />
          <span>
            BREW SOMETHING
            <br />
            <em>worth sharing.</em>
          </span>
        </div>
        <div className="sidebar-bottom">
          <span className="tiny-dot" />{" "}
          {sharedWorkspace
            ? "Your brewing workspace"
            : "Local brewing workspace"}
          <small>
            {sharedWorkspace
              ? "Private by default. Sharing is optional."
              : "Recipes stay on this Mac."}
          </small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            YOUR BREWING WORKBENCH{" "}
            <span className="breadcrumb">/ {activeNavigation}</span>
          </span>
          <div
            className="unit-toggle"
            role="group"
            aria-label="Measurement units"
          >
            {([false, true] as const).map((imperial) => (
              <button
                type="button"
                key={String(imperial)}
                aria-pressed={us === imperial}
                className={us === imperial ? "selected" : ""}
                title={
                  imperial
                    ? "US gallons, pounds, ounces and °F"
                    : "Liters, kilograms, grams and °C"
                }
                onClick={() => {
                  setUs(imperial);
                  localStorage.setItem(
                    "brew-units",
                    imperial ? "us" : "metric",
                  );
                }}
              >
                {imperial ? "Imperial" : "Metric"}
              </button>
            ))}
          </div>
        </header>
        <div className="page-content">
          {inBuilder ? (
            <BuilderHeader stage={builderStep} onStage={goToStep} />
          ) : (
            <StudioHero
              screen={tab}
              catalog={catalog}
              prediction={tab === "Recipe Editor" ? p : undefined}
            />
          )}
          {(error || calculationError) && (
            <div className="alert" role="alert">
              {error || calculationError}
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          {message && (
            <div className="toast" role="status">
              <Check size={17} />
              {message}
            </div>
          )}
          <div id="builder-recipe" hidden={tab !== "Recipe Editor"}>
            <div hidden={builderStep !== "summary"}>
              <div className="recipe-title-row">
                <div>
                  <div className="recipe-name-label">YOUR WORKING RECIPE</div>
                  <input
                    className="recipe-name"
                    aria-label="Recipe name"
                    value={recipe.name}
                    onChange={(e) =>
                      setRecipe({ ...recipe, name: e.target.value })
                    }
                  />
                  <div className="recipe-meta">
                    <select
                      aria-label="Beer style"
                      value={recipe.styleId}
                      onChange={(e) =>
                        setRecipe({ ...recipe, styleId: e.target.value })
                      }
                    >
                      <option value="">No style constraint</option>
                      {alphabetical(catalog.styles, (s) => s.name).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <span>•</span>
                    <span>
                      {(us ? lToGal(recipe.batchL) : recipe.batchL).toFixed(1)}{" "}
                      {us ? "gal" : "L"} batch
                    </span>
                    <Tag tone="neutral">ALL GRAIN</Tag>
                  </div>
                </div>
                <div className="actions">
                  <details className="recipe-more-actions">
                    <summary className="button secondary">More actions</summary>
                    <div className="recipe-extra-actions">
                      <label className="button secondary">
                        <Upload size={15} /> Import
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
                                setRecipe(imported);
                                setDesignFromRecipe(imported);
                              }
                              notify("Recipe imported");
                            } catch (err) {
                              setError(String(err));
                            }
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        className="button secondary"
                        disabled={saving}
                        onClick={() => save(true)}
                      >
                        <Copy size={15} /> Save a copy
                      </button>
                    </div>
                  </details>
                  <button
                    className="button primary"
                    disabled={saving}
                    onClick={() => save()}
                  >
                    <Save size={15} />{" "}
                    {saving
                      ? "Saving…"
                      : storedRecipe?.access.owned &&
                          storedRecipe.access.visibility === "public"
                        ? "Update public recipe"
                        : "Save privately"}
                  </button>
                </div>
              </div>
              <RecipeSharing
                recipe={recipe}
                stored={storedRecipe}
                busy={saving}
                error={error}
                onVisibility={(visibility) => save(false, visibility)}
              />
            </div>
            {p && builderStep !== "water" && (
              <>
                <div
                  className={`metrics ${builderStep === "summary" ? "" : "step-live-metrics"}`}
                >
                  {[
                    ["ABV", p.abv.toFixed(1), "%"],
                    ["BITTERNESS", p.ibu.toFixed(0), "IBU"],
                    ["COLOR", p.srm.toFixed(1), "SRM"],
                    ["ORIGINAL GRAVITY", p.og.toFixed(3), "SG"],
                    ["FINAL GRAVITY", p.fg.toFixed(3), "SG"],
                  ].map(([label, value, unit], i) => (
                    <div className="metric" key={label}>
                      <span>
                        <HelpTerm label={label} />
                      </span>
                      <div>
                        {i === 2 && (
                          <i
                            className="beer-swatch"
                            style={{ background: beerColor(p!.srm) }}
                          />
                        )}
                        <strong>{value}</strong>
                        <small>{unit}</small>
                      </div>
                      <span className="metric-foot">
                        {i === 0
                          ? "Gravity-derived estimate"
                          : i === 1
                            ? "Tinseth calculation"
                            : i === 2
                              ? `${p!.ebc.toFixed(1)} EBC · Morey`
                              : "Calculated estimate"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="legend-line">
                  <Tag tone="objective">CALCULATED</Tag>
                  <span>
                    Established brewing math · predictions, not measurements
                    {prefs.calibrateYeast && calibration.yeasts[recipe.yeastId]
                      ? " · personal attenuation active"
                      : ""}
                  </span>
                  {builderStep === "summary" ? (
                    <a href="#brew-details">
                      View calculations <ArrowUpRight size={13} />
                    </a>
                  ) : (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => goToStep("summary")}
                    >
                      View complete recipe <ArrowUpRight size={13} />
                    </button>
                  )}
                </div>
                {p.warnings
                  .filter((w) => w.startsWith("Beer-wort attenuation"))
                  .map((w) => (
                    <p className="notice" role="note" key={w}>
                      <strong>Experimental yeast estimate:</strong> {w}
                    </p>
                  ))}
              </>
            )}
            <div hidden={builderStep !== "summary"}>
              <RecipeNotes recipe={recipe} onChange={setRecipe} us={us} />
            </div>
            <div hidden={builderStep !== "water"}>
              <p className="muted">
                Recipe: <strong>{recipe.name}</strong>
              </p>
              <WaterPlanner
                recipe={recipe}
                catalog={catalog}
                us={us}
                onChange={setRecipe}
                expanded
              />
            </div>
            {p && (
              <>
                <div
                  className={`workbench-grid guided-workbench ${builderStep === "water" ? "guided-water-workbench" : ""}`}
                >
                  <div
                    className="guided-step-content"
                    hidden={builderStep === "water"}
                  >
                    {builderStep === "hops" && (
                      <HopSuggestions
                        recipe={recipe}
                        catalog={catalog}
                        target={designTarget}
                        userWeight={prefs.userWeight}
                        us={us}
                        onChange={changeIngredients}
                      />
                    )}
                    {builderStep === "yeast" && (
                      <Section
                        title="Suggested yeast"
                        eyebrow="FERMENTATION CHARACTER & ATTENUATION"
                      >
                        <p className="muted">
                          These strains fit your style, flavor targets and
                          alcohol goal. Alcohol comes from fermentable sugars
                          and attenuation; tolerance describes a strain’s limit.
                        </p>
                        <div className="yeast-suggestion-list">
                          {ingredientMatches(
                            designTarget,
                            catalog,
                            prefs.userWeight,
                          )
                            .yeasts.slice(0, 3)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((match) => {
                              const yeast = catalog.yeasts.find(
                                (y) => y.id === match.id,
                              )!;
                              const estimate = predict(
                                { ...recipe, yeastId: yeast.id },
                                catalog,
                              );
                              return (
                                <article key={yeast.id}>
                                  <div className="ingredient-name-with-info">
                                    <h3>{yeast.name}</h3>
                                    <IngredientInfo
                                      item={yeast}
                                      catalog={catalog}
                                      us={us}
                                    />
                                  </div>
                                  <Tag>FLAVOR ESTIMATE</Tag>
                                  <p>
                                    {match.descriptors
                                      .slice(0, 3)
                                      .map((d) => d.label)
                                      .join(" · ")}
                                  </p>
                                  <p className="muted">
                                    {yeast.attenuation
                                      ? `${yeast.attenuation.join("–")}% attenuation`
                                      : "Attenuation unknown"}{" "}
                                    ·{" "}
                                    {yeast.alcoholTolerance === null
                                      ? "Alcohol tolerance unknown"
                                      : `Up to ${yeast.alcoholTolerance}% ABV tolerance`}
                                  </p>
                                  <Tag tone="objective">
                                    CALCULATED FOR THIS RECIPE
                                  </Tag>
                                  <p>
                                    {estimate.abv.toFixed(1)}% ABV · FG{" "}
                                    {estimate.fg.toFixed(3)}
                                  </p>
                                  <button
                                    className="button secondary"
                                    type="button"
                                    disabled={recipe.yeastId === yeast.id}
                                    onClick={() =>
                                      changeIngredients({
                                        ...recipe,
                                        yeastId: yeast.id,
                                      })
                                    }
                                  >
                                    {recipe.yeastId === yeast.id
                                      ? "Selected"
                                      : "Choose strain"}
                                  </button>
                                </article>
                              );
                            })}
                        </div>
                      </Section>
                    )}
                    {builderStep === "summary" && (
                      <RecipeSummary
                        recipe={recipe}
                        catalog={catalog}
                        us={us}
                        target={designTarget}
                        onEdit={goToStep}
                      />
                    )}
                    <div hidden={builderStep === "summary"}>
                      <Editor
                        recipe={recipe}
                        onChange={changeIngredients}
                        catalog={catalog}
                        us={us}
                        section={builderStep}
                      />
                    </div>
                  </div>
                  <aside
                    className="recipe-aside"
                    hidden={
                      builderStep === "water" || builderStep === "additives"
                    }
                  >
                    <FlavorPanel
                      target={designTarget.flavors}
                      flavor={flavorPredict(
                        recipe,
                        catalog,
                        p,
                        prefs.userWeight,
                      )}
                      catalog={catalog}
                    />
                    <Section
                      title="Style check"
                      eyebrow="REFERENCE RANGES"
                      hidden={
                        builderStep !== "malts" && builderStep !== "summary"
                      }
                    >
                      <p className="muted">
                        Legacy reference ranges. A guide for your recipe.
                      </p>
                      {(["og", "fg", "abv", "ibu", "srm"] as const).map((k) => {
                        const s = catalog.styles.find(
                            (s) => s.id === recipe.styleId,
                          ),
                          range = s?.[k];
                        return (
                          <div className="style-row" key={k}>
                            <div>
                              <b>
                                <HelpTerm label={k.toUpperCase()} />
                              </b>
                              <span>
                                {p![k].toFixed(
                                  k === "og" || k === "fg" ? 3 : 1,
                                )}
                              </span>
                            </div>
                            {range && (
                              <>
                                <div className="range-track">
                                  <i
                                    style={{
                                      left: `${Math.max(0, Math.min(100, ((p![k] - range[0]) / (range[1] - range[0] || 1)) * 100))}%`,
                                    }}
                                  />
                                </div>
                                <small>
                                  {range.join(" – ")}
                                  {p![k] < range[0]
                                    ? " · Below range"
                                    : p![k] > range[1]
                                      ? " · Above range"
                                      : " · In range"}
                                </small>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </Section>
                    <Section
                      hidden={builderStep !== "summary"}
                      title="Brew-day numbers"
                      eyebrow="CALCULATED ESTIMATES"
                    >
                      <dl className="details" id="brew-details">
                        {[
                          ["ABV · standard", p.abvStandard.toFixed(2) + "%"],
                          ["ABV · accurate", p.abv.toFixed(2) + "%"],
                          ["BU:GU", p.bugu.toFixed(2)],
                          ["Calories / 12 oz", p.calories12oz.toFixed(0)],
                          ["Calories / 330 mL", p.calories330.toFixed(0)],
                          ["Pre-boil gravity", p.preBoilGravity.toFixed(3)],
                          [
                            "Pre-boil volume",
                            (us ? lToGal(p.preBoilL) : p.preBoilL).toFixed(2) +
                              (us ? " gal" : " L"),
                          ],
                          [
                            "Cells to pitch",
                            p.pitchBillion.toFixed(0) + " billion",
                          ],
                          ["Attenuation", p.attenuation.toFixed(1) + "%"],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <dt>
                              <HelpTerm label={k} />
                            </dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </Section>
                    <Section
                      title="Take it to the brewery"
                      hidden={builderStep !== "summary"}
                    >
                      <div className="export-buttons">
                        <button
                          onClick={() =>
                            download(
                              recipe.name + ".json",
                              JSON.stringify(recipe, null, 2),
                            )
                          }
                        >
                          <Download size={16} /> Recipe JSON
                        </button>
                        <button
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
                        <button onClick={printBrewSheet}>
                          <Printer size={16} /> Print brew sheet
                        </button>
                      </div>
                    </Section>
                  </aside>
                </div>
                {builderStep !== "water" && p.warnings.length > 0 && (
                  <div className="notice">
                    <b>Before you brew</b>
                    {p.warnings.map((w) => (
                      <p key={w}>{w}</p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div hidden={tab !== "Recipe Book"}>
            <RecipeBook
              saved={saved}
              drafts={drafts}
              catalog={baseCatalog}
              us={us}
              onOpen={(r, startAtWater) => {
                setRecipe(recipeSchema.parse(r));
                setDesignFromRecipe(recipeSchema.parse(r));
                if (startAtWater) scrollPositions.current["builder:water"] = 0;
                goToStep(startAtWater ? "water" : "summary");
              }}
              onNew={startNewRecipe}
            />
          </div>
          <div hidden={tab !== "Ingredient Library"}>
            <Library
              catalog={libraryCatalog}
              us={us}
              batchL={recipe.batchL}
              selectedYeastId={recipe.yeastId}
              onChooseYeast={(yeastId) => {
                setRecipe({ ...recipe, yeastId });
                notify("Yeast updated in the current recipe.");
              }}
              onAddCustomAdditive={(addition) => {
                setRecipe({
                  ...recipe,
                  additives: [...(recipe.additives ?? []), addition],
                });
                notify("Custom additive added to the current recipe.");
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
                  "Additive added to the current recipe. Edit its amount, stage and notes in Recipe Editor.",
                );
              }}
            />
          </div>
          <div id="builder-goals" hidden={tab !== "Design"}>
            <Design
              fromRecipe={designFromRecipe}
              waterRecipe={recipe}
              onTargetChange={setDesignTarget}
              onConfirm={(target) => {
                setRecipe({
                  ...recipe,
                  styleId: target.styleId,
                  designTargets: target,
                });
                goToStep("malts");
              }}
              resetKey={goalResetKey}
              catalog={catalog}
              userWeight={prefs.userWeight}
              us={us}
              onOpen={(r) => {
                setRecipe({
                  ...r,
                  name: recipe.name,
                  notes: recipe.notes,
                  processNotes: recipe.processNotes,
                  additives: r.additives ?? recipe.additives,
                });
                goToStep("malts");
              }}
            />
          </div>
          <div hidden={tab !== "Brew Log"}>
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
                  notify("Efficiency applied; ingredient amounts retained");
                }}
              />
            )}
          </div>
          {inBuilder && (
            <nav
              className="guided-step-footer"
              aria-label="Continue recipe builder"
            >
              {builderStep !== "water" ? (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    goToStep(
                      builderSteps[
                        builderSteps.findIndex(
                          (step) => step.id === builderStep,
                        ) - 1
                      ].id,
                    )
                  }
                >
                  ← Back
                </button>
              ) : (
                <span />
              )}
              <span>
                Step{" "}
                {builderSteps.findIndex((step) => step.id === builderStep) + 1}{" "}
                of {builderSteps.length}
              </span>
              {builderStep === "goals" ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setRecipe({
                      ...recipe,
                      styleId: designTarget.styleId,
                      designTargets: designTarget,
                    });
                    goToStep("malts");
                  }}
                >
                  {designFromRecipe
                    ? "Confirm goals & keep ingredients →"
                    : "Keep current ingredients →"}
                </button>
              ) : builderStep !== "summary" ? (
                <button
                  type="button"
                  className="button primary"
                  onClick={() =>
                    goToStep(
                      builderSteps[
                        builderSteps.findIndex(
                          (step) => step.id === builderStep,
                        ) + 1
                      ].id,
                    )
                  }
                >
                  Next:{" "}
                  {
                    builderSteps[
                      builderSteps.findIndex(
                        (step) => step.id === builderStep,
                      ) + 1
                    ].label
                  }{" "}
                  →
                </button>
              ) : (
                <button
                  type="button"
                  className="button primary"
                  disabled={saving}
                  onClick={() => save()}
                >
                  <Save size={16} /> {saving ? "Saving…" : "Save recipe"}
                </button>
              )}
            </nav>
          )}
          <footer>
            <BrandMark size={30} />
            <span>Good beer starts with curiosity.</span>
            <span>BrewMaster / v0.1</span>
          </footer>
        </div>
      </main>
      <div className="print-footer">
        Brew sheet · {recipe.name} · Mash {recipe.mashC}°C for{" "}
        {recipe.mashMinutes} min · Ferment {recipe.fermentC}°C · Pitch{" "}
        {p?.pitchBillion.toFixed(0)} billion cells
      </div>
    </div>
  );
}
