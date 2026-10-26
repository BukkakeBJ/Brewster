import { Plus, Trash2, Wheat, Flower2, Thermometer } from "lucide-react";
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
} from "../engine/calculations";
import Suggestions from "./Suggestions";
import { Field, Section, Tag } from "./ui";
export default function Editor({
  recipe: r,
  onChange: set,
  catalog: c,
  us,
}: {
  recipe: Recipe;
  onChange: (r: Recipe) => void;
  catalog: Catalog;
  us: boolean;
}) {
  const update = (patch: Partial<Recipe>) => set({ ...r, ...patch });
  const total = r.grains.reduce((s, g) => s + g.kg, 0);
  const temp = (v: number) => (us ? cToF(v) : v),
    fromTemp = (v: number) => (us ? fToC(v) : v);
  return (
    <div className="editor-stack">
      <Section
        title="Grain bill"
        eyebrow="01 / THE FOUNDATION"
        action={<Wheat size={22} />}
      >
        <div className="ingredient-header">
          <span>Fermentable</span>
          <span>Amount · {us ? "lb" : "kg"}</span>
          <span>Grist</span>
        </div>
        {r.grains.map((g, i) => {
          const m = c.malts.find((m) => m.id === g.ingredientId)!;
          return (
            <div className="grain-row" key={i}>
              <div>
                <select
                  aria-label={`Grain ${i + 1}`}
                  value={g.ingredientId}
                  onChange={(e) =>
                    update({
                      grains: r.grains.map((g, j) =>
                        j === i ? { ...g, ingredientId: e.target.value } : g,
                      ),
                    })
                  }
                >
                  {c.malts.map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <small>
                  {m.type} · {m.lovibond} °L · {m.ppg.toFixed(1)} PPG
                </small>
              </div>
              <Field
                label={`Grain ${i + 1} amount`}
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
        <Suggestions
          kind="malt"
          recipe={r}
          catalog={c}
          onChange={set}
          us={us}
        />
      </Section>
      <Section
        title="Hop schedule"
        eyebrow="02 / BITTERNESS & AROMA"
        action={<Flower2 size={22} />}
      >
        {r.hops.map((h, i) => (
          <div className="hop-row" key={i}>
            <select
              aria-label={`Hop ${i + 1}`}
              value={h.ingredientId}
              onChange={(e) =>
                update({
                  hops: r.hops.map((h, j) =>
                    j === i
                      ? { ...h, ingredientId: e.target.value, alpha: undefined }
                      : h,
                  ),
                })
              }
            >
              {c.hops.map((h) => (
                <option value={h.id} key={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <Field
              label={`Hop ${i + 1} amount (${us ? "oz" : "g"})`}
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
            <select
              aria-label={`Hop ${i + 1} use`}
              value={h.use}
              onChange={(e) =>
                update({
                  hops: r.hops.map((h, j) =>
                    j === i
                      ? {
                          ...h,
                          use: e.target.value as typeof h.use,
                          minutes: e.target.value === "dry hop" ? 4320 : 20,
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
            <Field
              label={
                h.use === "dry hop"
                  ? `Hop ${i + 1} days`
                  : `Hop ${i + 1} minutes`
              }
              value={h.use === "dry hop" ? h.minutes / 1440 : h.minutes}
              min={0}
              step={1}
              onChange={(n) =>
                update({
                  hops: r.hops.map((h, j) =>
                    j === i
                      ? { ...h, minutes: n * (h.use === "dry hop" ? 1440 : 1) }
                      : h,
                  ),
                })
              }
            />
            <Field
              label={`Hop ${i + 1} AA %`}
              value={
                h.alpha ?? c.hops.find((a) => a.id === h.ingredientId)!.alpha[0]
              }
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
            <button
              className="icon-button"
              aria-label={`Remove hop ${i + 1}`}
              onClick={() => update({ hops: r.hops.filter((_, j) => j !== i) })}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button
          className="text-button"
          onClick={() =>
            update({
              hops: [
                ...r.hops,
                {
                  ingredientId: c.hops.find((h) => h.name === "Cascade")!.id,
                  grams: 25,
                  use: "boil",
                  minutes: 15,
                },
              ],
            })
          }
        >
          <Plus size={15} /> Add hop addition
        </button>
        <Suggestions kind="hop" recipe={r} catalog={c} onChange={set} us={us} />
      </Section>
      <Section
        title="Yeast & process"
        eyebrow="03 / THE FERMENTATION"
        action={<Thermometer size={22} />}
      >
        <label className="field">
          <span>Yeast strain</span>
          <select
            value={r.yeastId}
            onChange={(e) => update({ yeastId: e.target.value })}
          >
            {c.yeasts.map((y) => (
              <option value={y.id} key={y.id}>
                {y.lab} {y.code} · {y.name} ({y.form})
              </option>
            ))}
          </select>
        </label>
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
          <Field
            label="Whirlpool utilization factor"
            value={r.whirlpoolFactor}
            min={0}
            max={1}
            step={0.01}
            onChange={(n) => update({ whirlpoolFactor: n })}
          />
        </div>
        <Tag tone="objective">Strain specs</Tag>
        <p className="muted">
          Attenuation{" "}
          {c.yeasts.find((y) => y.id === r.yeastId)!.attenuation.join("–")}% ·
          Verify POF and diastaticus status with the lab.
        </p>
      </Section>
      <Section title="Batch & equipment" eyebrow="YOUR BREWHOUSE">
        <p className="muted">
          Changing volume or efficiency here scales ingredient amounts to
          preserve gravity. Hop timing and boil-off rate stay fixed.
        </p>
        <div className="field-grid">
          <Field
            label="Post-boil batch size"
            suffix={us ? "gal" : "L"}
            value={us ? lToGal(r.batchL) : r.batchL}
            min={us ? 0.14 : 0.5}
            onChange={(n) =>
              set(scaleRecipe(r, us ? n * L_PER_GAL : n, r.efficiency, c))
            }
          />
          <Field
            label="Brewhouse efficiency"
            suffix="%"
            value={r.efficiency}
            min={1}
            max={100}
            step={1}
            onChange={(n) => set(scaleRecipe(r, r.batchL, n, c))}
          />
          <Field
            label="Boil duration"
            suffix="min"
            value={r.boilMinutes}
            min={0}
            max={240}
            step={1}
            onChange={(n) => update({ boilMinutes: n })}
          />
          <Field
            label="Boil-off rate"
            suffix={us ? "gal/h" : "L/h"}
            value={us ? lToGal(r.boilOffLPerHour) : r.boilOffLPerHour}
            min={0}
            onChange={(n) =>
              update({ boilOffLPerHour: us ? n * L_PER_GAL : n })
            }
          />
          <Field
            label="Transfer loss"
            suffix={us ? "gal" : "L"}
            value={us ? lToGal(r.lossL) : r.lossL}
            min={0}
            max={(us ? lToGal(r.batchL) : r.batchL) - 0.1}
            onChange={(n) => update({ lossL: us ? n * L_PER_GAL : n })}
          />
        </div>
      </Section>
    </div>
  );
}
