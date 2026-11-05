import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Info, Plus, Search, X } from "lucide-react";
import type { Catalog } from "../engine/types";
import type { Usage } from "../engine/flavor";
import {
  ingredientBrief,
  type SelectableIngredient,
} from "../engine/ingredientBrief";
import {
  flavorsOf,
  hasFlavor,
  searchIngredients,
  styleMatchNote,
} from "../engine/ingredientSearch";
import FlavorChips from "./FlavorChips";
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
  addLabel,
  suggested,
  suggestedTitle = "Suggested",
}: {
  label: string;
  items: SelectableIngredient[];
  selectedId: string;
  catalog: Catalog;
  usage?: Usage;
  us: boolean;
  onChange: (id: string) => void;
  /** Render the trigger as an "add" button instead of the current choice. */
  addLabel?: string;
  /** Offered ahead of the full list, worked out when the picker opens. */
  suggested?: () => { id: string; note: string }[];
  suggestedTitle?: string;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(selectedId);
  const selected = items.find((item) => item.id === selectedId);
  const kind = items[0]?.kind ?? "malt";
  const [flavors, setFlavors] = useState<string[]>([]);
  const filtered = useMemo<SelectableIngredient[]>(
    () =>
      searchIngredients(
        items,
        query,
        catalog,
        (i) => (i.kind === "hop" ? `${i.origin} ${i.purpose}` : ""),
        (i) => (i.kind === "yeast" ? [i.code] : []),
      ).filter((i) =>
        flavors.every((flavor) => hasFlavor(i.id, flavor, catalog)),
      ),
    [items, query, flavors, catalog],
  );
  const offers = useMemo(
    () =>
      open && !query.trim() && !flavors.length ? (suggested?.() ?? []) : [],
    [open, query, flavors],
  );
  const notes = new Map(offers.map((offer) => [offer.id, offer.note]));
  const offered = offers.flatMap((offer) =>
    items.filter((item) => item.id === offer.id),
  );
  const choices = [
    ...offered,
    ...filtered.filter((item) => !notes.has(item.id)),
  ];
  const preview = choices.find((item) => item.id === highlighted) ?? choices[0];
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
          className={
            addLabel
              ? "button secondary add-ingredient"
              : "ingredient-picker-trigger"
          }
          aria-label={label}
          aria-haspopup="dialog"
          ref={opener}
          onClick={() => {
            setHighlighted(selectedId);
            setQuery("");
            setFlavors([]);
            setOpen(true);
          }}
        >
          {addLabel ? (
            <>
              <Plus size={16} /> {addLabel}
            </>
          ) : (
            <>
              <span>
                {selected?.kind === "yeast"
                  ? `${selected.lab} ${selected.code} · `
                  : ""}
                {selected?.name ?? "Choose…"}
              </span>
              <ChevronDown size={17} />
            </>
          )}
        </button>
        {!addLabel && selected && (
          <IngredientInfo
            item={selected}
            catalog={catalog}
            usage={usage}
            us={us}
          />
        )}
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
              placeholder={
                kind === "hop"
                  ? "Search by name, origin or flavor…"
                  : kind === "malt"
                    ? "Search by name, flavor, color or beer style…"
                    : "Search by name, code, flavor or beer style…"
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
            />
          </label>
          <FlavorChips
            catalog={catalog}
            kind={kind}
            items={items}
            selected={flavors}
            onChange={setFlavors}
          />
          <p className="muted picker-instruction">
            Tap a name to choose it, or the ⓘ button to read about it first.
          </p>
          <div className="ingredient-picker-body">
            <div
              className="ingredient-picker-list"
              role="group"
              aria-label="Ingredient choices"
            >
              {choices.map((item, index) => (
                <Fragment key={item.id}>
                  {offered.length > 0 && index === 0 && (
                    <h3 className="picker-group">{suggestedTitle}</h3>
                  )}
                  {offered.length > 0 && index === offered.length && (
                    <h3 className="picker-group">Everything else</h3>
                  )}
                  <div
                    className={`ingredient-picker-option ${preview?.id === item.id ? "highlighted" : ""}`}
                    onMouseEnter={() => setHighlighted(item.id)}
                  >
                    <button
                      type="button"
                      className="ingredient-choice"
                      aria-pressed={selectedId === item.id}
                      onFocus={() => setHighlighted(item.id)}
                      onKeyDown={(e) => {
                        if (e.key !== "ArrowDown" && e.key !== "ArrowUp")
                          return;
                        e.preventDefault();
                        const nextIndex = Math.max(
                          0,
                          Math.min(
                            choices.length - 1,
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
                      {notes.has(item.id) && (
                        <small className="picker-note">
                          {notes.get(item.id)}
                        </small>
                      )}
                      <small>
                        {item.kind === "yeast"
                          ? `${item.lab} · ${item.code} · ${item.form}`
                          : item.kind === "hop"
                            ? `${item.purpose} · ${item.alpha.join("–")}% alpha`
                            : `${item.type} · ${+item.lovibond.toFixed(1)} °L`}
                      </small>
                      {styleMatchNote(item, query, catalog) && (
                        <small className="picker-note">
                          {styleMatchNote(item, query, catalog)}
                        </small>
                      )}
                      {flavorsOf(item.id, catalog).length > 0 && (
                        <small className="picker-flavors">
                          {flavorsOf(item.id, catalog).join(" · ")}
                        </small>
                      )}
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
                </Fragment>
              ))}
              {!choices.length && (
                <p className="muted">
                  No matches. Try fewer flavors or a shorter search.
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
