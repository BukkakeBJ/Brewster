import { useEffect, useState, useRef, useLayoutEffect, useMemo } from "react";
import {
  SlidersHorizontal,
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
import { getJson } from "./api";
import { catalog as baseCatalog } from "./catalog";
import BrandMark from "./components/BrandMark";
import StudioHero from "./components/StudioHero";
import BrewLog, { type Preferences } from "./components/BrewLog";
import { calibrate } from "./engine/feedback";
import { recipeSchema } from "./validation";
import RecipeBook from "./components/RecipeBook";
import { createAdditiveAddition } from "./engine/additives";
import RecipeNotes from "./components/RecipeNotes";
import { readDraftBank, copyBookRecipe } from "./engine/recipeBook";
import { defaultRecipe } from "./defaults";
import type { Recipe, Prediction, BrewLog as Log } from "./engine/types";
import { beerColor, predict, lToGal } from "./engine/calculations";
import { download, exportBeerXML, importRecipe } from "./io";
import Editor from "./components/Editor";
import Library from "./components/Library";
import Design from "./components/Design";
import FlavorPanel from "./components/FlavorPanel";
import { flavorPredict } from "./engine/flavor";
import { Section, Tag } from "./components/ui";
export default function App() {
  const sharedWorkspace = !["localhost", "127.0.0.1", "[::1]"].includes(
    window.location.hostname,
  );
  const [tab, setActiveTab] = useState("Recipe Editor"),
    [recipe, setRecipe] = useState<Recipe>(() => {
      try {
        return recipeSchema.parse(
          JSON.parse(localStorage.getItem("brew-draft") ?? "null"),
        );
      } catch {
        return defaultRecipe;
      }
    }),
    [saved, setSaved] = useState<Recipe[]>([]),
    [us, setUs] = useState(() => localStorage.getItem("brew-units") === "us"),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
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
        ...logs.flatMap((l) => l.descriptors),
      ],
    }),
    [logs],
  );
  const catalog = prefs.personalize ? libraryCatalog : baseCatalog;
  const calibration = useMemo(() => calibrate(logs, baseCatalog), [logs]);
  useEffect(() => {
    try {
      localStorage.setItem("brew-preferences", JSON.stringify(prefs));
    } catch {}
  }, [prefs]);
  useEffect(() => {
    getJson<Log[]>("/api/logs")
      .then(setLogs)
      .catch(() => setError("Brew log API unavailable."));
  }, []);
  const scrollPositions = useRef<Record<string, number>>({});
  const setTab = (next: string) => {
    scrollPositions.current[tab] = window.scrollY;
    setActiveTab(next);
  };
  useLayoutEffect(() => {
    window.scrollTo(0, scrollPositions.current[tab] ?? 0);
  }, [tab]);
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
    getJson<Recipe[]>("/api/recipes")
      .then(setSaved)
      .catch(() =>
        setError("API unavailable. Start the app with npm run dev."),
      );
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
  async function save(asCopy = false) {
    const toSave = asCopy
      ? copyBookRecipe(recipe, crypto.randomUUID())
      : recipe;
    try {
      const response = await fetch(
        "/api/recipes/" + encodeURIComponent(toSave.id),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toSave),
        },
      );
      if (!response.ok) throw new Error((await response.json()).error);
      const stored = await response.json();
      setSaved((s) => [stored, ...s.filter((r) => r.id !== stored.id)]);
      if (asCopy) setRecipe(stored);
      notify("Recipe saved to your Recipe Book");
    } catch (e) {
      setError(String(e));
    }
  }
  const tabs = [
    { label: "Design", icon: SlidersHorizontal },
    { label: "Recipe Editor", icon: FlaskConical },
    { label: "Ingredient Library", icon: BookOpen },
    { label: "Recipe Book", icon: BookMarked },
    { label: "Brew Log", icon: NotebookPen },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
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
              className={tab === label ? "nav-item active" : "nav-item"}
              key={label}
              aria-current={tab === label ? "page" : undefined}
              onClick={() => setTab(label)}
            >
              <Icon size={19} />
              <span className="nav-label">{label}</span>
              {tab === label && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-label saved-label">
          YOUR RECIPES <span>{saved.length}</span>
        </div>
        {saved.slice(0, 6).map((r) => (
          <button
            className="saved-recipe"
            key={r.id}
            onClick={() => {
              setRecipe(drafts[r.id] ?? r);
              setTab("Recipe Editor");
            }}
          >
            <span className="mini-dot" />
            {r.name}
          </button>
        ))}
        <button
          className="text-button new-recipe"
          onClick={() => {
            setRecipe({
              ...defaultRecipe,
              id: crypto.randomUUID(),
              name: "Untitled recipe",
            });
            setTab("Recipe Editor");
          }}
        >
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
            ? "Public brewing workspace"
            : "Local brewing workspace"}
          <small>
            {sharedWorkspace
              ? "Saved recipes & brew logs are shared."
              : "Recipes stay on this Mac."}
          </small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            YOUR BREWING WORKBENCH <span className="breadcrumb">/ {tab}</span>
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
          {sharedWorkspace && (
            <p className="shared-workspace-note">
              Public workspace · Saved recipes and brew logs are shared with
              everyone. Unsaved drafts stay in this browser.
            </p>
          )}
          <StudioHero
            screen={tab}
            catalog={catalog}
            prediction={tab === "Recipe Editor" ? p : undefined}
          />
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
          <div hidden={tab !== "Recipe Editor"}>
            <div className="recipe-title-row">
              <div>
                <div className="recipe-name-label">
                  YOUR WORKING RECIPE / EDIT & EXPERIMENT
                </div>
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
                    {catalog.styles.map((s) => (
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
                <label className="button secondary">
                  <Upload size={15} /> Import
                  <input
                    type="file"
                    accept=".json,.xml"
                    hidden
                    onChange={async (e) => {
                      try {
                        const f = e.target.files?.[0];
                        if (f)
                          setRecipe(
                            importRecipe(
                              await f.text(),
                              catalog,
                              defaultRecipe,
                            ),
                          );
                        notify("Recipe imported");
                      } catch (err) {
                        setError(String(err));
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                <button className="button secondary" onClick={() => save(true)}>
                  <Copy size={15} /> Save a copy
                </button>
                <button className="button primary" onClick={() => save()}>
                  <Save size={15} /> Save recipe
                </button>
              </div>
            </div>
            {p && (
              <>
                <div className="metrics">
                  {[
                    ["ABV", p.abv.toFixed(1), "%"],
                    ["BITTERNESS", p.ibu.toFixed(0), "IBU"],
                    ["COLOR", p.srm.toFixed(1), "SRM"],
                    ["ORIGINAL GRAVITY", p.og.toFixed(3), "SG"],
                    ["FINAL GRAVITY", p.fg.toFixed(3), "SG"],
                  ].map(([label, value, unit], i) => (
                    <div className="metric" key={label}>
                      <span>{label}</span>
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
                  <a href="#brew-details">
                    View calculations <ArrowUpRight size={13} />
                  </a>
                </div>
              </>
            )}
            <button
              className="button secondary redesign-button"
              disabled={!p}
              onClick={() => {
                setDesignFromRecipe(structuredClone(recipe));
                setTab("Design");
              }}
            >
              Adjust targets & get ingredient suggestions
            </button>
            <RecipeNotes recipe={recipe} onChange={setRecipe} us={us} />
            {p && (
              <>
                <div className="workbench-grid">
                  <Editor
                    recipe={recipe}
                    onChange={setRecipe}
                    catalog={catalog}
                    us={us}
                  />
                  <aside className="recipe-aside">
                    <FlavorPanel
                      flavor={flavorPredict(
                        recipe,
                        catalog,
                        p,
                        prefs.userWeight,
                      )}
                      catalog={catalog}
                    />
                    <Section title="Style check" eyebrow="REFERENCE RANGES">
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
                              <b>{k.toUpperCase()}</b>
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
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </Section>
                    <Section title="Take it to the brewery">
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
                        <button onClick={() => window.print()}>
                          <Printer size={16} /> Print brew sheet
                        </button>
                      </div>
                    </Section>
                  </aside>
                </div>
                {p.warnings.length > 0 && (
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
              onOpen={(r) => {
                setRecipe(r);
                setTab("Recipe Editor");
              }}
              onNew={() => {
                setRecipe({
                  ...structuredClone(defaultRecipe),
                  id: crypto.randomUUID(),
                  name: "Untitled recipe",
                });
                setTab("Recipe Editor");
              }}
            />
          </div>
          <div hidden={tab !== "Ingredient Library"}>
            <Library
              catalog={libraryCatalog}
              us={us}
              batchL={recipe.batchL}
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
          <div hidden={tab !== "Design"}>
            <Design
              fromRecipe={designFromRecipe}
              catalog={catalog}
              userWeight={prefs.userWeight}
              us={us}
              onOpen={(r) => {
                setRecipe(r);
                setTab("Recipe Editor");
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
