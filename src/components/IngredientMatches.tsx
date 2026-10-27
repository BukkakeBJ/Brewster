import { IngredientInfo } from "./IngredientPicker";
import { useMemo, useState } from "react";
import type { Catalog, Target } from "../engine/types";
import {
  ingredientMatches,
  type IngredientMatch,
} from "../engine/recommendations";
import designHelp from "../../data/design-help.json";
import { Section, Tag, InfoTip } from "./ui";
import { cToF } from "../engine/calculations";
import { searchByName } from "../engine/search";
export default function IngredientMatches({
  target: t,
  catalog: c,
  update,
  userWeight = 1,
  us = false,
}: {
  target: Target;
  catalog: Catalog;
  update: (p: Partial<Target>) => void;
  userWeight?: number;
  us?: boolean;
}) {
  const matches = useMemo(
    () => ingredientMatches(t, c, userWeight),
    [t, c, userWeight],
  );
  const [kind, setKind] = useState<"hops" | "malts" | "yeasts">("hops");
  const [query, setQuery] = useState(""),
    [limit, setLimit] = useState(5);
  const rows = query.trim()
    ? searchByName(
        matches[kind],
        query,
        (m) => m.name,
        (m) => m.descriptors.map((d) => d.label).join(" "),
      )
    : matches[kind];
  const all = [...c.malts, ...c.hops, ...c.yeasts];
  const selected = [
    ...(t.hopChoices ?? []),
    t.baseMaltChoice,
    t.yeastChoice,
  ].filter((id): id is string => !!id);
  const choose = (m: IngredientMatch) => {
    if (kind === "hops")
      update({
        hopChoices: t.hopChoices?.includes(m.id)
          ? t.hopChoices.filter((id) => id !== m.id)
          : [...(t.hopChoices ?? []), m.id],
      });
    if (kind === "malts")
      update({ baseMaltChoice: t.baseMaltChoice === m.id ? undefined : m.id });
    if (kind === "yeasts")
      update({ yeastChoice: t.yeastChoice === m.id ? undefined : m.id });
  };
  return (
    <Section
      title="Ingredient matches"
      eyebrow="LIVE / STYLE & TARGETS"
      action={
        <InfoTip
          label="Ingredient matches"
          content={designHelp.fields["Ingredient matches"]}
        />
      }
    >
      <p className="muted" aria-live="polite">
        {matches.hops.length} hop options · {matches.malts.length} malts ·{" "}
        {matches.yeasts.length} yeast strains match your current evidence and
        constraints.
      </p>
      <Tag tone="subjective">EDITORIAL SUITABILITY · CONSENSUS FLAVOR</Tag>
      <p className="muted">
        Changes to style, color, alcohol, flavor, or constraints update this
        shortlist. IBU affects amounts and scheduling; hop flavor need not mean
        high bitterness.
      </p>
      {matches.profile && (
        <details className="advanced">
          <summary>Suggested malt profile for this style</summary>
          <p className="muted">
            Starting grist from {matches.profile.referenceRecipe}. An editorial
            template, not an optimum or a mandatory formula. The solver may
            choose different proportions to meet your targets.
          </p>
          {matches.profile.grist.map((g) => (
            <p key={g.ingredientId}>
              {c.malts.find((m) => m.id === g.ingredientId)?.name} · {g.percent}
              %
            </p>
          ))}
        </details>
      )}
      <div
        className="match-tabs"
        role="group"
        aria-label="Ingredient recommendation type"
      >
        {(["hops", "malts", "yeasts"] as const).map((k) => (
          <button
            key={k}
            className="button secondary"
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setLimit(5);
              setQuery("");
            }}
          >
            {k === "hops" ? "Hops" : k === "malts" ? "Malts" : "Yeast"}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Search suggested {kind}</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(5);
          }}
          placeholder="Name or descriptor…"
        />
      </label>
      {selected.length > 0 && (
        <div className="filter-chips">
          {selected.map((id) => (
            <button
              key={id}
              onClick={() =>
                update({
                  hopChoices: t.hopChoices?.filter((x) => x !== id),
                  baseMaltChoice:
                    t.baseMaltChoice === id ? undefined : t.baseMaltChoice,
                  yeastChoice: t.yeastChoice === id ? undefined : t.yeastChoice,
                })
              }
            >
              {all.find((i) => i.id === id)?.name ?? id} ×
            </button>
          ))}
          <button
            onClick={() =>
              update({
                hopChoices: [],
                baseMaltChoice: undefined,
                yeastChoice: undefined,
              })
            }
          >
            Clear choices
          </button>
        </div>
      )}
      <p className="muted">
        Optional choices constrain the next recipe search: selected hops form
        the allowed hop pool; a base malt or yeast choice fixes that ingredient.
        Other inventory, form and budget constraints still apply.
      </p>
      {!rows.length && (
        <p role="status">
          No matching suggestions. Change the flavor targets, search or
          ingredient constraints.
        </p>
      )}
      <div className="live-match-cards">
        {rows.slice(0, limit).map((m) => {
          const malt = c.malts.find((x) => x.id === m.id),
            hop = c.hops.find((x) => x.id === m.id),
            yeast = c.yeasts.find((x) => x.id === m.id),
            item = malt ?? hop ?? yeast!;
          const canChoose =
            kind !== "malts" ||
            (malt?.type === "base" && malt.maxPercent >= 70);
          return (
            <article key={m.id} className="suggestion-card">
              <div className="ingredient-name-with-info">
                <h3>{m.name}</h3>
                <IngredientInfo item={item} catalog={c} us={us} />
              </div>
              <Tag tone="objective">REFERENCE SPECS</Tag>
              <p className="suggestion-spec">
                {hop
                  ? `${hop.alpha.join("–")}% alpha acids · ${hop.purpose}`
                  : malt
                    ? `${malt.type} · ${malt.lovibond} °L · ${malt.ppg.toFixed(1)} PPG · max ${malt.maxPercent}% grist`
                    : `${yeast!.lab} ${yeast!.code} · ${yeast!.form} · attenuation ${yeast!.attenuation?.join("–") ?? "unknown"}% · ${yeast!.tempC?.map((n) => (us ? cToF(n) : n).toFixed(0)).join("–") ?? "unknown"}°${us ? "F" : "C"} · tolerance ${yeast!.alcoholTolerance === null ? "unknown" : yeast!.alcoholTolerance + "% ABV"}`}
              </p>
              <Tag tone="subjective">WHY IT MAY FIT</Tag>
              {m.reasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
              {m.descriptors.length > 0 && (
                <p className="muted">
                  Consensus:{" "}
                  {m.descriptors
                    .slice(0, 5)
                    .map((d) => `${d.label} ${d.intensity.toFixed(1)}/5`)
                    .join(" · ")}
                </p>
              )}
              {m.descriptors.length > 0 && (
                <details className="advanced">
                  <summary>Sensory evidence & sources</summary>
                  {m.descriptors.slice(0, 5).flatMap((d) =>
                    d.descriptorIds.map((id) => {
                      const evidence = c.descriptors.find(
                        (row) => row.id === id,
                      );
                      return evidence ? (
                        <div key={id}>
                          <p>
                            {d.label} · {evidence.sourceType} ·{" "}
                            {evidence.confidence} confidence ·{" "}
                            {evidence.usageContext}
                          </p>
                          <a
                            href={evidence.source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {evidence.source.title} ↗
                          </a>
                        </div>
                      ) : null;
                    }),
                  )}
                </details>
              )}
              {canChoose && (
                <button
                  className="button secondary"
                  aria-pressed={selected.includes(m.id)}
                  onClick={() => choose(m)}
                >
                  {selected.includes(m.id)
                    ? "Remove choice"
                    : kind === "hops"
                      ? "Choose hop"
                      : kind === "malts"
                        ? "Choose base malt"
                        : "Choose yeast"}
                </button>
              )}
              <a href={item.source.url} target="_blank" rel="noreferrer">
                Ingredient reference ↗
              </a>
            </article>
          );
        })}
      </div>
      {rows.length > limit && (
        <button className="text-button" onClick={() => setLimit(limit + 5)}>
          Show more matches
        </button>
      )}
      <p className="muted">
        Ingredient descriptor intensity is not the finished-beer score. Unknown
        tolerance needs lab verification. These rankings are recommendations,
        not measured fit percentages.
      </p>
    </Section>
  );
}
