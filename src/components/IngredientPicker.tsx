import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Info, Search, X } from "lucide-react";
import type { Catalog } from "../engine/types";
import type { Usage } from "../engine/flavor";
import {
  ingredientBrief,
  type SelectableIngredient,
} from "../engine/ingredientBrief";
import { searchByName } from "../engine/search";
import { InfoTip, Tag } from "./ui";

export function IngredientInfo({
  item,
  catalog,
  usage,
  us = false,
}: {
  item: SelectableIngredient;
  catalog: Catalog;
  usage?: Usage;
  us?: boolean;
}) {
  return (
    <InfoTip
      label={item.name}
      content={ingredientBrief(item, catalog, usage, us).text}
    />
  );
}

export default function IngredientPicker({
  label,
  items,
  selectedId,
  catalog,
  usage,
  us,
  onChange,
}: {
  label: string;
  items: SelectableIngredient[];
  selectedId: string;
  catalog: Catalog;
  usage?: Usage;
  us: boolean;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(selectedId);
  const selected = items.find((item) => item.id === selectedId)!;
  const filtered = useMemo(
    () =>
      searchByName(
        items,
        query,
        (i) => i.name,
        (i) =>
          i.kind === "hop"
            ? `${i.origin} ${i.purpose}`
            : i.kind === "malt"
              ? `${i.maltster} ${i.type}`
              : `${i.lab} ${i.code} ${i.type}`,
        (i) => (i.kind === "yeast" ? [i.code] : []),
      ),
    [items, query],
  );
  const preview =
    filtered.find((item) => item.id === highlighted) ?? filtered[0];
  const brief = preview
    ? ingredientBrief(preview, catalog, usage, us)
    : undefined;
  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  const close = () => {
    setOpen(false);
    opener.current?.focus();
  };
  const choose = (item: SelectableIngredient) => {
    onChange(item.id);
    close();
  };
  return (
    <div className="ingredient-picker">
      <div className="ingredient-picker-control">
        <button
          type="button"
          className="ingredient-picker-trigger"
          aria-label={label}
          aria-haspopup="dialog"
          ref={opener}
          onClick={() => {
            setHighlighted(selectedId);
            setQuery("");
            setOpen(true);
          }}
        >
          <span>
            {selected.kind === "yeast"
              ? `${selected.lab} ${selected.code} · `
              : ""}
            {selected.name}
          </span>
          <ChevronDown size={17} />
        </button>
        <IngredientInfo
          item={selected}
          catalog={catalog}
          usage={usage}
          us={us}
        />
      </div>
      {open && (
        <dialog
          className="ingredient-picker-dialog"
          ref={dialog}
          aria-labelledby={`${id}-title`}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <div className="ingredient-picker-heading">
            <div>
              <p className="eyebrow">CHOOSE AN INGREDIENT</p>
              <h2 id={`${id}-title`}>{label}</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close ingredient choices"
              onClick={close}
            >
              <X size={22} />
            </button>
          </div>
          <label className="picker-search">
            <Search size={19} />
            <input
              autoFocus={window.matchMedia("(pointer: fine)").matches}
              aria-label="Search ingredient choices"
              placeholder="Search by name or product code…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
            />
          </label>
          <p className="muted picker-instruction">
            Highlight a name to preview it. Select the name to use it in your
            recipe.
          </p>
          <div className="ingredient-picker-body">
            <div
              className="ingredient-picker-list"
              role="group"
              aria-label="Ingredient choices"
            >
              {filtered.map((item, index) => (
                <div
                  className={`ingredient-picker-option ${preview?.id === item.id ? "highlighted" : ""}`}
                  key={item.id}
                  onMouseEnter={() => setHighlighted(item.id)}
                >
                  <button
                    type="button"
                    className="ingredient-choice"
                    aria-pressed={selectedId === item.id}
                    onFocus={() => setHighlighted(item.id)}
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                      e.preventDefault();
                      const nextIndex = Math.max(
                        0,
                        Math.min(
                          filtered.length - 1,
                          index + (e.key === "ArrowDown" ? 1 : -1),
                        ),
                      );
                      e.currentTarget
                        .closest(".ingredient-picker-list")
                        ?.querySelectorAll<HTMLButtonElement>(
                          ".ingredient-choice",
                        )
                        [nextIndex]?.focus();
                    }}
                    onClick={() => choose(item)}
                  >
                    <strong>{item.name}</strong>
                    <small>
                      {item.kind === "yeast"
                        ? `${item.lab} · ${item.code} · ${item.form}`
                        : item.kind === "hop"
                          ? `${item.purpose} · ${item.alpha.join("–")}% alpha`
                          : `${item.type} · ${item.lovibond} °L`}
                    </small>
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Preview ${item.name}`}
                    onFocus={() => setHighlighted(item.id)}
                    onClick={() => setHighlighted(item.id)}
                  >
                    <Info size={18} />
                  </button>
                </div>
              ))}
              {!filtered.length && (
                <p className="muted">
                  No matching ingredients. Try a shorter name.
                </p>
              )}
            </div>
            <aside className="ingredient-picker-preview" aria-live="polite">
              {preview && brief ? (
                <>
                  <h3>{preview.name}</h3>
                  <Tag tone="objective">REFERENCE SPECS</Tag>
                  <dl className="details">
                    {brief.specs.map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <Tag>FLAVOR ESTIMATE</Tag>
                  <p>
                    {brief.flavors.join(", ") ||
                      "No matching sensory evidence for this context."}
                  </p>
                  <small>{brief.contextLabel}</small>
                  <p className="muted">{brief.sources.join(" · ")}</p>
                  <a href={preview.source.url} target="_blank" rel="noreferrer">
                    {preview.source.title} ↗
                  </a>
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => choose(preview)}
                  >
                    Use {preview.name}
                  </button>
                </>
              ) : (
                <p>
                  Search for an ingredient to see its specifications and flavor
                  estimates.
                </p>
              )}
            </aside>
          </div>
        </dialog>
      )}
    </div>
  );
}
