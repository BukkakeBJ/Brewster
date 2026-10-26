import { useState } from "react";
import {
  createCustomAdditive,
  displayAdditiveAmount,
  canonicalAdditiveAmount,
  type AdditiveAddition,
  type AdditiveUnit,
} from "../engine/additives";
import { processStages, type ProcessStage } from "../engine/processNotes";
import { additiveAdditionSchema } from "../validation";
import { Field, Tag } from "./ui";
export default function CustomAdditiveForm({
  us = false,
  onAdd,
}: {
  us?: boolean;
  onAdd: (addition: AdditiveAddition) => void;
}) {
  const [name, setName] = useState(""),
    [amount, setAmount] = useState(0),
    [unit, setUnit] = useState<AdditiveUnit>("g"),
    [stage, setStage] = useState<ProcessStage>("conditioning"),
    [time, setTime] = useState(0),
    [timeUnit, setTimeUnit] = useState<AdditiveAddition["timeUnit"]>("days"),
    [notes, setNotes] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const shown = displayAdditiveAmount(amount, unit, us);
  return (
    <details className="advanced custom-additive-form">
      <summary>Add a custom additive · not listed?</summary>
      <p className="muted">
        Enter anything missing from the library. It stays labeled as your custom
        entry and saves with this recipe.
      </p>
      <Tag tone="neutral">USER-DEFINED · NO CATALOG SPECS</Tag>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          try {
            const addition = additiveAdditionSchema.parse({
              ...createCustomAdditive(name, crypto.randomUUID()),
              amount,
              unit,
              stage,
              time,
              timeUnit,
              notes,
            });
            onAdd(addition);
            setStatus(`${addition.customName} added to the recipe.`);
            setName("");
            setAmount(0);
            setTime(0);
            setNotes("");
          } catch {
            setError("Enter a name and valid nonnegative amount and timing.");
          }
        }}
      >
        <label className="field">
          <span>Custom additive name</span>
          <input
            required
            maxLength={200}
            value={name}
            placeholder="e.g. Maple extract, tea blend, homemade tincture…"
            onChange={(e) => {
              setName(e.target.value);
              setStatus("");
            }}
          />
        </label>
        <div className="field-grid">
          <Field
            label="Custom additive amount"
            value={shown.amount}
            min={0}
            step={unit === "item" ? 0.25 : 0.1}
            suffix={shown.unit}
            onChange={(n) => setAmount(canonicalAdditiveAmount(n, unit, us))}
          />
          <label className="field">
            <span>Custom additive unit</span>
            <select
              aria-label="Custom additive unit"
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value as AdditiveUnit);
                setAmount(0);
              }}
            >
              <option value="g">{us ? "Weight · oz" : "Weight · g"}</option>
              <option value="mL">
                {us ? "Liquid · US fl oz" : "Liquid · mL"}
              </option>
              <option value="item">Item / count</option>
            </select>
          </label>
          <label className="field">
            <span>Custom additive stage</span>
            <select
              aria-label="Custom additive stage"
              value={stage}
              onChange={(e) => setStage(e.target.value as ProcessStage)}
            >
              {processStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={
              stage === "boil"
                ? "Custom additive time before boil end"
                : "Custom additive contact time"
            }
            value={time}
            min={0}
            step={1}
            onChange={setTime}
          />
          <label className="field">
            <span>Custom additive time unit</span>
            <select
              aria-label="Custom additive time unit"
              value={timeUnit}
              onChange={(e) =>
                setTimeUnit(e.target.value as AdditiveAddition["timeUnit"])
              }
            >
              {["minutes", "hours", "days"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Custom additive experiment notes</span>
          <textarea
            rows={3}
            maxLength={10000}
            value={notes}
            placeholder="Product or source, preparation, amount rationale, steeping method, tasting checks…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <p className="muted">
          Changing between weight, liquid and count resets the amount. Custom
          additions have the same base-beer prediction limits as catalog
          additives.
        </p>
        <button className="button secondary" type="submit">
          Add custom additive to recipe
        </button>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        {status && <p role="status">{status}</p>}
      </form>
    </details>
  );
}
