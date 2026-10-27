import { useMemo, useState } from "react";
import type { Catalog, Recipe, Target } from "../engine/types";
import { addSuggestedHop, suggestedHopGroups } from "../engine/builder";
import { IngredientInfo } from "./IngredientPicker";
import { Section } from "./ui";
export default function HopSuggestions({
  recipe,
  catalog,
  target,
  userWeight,
  us,
  onChange,
}: {
  recipe: Recipe;
  catalog: Catalog;
  target: Target;
  userWeight: number;
  us: boolean;
  onChange: (recipe: Recipe) => void;
}) {
  const [error, setError] = useState("");
  const groups = useMemo(
    () => suggestedHopGroups(target, catalog, userWeight),
    [target, catalog, userWeight],
  );
  const copy = {
    bittering: {
      title: "For bitterness",
      hint: "Added at the start of the boil, sized to reach your IBU goal.",
      button: "Add",
    },
    flavor: {
      title: "For flavor",
      hint: "Added 10 minutes before the boil ends.",
      button: "Add",
    },
    aroma: {
      title: "For aroma",
      hint: "Added in the whirlpool after the boil.",
      button: "Add",
    },
  };
  const order = ["bittering", "flavor", "aroma"] as const;
  return (
    <Section title="Suggested hops for your goals">
      <p className="muted">
        Picked to match the flavors you chose. Add any you like, then adjust the
        amounts above.
      </p>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="hop-role-groups">
        {order.map((role) => {
          const matches = groups.find((g) => g.role === role)?.matches ?? [];
          return (
            <section key={role} className="hop-role-group">
              <h3>{copy[role].title}</h3>
              <p className="muted">{copy[role].hint}</p>
              {matches.map((match) => {
                const hop = catalog.hops.find((h) => h.id === match.id)!;
                return (
                  <div className="hop-suggestion" key={hop.id}>
                    <div>
                      <div className="ingredient-name-with-info">
                        <strong>{hop.name}</strong>
                        <IngredientInfo
                          item={hop}
                          catalog={catalog}
                          usage={{
                            use: role === "aroma" ? "whirlpool" : "boil",
                          }}
                          us={us}
                        />
                      </div>
                      <small>
                        {match.descriptors
                          .slice(0, 3)
                          .map((d) => d.label)
                          .join(" · ") || "Limited flavor evidence"}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="button secondary small"
                      aria-label={`Add ${hop.name} ${copy[role].title.toLowerCase()}`}
                      onClick={() => {
                        try {
                          onChange(
                            addSuggestedHop(
                              recipe,
                              catalog,
                              hop.id,
                              role,
                              target.ibu,
                            ),
                          );
                          setError("");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      + {copy[role].button}
                    </button>
                  </div>
                );
              })}
              {!matches.length && (
                <p className="muted">
                  No matches within your ingredient limits.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </Section>
  );
}
