import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { Recipe, Catalog, Target } from "../engine/types";
import {
  cToF,
  fToC,
  kgToLb,
  KG_PER_LB,
  G_PER_OZ,
  midpoint,
  predict,
} from "../engine/calculations";
import { brewingHelp } from "../brewingHelp";
import IngredientPicker, { IngredientInfo } from "./IngredientPicker";
import type { BuilderStep } from "../engine/builder";
import Suggestions from "./Suggestions";
import HopSuggestions from "./HopSuggestions";
import { Field, Section, HelpTerm } from "./ui";
import { alphabetical } from "../engine/search";
import { yeastFamilies, yeastGroups, yeastGuide } from "../engine/yeast";
import { consensus } from "../engine/flavor";
import { ingredientMatches } from "../engine/recommendations";
import { waterSettings } from "../engine/waterPlan";

const GRIST_COLORS = ["#c99a55", "#e2c27f", "#8a6a3c", "#d48558", "#55705a"];

export default function Editor({
  recipe: r,
  onChange: set,
  onSettings,
  catalog: c,
  us,
  section = "malts",
  target,
  userWeight,
}: {
  recipe: Recipe;
  onChange: (r: Recipe) => void;
  /** Saves edits to the recipe's water/pitching assumptions without rescaling ingredients. */
  onSettings: (r: Recipe) => void;
  catalog: Catalog;
  us: boolean;
  section?: BuilderStep;
  target: Target;
  userWeight: number;
}) {
  const update = (patch: Partial<Recipe>) => set({ ...r, ...patch });
  const [yeastType, setYeastType] = useState("");
  const yeast = c.yeasts.find((y) => y.id === r.yeastId)!;
  const yeastOptions = c.yeasts.filter(
    (y) =>
      y.id === r.yeastId ||
      !yeastType ||
      yeastGroups(y).some((g) => g.id === yeastType),
  );
  const yeastFlavor =
    yeastGuide(yeast)?.flavor ??
    (() => {
      const traits = consensus(
        c.descriptors.filter((d) => d.ingredientId === yeast.id),
        { tempC: r.fermentC },
      );
      return traits.length
        ? `Tends toward ${traits
            .slice(0, 5)
            .map((d) => d.descriptor.replaceAll("-", " "))
            .join(", ")} at this temperature.`
        : "No established beer flavor profile yet. Record your own tasting notes in the Brew Log.";
    })();
  const total = r.grains.reduce((s, g) => s + g.kg, 0);
  const temp = (v: number) => (us ? cToF(v) : v),
    fromTemp = (v: number) => (us ? fToC(v) : v),
    tempUnit = us ? "°F" : "°C";
  const settings = waterSettings(r, c);
  const p = predict(r, c);
  const dry = yeast.form === "dry";
  const useLabel = (use: string) =>
    use === "dry hop" ? "Dry hop" : use === "whirlpool" ? "Whirlpool" : "Boil";
  return (
    <div className="editor-stack">
      {section === "malts" && (
        <>
          <Section
            title="Malts & sugars"
            action={
              <span className="muted">
                Total {(us ? kgToLb(total) : total).toFixed(2)}{" "}
                {us ? "lb" : "kg"}
              </span>
            }
          >
            <div className="grist-bar" aria-hidden="true">
              {r.grains.map((g, i) => (
                <span
                  key={i}
                  style={{
                    width: `${total ? (100 * g.kg) / total : 0}%`,
                    background: GRIST_COLORS[i % GRIST_COLORS.length],
                  }}
                />
              ))}
            </div>
            <div className="ingredient-list">
              {r.grains.map((g, i) => {
                const m = c.malts.find((m) => m.id === g.ingredientId)!;
                return (
                  <div className="grain-row" key={i}>
                    <i
                      className="grain-key"
                      style={{
                        background: GRIST_COLORS[i % GRIST_COLORS.length],
                      }}
                    />
                    <div className="grain-name">
                      <IngredientPicker
                        label={`Fermentable ${i + 1}`}
                        items={c.malts}
                        selectedId={g.ingredientId}
                        catalog={c}
                        us={us}
                        usage={{ percent: total ? (100 * g.kg) / total : 0 }}
                        onChange={(id) =>
                          update({
                            grains: r.grains.map((row, j) =>
                              j === i ? { ...row, ingredientId: id } : row,
                            ),
                          })
                        }
                      />
                      <small>
                        {m.type} · {m.lovibond} °L ·{" "}
                        {total ? ((g.kg / total) * 100).toFixed(0) : 0}% of
                        grain bill
                      </small>
                    </div>
                    <Field
                      label="Amount"
                      inputLabel={`${m.name} amount, fermentable ${i + 1}`}
                      suffix={us ? "lb" : "kg"}
                      value={us ? kgToLb(g.kg) : g.kg}
                      min={0}
                      step={0.05}
                      decimals={2}
                      help=""
                      onChange={(n) =>
                        update({
                          grains: r.grains.map((g, j) =>
                            j === i ? { ...g, kg: us ? n * KG_PER_LB : n } : g,
                          ),
                        })
                      }
                    />
                    <button
                      className="icon-button"
                      aria-label={`Remove ${m.name}`}
                      onClick={() =>
                        update({ grains: r.grains.filter((_, j) => i !== j) })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              {!r.grains.length && (
                <p className="empty-row">
                  No malts yet. Most beers start with a base malt such as 2-Row
                  or Pilsner.
                </p>
              )}
            </div>
            <IngredientPicker
              label="Add a malt or sugar"
              addLabel="Add malt"
              items={c.malts}
              selectedId=""
              catalog={c}
              us={us}
              onChange={(id) =>
                update({
                  grains: [
                    ...r.grains,
                    { ingredientId: id, kg: us ? 0.5 * KG_PER_LB : 0.25 },
                  ],
                })
              }
            />
          </Section>
          <Section title="Mash">
            <p className="muted">
              Mash cooler ({us ? "148–150 °F" : "64–65 °C"}) for a drier,
              crisper beer, or warmer ({us ? "154–158 °F" : "68–70 °C"}) for
              more body and sweetness.
            </p>
            <div className="field-grid">
              <Field
                label="Mash temperature"
                suffix={tempUnit}
                value={temp(r.mashC)}
                decimals={1}
                min={temp(40)}
                max={temp(85)}
                onChange={(n) => update({ mashC: fromTemp(n) })}
              />
              <Field
                label="Mash duration"
                suffix="min"
                value={r.mashMinutes}
                min={1}
                max={240}
                step={1}
                onChange={(n) => update({ mashMinutes: n })}
              />
            </div>
          </Section>
          <Suggestions
            kind="malt"
            recipe={r}
            catalog={c}
            onChange={set}
            us={us}
          />
        </>
      )}
      {section === "hops" && (
        <>
          <Section title="Hop schedule">
            <div className="ingredient-list">
              {r.hops.map((h, i) => {
                const hop = c.hops.find((a) => a.id === h.ingredientId)!;
                const use = useLabel(h.use);
                return (
                  <article
                    className="hop-addition"
                    key={i}
                    aria-label={`${hop.name} · ${use} · addition ${i + 1}`}
                  >
                    <div className="hop-addition-head">
                      <span className={`use-badge ${h.use.replace(" ", "-")}`}>
                        {use}
                      </span>
                      <IngredientPicker
                        label={`Hop variety for addition ${i + 1}`}
                        items={c.hops}
                        selectedId={h.ingredientId}
                        catalog={c}
                        usage={{ use: h.use }}
                        us={us}
                        onChange={(id) =>
                          update({
                            hops: r.hops.map((row, j) =>
                              j === i
                                ? { ...row, ingredientId: id, alpha: undefined }
                                : row,
                            ),
                          })
                        }
                      />
                      <button
                        className="icon-button"
                        aria-label={`Remove ${hop.name} ${use.toLowerCase()} addition ${i + 1}`}
                        onClick={() =>
                          update({ hops: r.hops.filter((_, j) => j !== i) })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="hop-row">
                      <Field
                        label="Amount"
                        inputLabel={`${hop.name} ${use.toLowerCase()} amount, addition ${i + 1}`}
                        suffix={us ? "oz" : "g"}
                        value={us ? h.grams / G_PER_OZ : h.grams}
                        min={0}
                        step={us ? 0.1 : 1}
                        decimals={us ? 2 : 0}
                        help=""
                        onChange={(n) =>
                          update({
                            hops: r.hops.map((h, j) =>
                              j === i
                                ? { ...h, grams: us ? n * G_PER_OZ : n }
                                : h,
                            ),
                          })
                        }
                      />
                      <label className="field">
                        <span>When</span>
                        <select
                          aria-label={`Addition stage for ${hop.name}, addition ${i + 1}`}
                          value={h.use}
                          onChange={(e) =>
                            update({
                              hops: r.hops.map((h, j) =>
                                j === i
                                  ? {
                                      ...h,
                                      use: e.target.value as typeof h.use,
                                      minutes:
                                        e.target.value === "dry hop"
                                          ? 4320
                                          : 20,
                                    }
                                  : h,
                              ),
                            })
                          }
                        >
                          <option value="boil">Boil</option>
                          <option value="whirlpool">Whirlpool</option>
                          <option value="dry hop">Dry hop</option>
                        </select>
                      </label>
                      <Field
                        label={
                          h.use === "boil"
                            ? "Minutes left in boil"
                            : h.use === "whirlpool"
                              ? "Whirlpool minutes"
                              : "Dry hop days"
                        }
                        inputLabel={`${hop.name} ${use.toLowerCase()} time, addition ${i + 1}`}
                        suffix={h.use === "dry hop" ? "days" : "min"}
                        help={brewingHelp(
                          h.use === "dry hop" ? "Hop days" : "Hop minutes",
                        )}
                        value={
                          h.use === "dry hop" ? h.minutes / 1440 : h.minutes
                        }
                        decimals={1}
                        min={0}
                        step={1}
                        onChange={(n) =>
                          update({
                            hops: r.hops.map((h, j) =>
                              j === i
                                ? {
                                    ...h,
                                    minutes:
                                      n * (h.use === "dry hop" ? 1440 : 1),
                                  }
                                : h,
                            ),
                          })
                        }
                      />
                      <Field
                        label="Alpha acids"
                        inputLabel={`${hop.name} alpha acids, addition ${i + 1}`}
                        suffix="%"
                        value={h.alpha ?? midpoint(hop.alpha)}
                        decimals={1}
                        min={0}
                        max={100}
                        onChange={(n) =>
                          update({
                            hops: r.hops.map((h, j) =>
                              j === i ? { ...h, alpha: n } : h,
                            ),
                          })
                        }
                      />
                    </div>
                  </article>
                );
              })}
              {!r.hops.length && (
                <p className="empty-row">
                  No hops yet. Add one below, or pick from the suggestions.
                </p>
              )}
            </div>
            <IngredientPicker
              label="Add a hop"
              addLabel="Add hop"
              items={c.hops}
              selectedId=""
              catalog={c}
              us={us}
              onChange={(id) =>
                update({
                  hops: [
                    ...r.hops,
                    {
                      ingredientId: id,
                      grams: r.batchL * 0.75,
                      use: "boil",
                      minutes: r.hops.some((h) => h.use === "boil") ? 15 : 60,
                    },
                  ],
                })
              }
            />
            <details className="advanced">
              <summary>Whirlpool bitterness assumption</summary>
              <Field
                label="Whirlpool utilization factor"
                value={r.whirlpoolFactor}
                min={0}
                max={1}
                step={0.01}
                onChange={(n) => update({ whirlpoolFactor: n })}
              />
            </details>
          </Section>
          <HopSuggestions
            recipe={r}
            catalog={c}
            target={target}
            userWeight={userWeight}
            us={us}
            onChange={set}
          />
        </>
      )}
      {section === "yeast" && (
        <>
          <Section title="Your yeast">
            <div className="yeast-current">
              <div className="ingredient-name-with-info">
                <h3>{yeast.name}</h3>
                <IngredientInfo
                  item={yeast}
                  catalog={c}
                  usage={{ tempC: r.fermentC }}
                  us={us}
                />
              </div>
              <p className="muted">
                {yeast.lab}
                {yeast.code ? ` · ${yeast.code}` : ""} · {yeast.form}
              </p>
              <p>{yeastFlavor}</p>
              <dl className="mini-specs">
                <div>
                  <dt>
                    <HelpTerm label="Attenuation" />
                  </dt>
                  <dd>
                    {yeast.attenuation
                      ? `${yeast.attenuation.join("–")}%`
                      : "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt>Best temperature</dt>
                  <dd>
                    {yeast.tempC
                      ? `${yeast.tempC.map((t) => temp(t).toFixed(0)).join("–")} ${tempUnit}`
                      : "Not published"}
                  </dd>
                </div>
                <div>
                  <dt>
                    <HelpTerm label="Alcohol tolerance" />
                  </dt>
                  <dd>
                    {yeast.alcoholTolerance === null
                      ? "Unknown"
                      : `Up to ${yeast.alcoholTolerance}%`}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="yeast-change">
              <label className="field">
                <span>Yeast type</span>
                <select
                  value={yeastType}
                  onChange={(e) => setYeastType(e.target.value)}
                >
                  <option value="">All types</option>
                  {alphabetical(yeastFamilies, (f) => f.label).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span>Change strain</span>
                <IngredientPicker
                  label="Yeast strain"
                  items={yeastOptions}
                  selectedId={r.yeastId}
                  catalog={c}
                  usage={{ tempC: r.fermentC }}
                  us={us}
                  onChange={(id) => update({ yeastId: id })}
                />
              </div>
            </div>
          </Section>
          <Section title="Good matches for your goals">
            <div className="yeast-suggestion-list">
              {ingredientMatches(target, c, userWeight)
                .yeasts.slice(0, 3)
                .map((match) => {
                  const option = c.yeasts.find((y) => y.id === match.id)!;
                  const estimate = predict({ ...r, yeastId: option.id }, c);
                  const chosen = r.yeastId === option.id;
                  return (
                    <article
                      key={option.id}
                      className={chosen ? "selected" : ""}
                    >
                      <div className="ingredient-name-with-info">
                        <h3>{option.name}</h3>
                        <IngredientInfo item={option} catalog={c} us={us} />
                      </div>
                      <p className="muted">
                        {option.lab} {option.code}
                      </p>
                      <p>
                        {match.descriptors
                          .slice(0, 3)
                          .map((d) => d.label)
                          .join(" · ") || "Neutral character"}
                      </p>
                      <p className="yeast-estimate">
                        <strong>{estimate.abv.toFixed(1)}% ABV</strong> · FG{" "}
                        {estimate.fg.toFixed(3)}
                      </p>
                      <button
                        className={`button ${chosen ? "ghost" : "secondary"}`}
                        type="button"
                        disabled={chosen}
                        onClick={() =>
                          set({
                            ...r,
                            yeastId: option.id,
                            fermentC: option.tempC
                              ? Math.min(
                                  option.tempC[1],
                                  Math.max(option.tempC[0], r.fermentC),
                                )
                              : r.fermentC,
                          })
                        }
                      >
                        {chosen ? "In your recipe" : "Use this yeast"}
                      </button>
                    </article>
                  );
                })}
            </div>
          </Section>
          <Section title="Fermentation">
            <div className="field-grid">
              <Field
                label="Fermentation temperature"
                suffix={tempUnit}
                value={temp(r.fermentC)}
                decimals={1}
                min={temp(0)}
                max={temp(45)}
                onChange={(n) => update({ fermentC: fromTemp(n) })}
              />
              <Field
                label="Carbonation"
                suffix="vol"
                value={r.carbonation}
                min={0}
                max={5}
                onChange={(n) => update({ carbonation: n })}
              />
            </div>
            <p className="muted">
              Pitch about <strong>{p.pitchBillion.toFixed(0)} billion</strong>{" "}
              healthy cells:{" "}
              {dry
                ? `≈ ${(p.pitchBillion / settings.dryCellsBillionPerG).toFixed(1)} g, or ${Math.ceil(p.pitchBillion / settings.dryCellsBillionPerG / settings.dryPackGrams)} packet(s) of ${settings.dryPackGrams} g`
                : `≈ ${Math.ceil(p.pitchBillion / settings.liquidCellsBillionPerPack)} fresh liquid pack(s), or a starter`}
              .
            </p>
            <details className="advanced">
              <summary>Pitching assumptions</summary>
              <div className="field-grid">
                <Field
                  label="Pitch multiplier"
                  suffix="×"
                  value={r.pitchMultiplier}
                  min={0.1}
                  max={3}
                  onChange={(n) => update({ pitchMultiplier: n })}
                />
                <Field
                  label={
                    dry ? "Viable cells per gram" : "Viable cells per pack"
                  }
                  suffix="billion"
                  value={
                    dry
                      ? settings.dryCellsBillionPerG
                      : settings.liquidCellsBillionPerPack
                  }
                  min={0.1}
                  help="Use the cell count your supplier lists, allowing for age and storage."
                  onChange={(n) =>
                    onSettings({
                      ...r,
                      waterPlan: {
                        ...settings,
                        ...(dry
                          ? { dryCellsBillionPerG: n }
                          : { liquidCellsBillionPerPack: n }),
                      },
                    })
                  }
                />
                {dry && (
                  <Field
                    label="Dry yeast packet size"
                    suffix="g"
                    value={settings.dryPackGrams}
                    min={0.1}
                    onChange={(n) =>
                      onSettings({
                        ...r,
                        waterPlan: { ...settings, dryPackGrams: n },
                      })
                    }
                  />
                )}
              </div>
            </details>
          </Section>
        </>
      )}
    </div>
  );
}
