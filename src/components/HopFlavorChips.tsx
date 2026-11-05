import type { Catalog, Hop } from "../engine/types";
import { hopFlavorOptions, hopsWithoutFlavorNotes } from "../engine/hopFlavor";

/** Tap flavors to narrow a hop list. Choosing several finds hops with all of them. */
export default function HopFlavorChips({
  catalog: c,
  hops,
  selected,
  onChange,
}: {
  catalog: Catalog;
  hops: readonly Hop[];
  selected: string[];
  onChange: (flavors: string[]) => void;
}) {
  const missing = hopsWithoutFlavorNotes(hops, c);
  return (
    <div className="hop-flavor-filter">
      <div
        className="hop-flavor-chips"
        role="group"
        aria-label="Filter hops by flavor"
      >
        {hopFlavorOptions(c).map((flavor) => {
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
            `${missing} hops have no flavor notes, so they're left out. `}
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
