import { useMemo, useState } from "react";
import type { Catalog, Recipe, Target } from "../engine/types";
import { addSuggestedHop, suggestedHopGroups } from "../engine/builder";
import { IngredientInfo } from "./IngredientPicker";
import { Section, Tag } from "./ui";
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
    aroma: {
      title: "Aroma",
      hint: "Whirlpool · 20-minute stand · starting dose 1 g/L",
    },
    bittering: {
      title: "Bittering",
      hint: "Early boil · fills the remaining IBU target",
    },
    flavor: {
      title: "Flavor",
      hint: "Late boil · 10 minutes · starting dose 0.75 g/L",
    },
  };
  return (
    <Section
      title="Hops for your flavor profile"
      eyebrow="THREE SUGGESTIONS PER ROLE"
    >
      <p className="muted">
        Ranked by your flavor targets, style and ingredient constraints. Choose
        any combination, then edit amounts and timing below. Suggestions are
        optional.
      </p>
      <Tag>SUITABILITY & FLAVOR · SUBJECTIVE</Tag>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="hop-role-groups">
        {groups.map(({ role, matches }) => (
          <section key={role} className="hop-role-group">
            <h3>{copy[role].title}</h3>
            <p className="muted">{copy[role].hint}</p>
            {matches.map((match) => {
              const hop = catalog.hops.find((h) => h.id === match.id)!;
              return (
                <article className="hop-suggestion" key={hop.id}>
                  <div className="ingredient-name-with-info">
                    <h4>{hop.name}</h4>
                    <IngredientInfo
                      item={hop}
                      catalog={catalog}
                      usage={{ use: role === "aroma" ? "whirlpool" : "boil" }}
                      us={us}
                    />
                  </div>
                  <p>
                    {match.descriptors
                      .slice(0, 3)
                      .map((d) => d.label)
                      .join(" · ") || "Limited flavor evidence"}
                  </p>
                  <small>
                    Alpha {hop.alpha.join("–")}% · Beta{" "}
                    {hop.beta?.join("–") ?? "unknown"}
                    {hop.beta ? "%" : ""}
                  </small>
                  <details>
                    <summary>Why this hop?</summary>
                    {match.reasons.map((reason) => (
                      <p key={reason}>{reason}</p>
                    ))}
                  </details>
                  <button
                    type="button"
                    className="button secondary"
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
                    Add for {copy[role].title.toLowerCase()}
                  </button>
                </article>
              );
            })}
            {!matches.length && (
              <p>
                No matches within your ingredient limits. Adjust your
                constraints or choose a hop manually.
              </p>
            )}
          </section>
        ))}
      </div>
    </Section>
  );
}
