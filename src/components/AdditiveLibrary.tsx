import CustomAdditiveForm from "./CustomAdditiveForm";
import type { AdditiveAddition } from "../engine/additives";
import { lToGal } from "../engine/calculations";
import { useState } from "react";
import {
  additives,
  additiveDescriptors,
  findAdditives,
  displayAdditiveAmount,
} from "../engine/additives";
import { processStages } from "../engine/processNotes";
import { Tag } from "./ui";
import { Plus } from "lucide-react";
export default function AdditiveLibrary({
  us = false,
  batchL = 20,
  onAdd,
  compact = false,
  onAddCustom,
}: {
  us?: boolean;
  batchL?: number;
  onAdd?: (id: string) => void;
  compact?: boolean;
  onAddCustom?: (addition: AdditiveAddition) => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [stage, setStage] = useState(""),
    [limit, setLimit] = useState(compact ? 4 : 12);
  const rows = findAdditives(query, category, stage);
  return (
    <div className="additive-library">
      <p className="muted">
        Optional flavor additions and process aids, organized by brewing stage.
        Guides are starting points; use your product label and record trials.
        Additions join the current recipe’s schedule.
      </p>
      {onAddCustom && <CustomAdditiveForm us={us} onAdd={onAddCustom} />}
      <div className="field-grid">
        <label className="field">
          <span>Search additives</span>
          <input
            value={query}
            placeholder="Cocoa nibs, oak chips, bourbon, Irish moss…"
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(compact ? 4 : 12);
            }}
          />
        </label>
        <label className="field">
          <span>Additive category</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setLimit(compact ? 4 : 12);
            }}
          >
            <option value="">All categories</option>
            {[...new Set(additives.map((a) => a.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Suggested addition stage</span>
          <select
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setLimit(compact ? 4 : 12);
            }}
          >
            <option value="">All stages</option>
            {processStages.map((s) => (
              <option value={s.id} key={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">
        {rows.length} additives · {(us ? lToGal(batchL) : batchL).toFixed(1)}{" "}
        {us ? "US gal" : "L"} planning volume
      </p>
      <div className={compact ? "additive-guide-grid" : "library-grid"}>
        {rows.slice(0, limit).map((a) => {
          const dose = displayAdditiveAmount(
            (a.guide.amountPer20L * batchL) / 20,
            a.guide.unit,
            us,
          );
          const descriptors = additiveDescriptors.filter(
            (d) => d.ingredientId === a.id,
          );
          return (
            <article className="additive-card" key={a.id}>
              <header className="additive-card-title">
                <span>{a.category}</span>
                <h3>{a.name}</h3>
              </header>
              <Tag tone="objective">REFERENCE IDENTITY</Tag>
              <p>{a.form}</p>
              <p className="muted">
                Suggested stage:{" "}
                {a.stages
                  .map((id) => processStages.find((s) => s.id === id)?.label)
                  .join(", ")}
              </p>
              <Tag tone="subjective">
                USAGE GUIDE · {a.guide.doseBasis.toUpperCase()}
              </Tag>
              <p>
                {a.guide.amountPer20L > 0
                  ? `${dose.amount.toFixed(dose.unit === "item" ? 2 : 1)} ${dose.unit} for this batch`
                  : "Set amount from your product label or bench trial"}{" "}
                · {a.guide.time} {a.guide.timeUnit}
                {a.stages[0] === "boil"
                  ? " before boil end"
                  : " planned contact / settling time"}
              </p>
              <p>{a.guide.how}</p>
              {descriptors.length > 0 && (
                <div className="additive-sensory">
                  <Tag tone="subjective">
                    SUBJECTIVE ASSOCIATIONS · LOW CONFIDENCE
                  </Tag>
                  <p>
                    {descriptors
                      .map((d) => d.descriptor.replaceAll("-", " "))
                      .join(" · ")}
                  </p>
                  <small>Not included in the flavor-score prediction.</small>
                </div>
              )}
              <details className="advanced">
                <summary>Process notes & limitations</summary>
                <p>{a.guide.limits}</p>
                <p>
                  Amounts and contact times are editable trial settings, not a
                  guaranteed flavor or clarification result. Zero means a dose
                  still needs to be chosen.
                </p>
              </details>
              <a href={a.source.url} target="_blank" rel="noreferrer">
                {a.source.title} ↗
              </a>
              {onAdd && (
                <button className="button primary" onClick={() => onAdd(a.id)}>
                  <Plus size={16} /> Add {a.name} to recipe
                </button>
              )}
            </article>
          );
        })}
      </div>
      {!rows.length && <p>No additives match those filters.</p>}
      {rows.length > limit && (
        <button className="text-button" onClick={() => setLimit(limit + 12)}>
          Show more additives
        </button>
      )}
    </div>
  );
}
