import type { Catalog, Ingredient } from "../engine/types";
import { flavorOptions, withoutFlavorNotes } from "../engine/ingredientSearch";

const NOUNS: Record<Ingredient["kind"], string> = {
  hop: "hops",
  malt: "malts",
  yeast: "yeasts",
};

/** Tap flavors to narrow an ingredient list. Choosing several finds items with all of them. */
export default function FlavorChips({
  catalog: c,
  kind,
  items,
  selected,
  onChange,
}: {
  catalog: Catalog;
  kind: Ingredient["kind"];
  items: readonly Pick<Ingredient, "id">[];
  selected: string[];
  onChange: (flavors: string[]) => void;
}) {
  const missing = withoutFlavorNotes(items, c);
  return (
    <div className="flavor-filter">
      <div
        className="flavor-chips"
        role="group"
        aria-label={`Filter ${NOUNS[kind]} by flavor`}
      >
        {flavorOptions(kind, c).map((flavor) => {
          const on = selected.includes(flavor.id);
          return (
            <button
              type="button"
              key={flavor.id}
              className="chip"
              aria-pressed={on}
              onClick={() =>
                onChange(
                  on
                    ? selected.filter((id) => id !== flavor.id)
                    : [...selected, flavor.id],
                )
              }
            >
              {flavor.label}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="muted">
          {missing > 0 &&
            `${missing} ${NOUNS[kind]} have no flavor notes, so they're left out. `}
          <button
            type="button"
            className="text-button"
            onClick={() => onChange([])}
          >
            Clear flavors
          </button>
        </p>
      )}
    </div>
  );
}
