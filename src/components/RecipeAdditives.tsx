import { useEffect, useState } from "react";
import CustomAdditiveForm from "./CustomAdditiveForm";
import type { Recipe } from "../engine/types";
import {
  type AdditiveAddition,
  additiveName,
  CUSTOM_ADDITIVE_ID,
  additiveModelNote,
  createAdditiveAddition,
  displayAdditiveAmount,
  canonicalAdditiveAmount,
} from "../engine/additives";
import { processStages } from "../engine/processNotes";
import AdditiveLibrary from "./AdditiveLibrary";
import { Field, Section, Tag } from "./ui";
export function ReadOnlyAdditives({
  recipe,
  us = false,
}: {
  recipe: Recipe;
  us?: boolean;
}) {
  if (!recipe.additives?.length) return null;
  return (
    <div className="saved-additives">
      <h3>Optional additives & process aids</h3>
      <p className="muted">{additiveModelNote}</p>
      {recipe.additives.map((row) => {
        const amount = displayAdditiveAmount(row.amount, row.unit, us);
        return (
          <div key={row.id}>
            <h4>{additiveName(row)}</h4>
            {row.ingredientId === CUSTOM_ADDITIVE_ID && (
              <Tag tone="neutral">CUSTOM · USER-DEFINED</Tag>
            )}
            <p>
              {amount.amount.toFixed(2)} {amount.unit} ·{" "}
              {processStages.find((s) => s.id === row.stage)?.label} ·{" "}
              {row.time} {row.timeUnit}
              {row.stage === "boil"
                ? " before boil end"
                : " contact / settling"}
              {row.amount === 0 ? " · Dose not set" : ""}
            </p>
            {row.notes && <p className="saved-additive-note">{row.notes}</p>}
          </div>
        );
      })}
    </div>
  );
}
export default function RecipeAdditives({
  recipe: r,
  onChange,
  us,
}: {
  recipe: Recipe;
  onChange: (r: Recipe) => void;
  us: boolean;
}) {
  const rows = r.additives ?? [];
  return (
    <div className="recipe-additives-editor">
      <Section
        title="Optional additives"
        eyebrow="FLAVOR EXPERIMENTS & PROCESS AIDS"
      >
        <p className="muted">
          Record cocoa nib steeping, oak contact, spirit blending, finings and
          other experiments. Notes, amounts and timing save with the recipe.
        </p>
        {rows.length > 0 && (
          <p className="additive-model-note" role="note">
            {additiveModelNote}
          </p>
        )}
        {rows.map((row) => {
          const name = additiveName(row),
            amount = displayAdditiveAmount(row.amount, row.unit, us);
          const update = (patch: Partial<typeof row>) =>
            onChange({
              ...r,
              additives: rows.map((a) =>
                a.id === row.id ? { ...a, ...patch } : a,
              ),
            });
          return (
            <article className="additive-schedule-row" key={row.id}>
              <h3>{additiveName(row)}</h3>
              <Tag tone="objective">
                RECORDED ADDITION · EFFECTS NOT MODELED
              </Tag>
              {row.ingredientId === CUSTOM_ADDITIVE_ID && (
                <>
                  <Tag tone="neutral">CUSTOM ADDITIVE · USER-DEFINED</Tag>
                  <CustomName
                    row={row}
                    onChange={(customName) => update({ customName })}
                  />
                  <label className="field">
                    <span>Amount unit for {name}</span>
                    <select
                      value={row.unit}
                      onChange={(e) =>
                        update({
                          unit: e.target.value as typeof row.unit,
                          amount: 0,
                        })
                      }
                    >
                      <option value="g">
                        {us ? "Weight · oz" : "Weight · g"}
                      </option>
                      <option value="mL">
                        {us ? "Liquid · US fl oz" : "Liquid · mL"}
                      </option>
                      <option value="item">Item / count</option>
                    </select>
                  </label>
                  <p className="muted">
                    Changing units resets the amount; weight and volume need
                    separate measurements.
                  </p>
                </>
              )}
              <div className="field-grid">
                <Field
                  label={`${name} amount`}
                  value={amount.amount}
                  suffix={amount.unit}
                  min={0}
                  step={row.unit === "item" ? 0.25 : 0.1}
                  onChange={(n) =>
                    update({ amount: canonicalAdditiveAmount(n, row.unit, us) })
                  }
                />
                <label className="field">
                  <span>Addition stage for {name}</span>
                  <select
                    value={row.stage}
                    onChange={(e) =>
                      update({ stage: e.target.value as typeof row.stage })
                    }
                  >
                    {processStages.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label={`${name} ${row.stage === "boil" ? "time before boil end" : "contact time"}`}
                  value={row.time}
                  min={0}
                  step={1}
                  onChange={(n) => update({ time: n })}
                />
                <label className="field">
                  <span>Time unit for {name}</span>
                  <select
                    value={row.timeUnit}
                    onChange={(e) =>
                      update({
                        timeUnit: e.target.value as typeof row.timeUnit,
                      })
                    }
                  >
                    {["minutes", "hours", "days"].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
              </div>
              {row.amount === 0 && (
                <p className="muted">
                  Dose not set: choose an amount from the product label or a
                  measured trial.
                </p>
              )}
              <label className="field">
                <span>{name} experiment notes</span>
                <textarea
                  rows={3}
                  maxLength={10000}
                  value={row.notes}
                  placeholder="Preparation, steeping method, spirit strength, tasting checks, outcome…"
                  onChange={(e) => update({ notes: e.target.value })}
                />
              </label>
              <button
                className="text-button"
                onClick={() =>
                  onChange({
                    ...r,
                    additives: rows.filter((a) => a.id !== row.id),
                  })
                }
              >
                Remove {name} addition
              </button>
            </article>
          );
        })}
        <CustomAdditiveForm
          us={us}
          onAdd={(addition) =>
            onChange({ ...r, additives: [...rows, addition] })
          }
        />
        <details className="advanced" open>
          <summary>Browse additives & add to this recipe</summary>
          <AdditiveLibrary
            compact
            batchL={r.batchL}
            us={us}
            onAdd={(id) =>
              onChange({
                ...r,
                additives: [
                  ...rows,
                  createAdditiveAddition(id, r.batchL, crypto.randomUUID()),
                ],
              })
            }
          />
        </details>
      </Section>
    </div>
  );
}

function CustomName({
  row,
  onChange,
}: {
  row: AdditiveAddition;
  onChange: (name: string) => void;
}) {
  const [draft, setDraft] = useState(row.customName ?? "");
  useEffect(() => setDraft(row.customName ?? ""), [row.customName]);
  return (
    <label className="field">
      <span>Edit custom additive name</span>
      <input
        value={draft}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const value = draft.trim();
          if (value) {
            onChange(value);
            setDraft(value);
          } else setDraft(row.customName ?? "");
        }}
      />
    </label>
  );
}
