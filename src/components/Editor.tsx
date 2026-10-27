import { Plus, Trash2, Wheat, Flower2, Thermometer } from "lucide-react";
import { useState } from "react";
import type { Recipe, Catalog } from "../engine/types";
import {
  cToF,
  fToC,
  kgToLb,
  KG_PER_LB,
  G_PER_OZ,
  scaleRecipe,
  lToGal,
  L_PER_GAL,
  midpoint,
} from "../engine/calculations";
import { brewingHelp } from "../brewingHelp";
import IngredientPicker from "./IngredientPicker";
import type { BuilderStep } from "../engine/builder";
import RecipeAdditives from "./RecipeAdditives";
import Suggestions from "./Suggestions";
import { Field, Section, Tag, HelpTerm } from "./ui";
import { alphabetical } from "../engine/search";
import { yeastFamilies, yeastGroups, yeastGuide } from "../engine/yeast";
import { consensus } from "../engine/flavor";
export default function Editor({
  recipe: r,
  onChange: set,
  catalog: c,
  us,
  section = "malts",
}: {
  recipe: Recipe;
  onChange: (r: Recipe) => void;
  catalog: Catalog;
  us: boolean;
  section?: BuilderStep;
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
        ? `Estimated associations at this temperature: ${traits
            .slice(0, 5)
            .map((d) => d.descriptor.replaceAll("-", " "))
            .join(
              ", ",
            )}. Check the ingredient library for source records and confidence.`
        : "No established beer flavor profile for this context. Record your own tasting observations.";
    })();
  const total = r.grains.reduce((s, g) => s + g.kg, 0);
  const temp = (v: number) => (us ? cToF(v) : v),
    fromTemp = (v: number) => (us ? fToC(v) : v);
  return (
    <div className="editor-stack">
      <Section
        hidden={section !== "malts"}
        title="Malt build"
        eyebrow="COLOR · MALT CHARACTER · GRAVITY"
        action={<Wheat size={22} />}
      >
        <div className="ingredient-header">
          <span>Fermentable</span>
          <span>Amount · {us ? "lb" : "kg"}</span>
          <span>
            <HelpTerm label="Grist" />
          </span>
        </div>
        {r.grains.map((g, i) => {
          const m = c.malts.find((m) => m.id === g.ingredientId)!;
          return (
            <div className="grain-row" key={i}>
              <div>
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
                  <HelpTerm
                    label={`${m.ppg.toFixed(1)} PPG`}
                    helpKey="Potential"
                  />
                </small>
              </div>
              <Field
                label="Amount"
                inputLabel={`${m.name} amount, fermentable ${i + 1}`}
                suffix={us ? "lb" : "kg"}
                value={us ? kgToLb(g.kg) : g.kg}
                min={0}
                step={0.05}
                onChange={(n) =>
                  update({
                    grains: r.grains.map((g, j) =>
                      j === i ? { ...g, kg: us ? n * KG_PER_LB : n } : g,
                    ),
                  })
                }
              />
              <span className="percent">
                {total ? ((g.kg / total) * 100).toFixed(1) : 0}%
              </span>
              <button
                className="icon-button"
                aria-label={`Remove grain ${i + 1}`}
                onClick={() =>
                  update({ grains: r.grains.filter((_, j) => i !== j) })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
        <button
          className="text-button"
          onClick={() =>
            update({
              grains: [...r.grains, { ingredientId: c.malts[0].id, kg: 0.25 }],
            })
          }
        >
          <Plus size={15} /> Add fermentable
        </button>
        <div className="grist-bar">
          {r.grains.map((g, i) => (
            <span
              key={i}
              style={{
                width: `${total ? (100 * g.kg) / total : 0}%`,
                background: [
                  "#bd8e4c",
                  "#dfb977",
                  "#72694e",
                  "#d48558",
                  "#465d4a",
                ][i % 5],
              }}
            />
          ))}
        </div>
        <small className="muted">
          Total grist: {(us ? kgToLb(total) : total).toFixed(2)}{" "}
          {us ? "lb" : "kg"}
        </small>
        <div className="field-grid">
          <Field
            label="Mash temperature"
            suffix={us ? "°F" : "°C"}
            value={temp(r.mashC)}
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
        <Suggestions
          kind="malt"
          recipe={r}
          catalog={c}
          onChange={set}
          us={us}
        />
      </Section>
      <Section
        hidden={section !== "hops"}
        title="Hop schedule"
        eyebrow="02 / BITTERNESS & AROMA"
        action={<Flower2 size={22} />}
      >
        {r.hops.map((h, i) => {
          const hop = c.hops.find((a) => a.id === h.ingredientId)!;
          const use =
            h.use === "dry hop"
              ? "Dry hopping"
              : h.use === "whirlpool"
                ? "Whirlpool"
                : "Boil";
          return (
            <article
              className="hop-addition"
              key={i}
              aria-label={`${hop.name} · ${use} · addition ${i + 1}`}
            >
              <header className="hop-addition-heading">
                <div>
                  <h3>{hop.name}</h3>
                  <span>{use}</span>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Remove ${hop.name} ${use.toLowerCase()} addition ${i + 1}`}
                  onClick={() =>
                    update({ hops: r.hops.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </header>
              <div className="hop-row">
                <div className="field">
                  <span>Hop variety</span>
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
                </div>
                <Field
                  label="Amount"
                  inputLabel={`${hop.name} ${use.toLowerCase()} amount, addition ${i + 1}`}
                  suffix={us ? "oz" : "g"}
                  value={us ? h.grams / G_PER_OZ : h.grams}
                  min={0}
                  step={us ? 0.1 : 1}
                  onChange={(n) =>
                    update({
                      hops: r.hops.map((h, j) =>
                        j === i ? { ...h, grams: us ? n * G_PER_OZ : n } : h,
                      ),
                    })
                  }
                />
                <label className="field">
                  <span>Add during</span>
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
                                  e.target.value === "dry hop" ? 4320 : 20,
                              }
                            : h,
                        ),
                      })
                    }
                  >
                    <option value="boil">Boil</option>
                    <option value="dry hop">Dry hopping</option>
                    <option value="whirlpool">Whirlpool</option>
                  </select>
                </label>
                <Field
                  label={
                    h.use === "boil" ? "Time before boil ends" : "Contact time"
                  }
                  inputLabel={`${hop.name} ${use.toLowerCase()} time, addition ${i + 1}`}
                  suffix={h.use === "dry hop" ? "days" : "min"}
                  help={brewingHelp(
                    h.use === "dry hop" ? "Hop days" : "Hop minutes",
                  )}
                  value={h.use === "dry hop" ? h.minutes / 1440 : h.minutes}
                  min={0}
                  step={1}
                  onChange={(n) =>
                    update({
                      hops: r.hops.map((h, j) =>
                        j === i
                          ? {
                              ...h,
                              minutes: n * (h.use === "dry hop" ? 1440 : 1),
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
        <button
          className="text-button"
          onClick={() =>
            update({
              hops: [
                ...r.hops,
                {
                  ingredientId: c.hops.find((h) => h.name === "Cascade")!.id,
                  grams: r.batchL * 0.75,
                  use: "boil",
                  minutes: 15,
                },
              ],
            })
          }
        >
          <Plus size={15} /> Add hop addition
        </button>
        <details className="advanced">
          <summary>Whirlpool utilization assumption</summary>{" "}
          <Field
            label="Whirlpool utilization factor"
            value={r.whirlpoolFactor}
            min={0}
            max={1}
            step={0.01}
            onChange={(n) => update({ whirlpoolFactor: n })}
          />
        </details>
        <Suggestions kind="hop" recipe={r} catalog={c} onChange={set} us={us} />
      </Section>
      <Section
        hidden={section !== "yeast"}
        title="Yeast & fermentation"
        eyebrow="03 / THE FERMENTATION"
        action={<Thermometer size={22} />}
      >
        <label className="field">
          <span>Yeast type</span>
          <select
            value={yeastType}
            onChange={(e) => setYeastType(e.target.value)}
          >
            <option value="">All yeast types</option>
            {alphabetical(yeastFamilies, (f) => f.label).map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          Type filters narrow the strain list. Choose a strain to change the
          recipe; your current strain stays available.
        </p>
        <div className="field">
          <span>Yeast strain</span>
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
        <div className="yeast-selection-profile">
          <h3>{yeast.name}</h3>
          <p className="muted">
            {yeast.lab}
            {yeast.code ? ` · ${yeast.code}` : ""}
          </p>
          <p>
            <Tag tone="objective">REFERENCE SPECS</Tag> Alcohol tolerance:{" "}
            <strong>
              {yeast.alcoholTolerance === null
                ? "Unknown for brewing"
                : `up to ${yeast.alcoholTolerance}% ABV`}
            </strong>
            .{" "}
            {yeast.attenuation
              ? `Apparent attenuation ${yeast.attenuation.join("–")}%.`
              : "Beer-wort attenuation unknown; FG/ABV use a labeled model assumption."}
          </p>
          <Tag>FLAVOR PROFILE · SUBJECTIVE</Tag>
          <p>{yeastFlavor}</p>
          <a href={yeast.source.url} target="_blank" rel="noreferrer">
            Strain source & specifications ↗
          </a>
        </div>
        <div className="field-grid">
          <Field
            label="Fermentation temperature"
            suffix={us ? "°F" : "°C"}
            value={temp(r.fermentC)}
            min={temp(0)}
            max={temp(45)}
            onChange={(n) => update({ fermentC: fromTemp(n) })}
          />
          <Field
            label="Pitch multiplier"
            suffix="×"
            value={r.pitchMultiplier}
            min={0.1}
            max={3}
            onChange={(n) => update({ pitchMultiplier: n })}
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
        <Tag tone="objective">Strain specs</Tag>
        <p className="muted">
          <HelpTerm label="Attenuation" />{" "}
          {c.yeasts.find((y) => y.id === r.yeastId)!.attenuation?.join("–") ??
            "Unknown for malt wort"}
          {c.yeasts.find((y) => y.id === r.yeastId)!.attenuation ? "%" : ""} ·
          Verify <HelpTerm label="POF" /> and <HelpTerm label="diastaticus" />{" "}
          status with the lab.
        </p>
      </Section>
      <div hidden={section !== "additives"}>
        <RecipeAdditives recipe={r} onChange={set} us={us} />
      </div>
    </div>
  );
}
