import AdditiveLibrary from "./AdditiveLibrary";
import { additives, type AdditiveAddition } from "../engine/additives";
import { useMemo, useState } from "react";
import { Search, ArrowUpRight, BookOpen } from "lucide-react";
import type { Catalog, Ingredient, Malt, Hop, Yeast } from "../engine/types";
import { alcohol, midpoint, cToF } from "../engine/calculations";
import { consensus, hopSimilarity } from "../engine/flavor";
import {
  describeIngredient,
  hopRoles,
  maltRole,
  yeastFamily,
  yeastAlcoholRange,
} from "../engine/library";
import { yeastGroups, yeastFamilies, yeastGuide } from "../engine/yeast";
import { startingPoints } from "../engine/suggestions";
import { defaultRecipe } from "../defaults";
import { alphabetical, searchByName } from "../engine/search";
import { Field, HelpTerm, Tag } from "./ui";
export default function Library({
  catalog: c,
  us,
  batchL = 20,
  onAddAdditive,
  onAddCustomAdditive,
  onChooseYeast,
  selectedYeastId,
}: {
  catalog: Catalog;
  us: boolean;
  batchL?: number;
  onAddAdditive?: (id: string) => void;
  onAddCustomAdditive?: (addition: AdditiveAddition) => void;
  onChooseYeast?: (id: string) => void;
  selectedYeastId?: string;
}) {
  const [kind, setKind] = useState("hop"),
    [q, setQ] = useState(""),
    [role, setRole] = useState("All"),
    [descriptor, setDescriptor] = useState(""),
    [minTolerance, setMinTolerance] = useState(0),
    [minAbv, setMinAbv] = useState(0),
    [maxAbv, setMaxAbv] = useState(20),
    [og, setOg] = useState(1.06),
    [form, setForm] = useState("any"),
    [expanded, setExpanded] = useState(""),
    [limit, setLimit] = useState(24),
    [popularOnly, setPopularOnly] = useState(false);
  const all = kind === "hop" ? c.hops : kind === "malt" ? c.malts : c.yeasts;
  const roles =
    kind === "hop"
      ? ["Aroma", "Bittering", "Dry hopping", "Flavor"]
      : kind === "malt"
        ? Array.from(new Set(c.malts.map(maltRole)))
        : Array.from(
            new Set(
              c.yeasts.flatMap((y) => yeastGroups(y).map((f) => f.label)),
            ),
          );
  const byDescriptor = useMemo(
    () =>
      new Set(
        c.descriptors
          .filter((d) => d.descriptor === descriptor)
          .map((d) => d.ingredientId),
      ),
    [c, descriptor],
  );
  const popularIds = new Set(
    kind === "yeast"
      ? []
      : startingPoints(
          kind === "hop" ? "hop" : "malt",
          c,
          defaultRecipe,
          "popular",
        ).map((s) => s.item.ingredientId),
  );
  const eligible = all.filter((i) => {
    if (popularOnly && kind !== "yeast" && !popularIds.has(i.id)) return false;
    if (descriptor && !byDescriptor.has(i.id)) return false;
    if (
      role !== "All" &&
      (kind === "hop"
        ? !hopRoles(i as Hop).includes(role)
        : kind === "malt"
          ? maltRole(i as Malt) !== role
          : !yeastGroups(i as Yeast).some((f) => f.label === role))
    )
      return false;
    if (kind === "yeast") {
      const y = i as Yeast;
      const abv = yeastAlcoholRange(y, og);
      if (minAbv > maxAbv) return false;
      if (form !== "any" && y.form !== form) return false;
      if (
        minTolerance > 0 &&
        (y.alcoholTolerance === null || y.alcoholTolerance < minTolerance)
      )
        return false;
      if (
        abv ? abv[1] < minAbv || abv[0] > maxAbv : minAbv !== 0 || maxAbv !== 20
      )
        return false;
    }
    return true;
  });
  const filtered = searchByName<Ingredient>(
    eligible,
    q,
    (i) => i.name,
    (i) =>
      JSON.stringify({ ...i, source: undefined }) +
      (i.kind === "yeast"
        ? " " +
          yeastGroups(i as Yeast)
            .map((f) => f.label)
            .join(" ") +
          " " +
          JSON.stringify(yeastGuide(i as Yeast) ?? {})
        : ""),
    (i) =>
      i.kind === "yeast"
        ? [(i as Yeast).code, `${(i as Yeast).lab} ${(i as Yeast).code}`]
        : [],
  );
  return (
    <>
      <div className="library-types">
        {[
          ["hop", "Hops", c.hops.length],
          ["malt", "Malts & fermentables", c.malts.length],
          ["yeast", "Yeasts", c.yeasts.length],
          ["additive", "Additives", additives.length],
        ].map(([k, label, count]) => (
          <button
            key={k}
            className={kind === k ? "active" : ""}
            onClick={() => {
              setKind(String(k));
              setQ("");
              setDescriptor("");
              setRole("All");
              setLimit(24);
              setExpanded("");
            }}
          >
            {label} <span>{count}</span>
          </button>
        ))}
      </div>
      {kind === "additive" ? (
        <AdditiveLibrary
          us={us}
          batchL={batchL}
          onAdd={onAddAdditive}
          onAddCustom={onAddCustomAdditive}
        />
      ) : (
        <>
          {kind !== "yeast" && (
            <div className="popular-library">
              <button
                className="button secondary"
                aria-pressed={popularOnly}
                onClick={() => {
                  setPopularOnly(!popularOnly);
                  setLimit(24);
                }}
              >
                {popularOnly
                  ? "✓ Popular starting points"
                  : "Show popular starting points"}
              </button>
              <span>
                Curated beginner options · editorial selection, not a sales
                ranking
              </span>
            </div>
          )}
          <div className="library-search">
            <Search size={17} />
            <input
              placeholder="Search names, origin, manufacturer, product code…"
              aria-label="Search ingredient library"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(24);
              }}
            />
            <select
              aria-label="Filter by flavor descriptor"
              value={descriptor}
              onChange={(e) => {
                setDescriptor(e.target.value);
                setLimit(24);
              }}
            >
              <option value="">Any flavor descriptor</option>
              {alphabetical(c.vocabulary, (v) => v.label).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          {kind === "yeast" ? (
            <label className="field library-yeast-type">
              <span>Yeast type</span>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setLimit(24);
                }}
              >
                <option value="All">All yeast types</option>
                {alphabetical(roles, (x) => x).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="filter-chips">
              {["All", ...alphabetical(roles, (x) => x)].map((x) => (
                <button
                  key={x}
                  className={role === x ? "active" : ""}
                  onClick={() => {
                    setRole(x);
                    setLimit(24);
                  }}
                >
                  {x}
                </button>
              ))}
            </div>
          )}
          {kind === "hop" && (
            <p className="library-note">
              Aroma, flavor and dry-hop roles overlap. They are suitability
              estimates; objective acid and oil specs are shown separately.
            </p>
          )}
          {kind === "yeast" && (
            <details className="yeast-type-guide advanced">
              <summary>Yeast types, alcohol & flavor guide</summary>
              <p className="muted">
                Browse a family, then compare its strains. Alcohol tolerance is
                a limit; actual ABV also needs fermentable wort. The
                descriptions below are editorial guides.
              </p>
              <div className="yeast-family-grid">
                {alphabetical(yeastFamilies, (f) => f.label).map((f) => (
                  <article key={f.id}>
                    <button
                      className="text-button"
                      aria-pressed={role === f.label}
                      onClick={() => {
                        setRole(f.label);
                        setQ("");
                        setLimit(24);
                      }}
                    >
                      {f.label}{" "}
                      <span>
                        {
                          c.yeasts.filter((y) =>
                            yeastGroups(y).some((g) => g.id === f.id),
                          ).length
                        }{" "}
                        options
                      </span>
                    </button>
                    <p>{f.description}</p>
                  </article>
                ))}
              </div>
            </details>
          )}
          {kind === "yeast" && (
            <div className="yeast-filters">
              <Field
                label="Minimum alcohol tolerance"
                value={minTolerance}
                suffix="%"
                min={0}
                max={30}
                onChange={setMinTolerance}
              />
              <Field
                label="Wort original gravity for ABV estimate"
                value={og}
                min={1.001}
                max={1.2}
                step={0.001}
                onChange={setOg}
              />
              <Field
                label="Estimated ABV minimum"
                value={minAbv}
                min={0}
                max={20}
                onChange={setMinAbv}
              />
              <Field
                label="Estimated ABV maximum"
                value={maxAbv}
                min={0}
                max={25}
                onChange={setMaxAbv}
              />
              <label className="field">
                <span>Culture form</span>
                <select value={form} onChange={(e) => setForm(e.target.value)}>
                  <option value="any">Dry or liquid</option>
                  <option value="dry">Dry</option>
                  <option value="liquid">Liquid</option>
                </select>
              </label>
              <p className="muted">
                Tolerance is a strain limit. Estimated ABV uses the entered OG
                and the reference attenuation range. Unknown tolerances are
                excluded when a minimum is set. An ABV filter excludes strains
                whose beer-wort attenuation is unknown. Wine and baking products
                can be selected manually in the editor; the beer solver uses
                supported brewing strains.
              </p>
            </div>
          )}
          <div className="library-count">
            {filtered.length} ingredients{" "}
            <span>Reference specs / editorial sensory estimates</span>
          </div>
          <div className="library-grid">
            {filtered.slice(0, limit).map((i) => {
              const d = describeIngredient(i, c),
                rows = c.descriptors.filter((d) => d.ingredientId === i.id),
                isOpen = expanded === i.id;
              const h = i as Hop,
                m = i as Malt,
                y = i as Yeast;
              const usage =
                kind === "hop"
                  ? { use: "dry hop" }
                  : kind === "malt"
                    ? { percent: 5 }
                    : {
                        tempC: y.tempC ? midpoint(y.tempC) : undefined,
                        medium: yeastGroups(y).some((f) => f.id === "wine")
                          ? ("wine" as const)
                          : ("beer" as const),
                      };
              const agreed = consensus(rows, usage);
              const alcoholRange =
                kind === "yeast" ? yeastAlcoholRange(y, og) : null;
              return (
                <article
                  className={`library-card ${isOpen ? "expanded" : ""}`}
                  key={i.id}
                >
                  <div className="library-card-head">
                    <span className="ingredient-symbol">
                      <BookOpen size={20} />
                    </span>
                    <div>
                      <h3>{i.name}</h3>
                      <small>
                        {kind === "hop"
                          ? h.origin
                          : kind === "malt"
                            ? (m.maltster ?? "Generic reference")
                            : `${y.lab} · ${y.code}`}
                      </small>
                    </div>
                  </div>
                  <div className="library-split">
                    <div className="spec-side">
                      <Tag tone="objective">OBJECTIVE SPECS</Tag>
                      <dl>
                        {(kind === "hop"
                          ? [
                              ["Purpose", h.purpose],
                              ["Alpha acids", h.alpha.join("–") + "%"],
                              [
                                "Beta acids",
                                h.beta ? h.beta.join("–") + "%" : "Unknown",
                              ],
                              [
                                "Total oils",
                                h.totalOil === null
                                  ? "Unknown"
                                  : h.totalOil + " mL/100g",
                              ],
                            ]
                          : kind === "malt"
                            ? [
                                ["Type", m.type],
                                [
                                  "Color",
                                  m.lovibond + " °L / " + m.ebc + " EBC",
                                ],
                                ["Potential", m.ppg.toFixed(1) + " PPG"],
                                [
                                  "Max grist",
                                  m.maxPercentIsEstimate
                                    ? "Unknown · model cap 100%"
                                    : m.maxPercent + "%",
                                ],
                              ]
                            : [
                                ["Type / form", y.type + " / " + y.form],
                                [
                                  "Attenuation",
                                  y.attenuation
                                    ? y.attenuation.join("–") + "%"
                                    : "Unknown in malt wort",
                                ],
                                [
                                  "Temperature",
                                  y.tempC
                                    ? y.tempC
                                        .map((t) =>
                                          (us ? cToF(t) : t).toFixed(1),
                                        )
                                        .join("–") + (us ? "°F" : "°C")
                                    : "Unknown for brewing",
                                ],
                                [
                                  "Alcohol tolerance",
                                  y.alcoholTolerance === null
                                    ? "Unknown"
                                    : y.alcoholTolerance + "%",
                                ],
                                [
                                  "ABV at entered OG",
                                  alcoholRange
                                    ? alcoholRange
                                        .map((v) => v.toFixed(1))
                                        .join("–") + "% estimate"
                                    : "Unknown · no wort attenuation data",
                                ],
                              ]
                        ).map(([k, v]) => (
                          <div key={k}>
                            <dt>
                              <HelpTerm
                                label={k}
                                helpKey={k === "Color" ? "Malt color" : k}
                              />
                            </dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <div className="sensory-side">
                      <Tag>SUBJECTIVE ESTIMATE</Tag>
                      {kind === "yeast" && (
                        <div className="yeast-flavor-summary">
                          <h4>Flavor profile</h4>
                          <p>
                            {yeastGuide(y)?.flavor ??
                              (agreed.length
                                ? `Contextual associations: ${agreed
                                    .slice(0, 5)
                                    .map((d) =>
                                      d.descriptor.replaceAll("-", " "),
                                    )
                                    .join(
                                      ", ",
                                    )}. These estimates depend on the wort, temperature and process; source records appear in the full guide.`
                                : "No reliable flavor evidence for this context. Add your own tasting notes after an experimental brew.")}
                          </p>
                        </div>
                      )}
                      <small>
                        {kind === "hop"
                          ? "Dry-hop context"
                          : kind === "malt"
                            ? "At 5% grist (context preview)"
                            : (yeastGuide(y)?.context ??
                              "Beer context · at midpoint temperature")}
                      </small>
                      {agreed.slice(0, 5).map((a) => (
                        <div className="descriptor-meter" key={a.descriptor}>
                          <span>{a.descriptor.replace("-", " ")}</span>
                          <div>
                            <i
                              style={{ width: (a.intensity / 5) * 100 + "%" }}
                            />
                          </div>
                          <b>{a.intensity.toFixed(1)}</b>
                        </div>
                      ))}
                      {!agreed.length && (
                        <p className="muted">
                          No descriptors available for this context.
                        </p>
                      )}
                      <small>
                        <HelpTerm
                          label="Confidence-weighted consensus · 0–5"
                          helpKey="Consensus"
                        />
                      </small>
                    </div>
                  </div>
                  <p className="ingredient-intro">{d.intro}</p>
                  <button
                    className="library-expand"
                    onClick={() => setExpanded(isOpen ? "" : i.id)}
                  >
                    {isOpen
                      ? "Close ingredient guide"
                      : "Read full ingredient guide"}{" "}
                    <ArrowUpRight size={13} />
                  </button>
                  {isOpen && (
                    <div className="ingredient-guide">
                      <h4>How to use it</h4>
                      <p>{d.use}</p>
                      <h4>Process & behavior</h4>
                      <p>{d.process}</p>
                      <h4>Limits & things to check</h4>
                      <p>{d.limits}</p>
                      <h4>Complete reference specs</h4>
                      <dl className="complete-specs">
                        {Object.entries(i)
                          .filter(
                            ([k]) =>
                              ![
                                "id",
                                "kind",
                                "name",
                                "source",
                                "fermentabilityNotes",
                                "bodyContribution",
                              ].includes(k),
                          )
                          .map(([k, v]) => (
                            <div key={k}>
                              <dt>
                                <HelpTerm
                                  label={k.replace(/([A-Z])/g, " $1")}
                                  helpKey={k}
                                />
                              </dt>
                              <dd>
                                {v === null
                                  ? "Unknown"
                                  : typeof v === "object"
                                    ? JSON.stringify(v)
                                    : String(v)}
                              </dd>
                            </div>
                          ))}
                      </dl>
                      <a href={i.source.url} target="_blank" rel="noreferrer">
                        Numeric source: {i.source.title} ↗
                      </a>
                      <p className="muted">{i.source.note}</p>
                      <h4>All sensory evidence · {rows.length} records</h4>
                      {rows.length ? (
                        rows.map((row) => (
                          <details className="source-record" key={row.id}>
                            <summary>
                              {row.descriptor} · {row.intensity}/5{" "}
                              <Tag>{row.sourceType}</Tag> {row.confidence}{" "}
                              confidence
                            </summary>
                            <p>
                              Context: {row.usageContext}. {row.note}
                            </p>
                            <a
                              href={row.source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {row.source.title} ↗
                            </a>
                          </details>
                        ))
                      ) : (
                        <p>
                          No sensory evidence available. Missing evidence is not
                          absence.
                        </p>
                      )}
                      {kind === "hop" && (
                        <>
                          <h4>Closest substitution leads</h4>
                          {hopSimilarity(i.id, c).map((s) => (
                            <p key={s.hop.id}>
                              {s.hop.name} · {s.score}% similarity ·{" "}
                              {s.oilCoverage} shared oil fields
                            </p>
                          ))}
                          <p className="muted">
                            Similarity weights: 65% descriptors, 25% shared oil
                            profile, 10% alpha acids. Missing oil data lowers
                            confidence; scores are not sensory equivalence
                            guarantees.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  {kind === "yeast" && onChooseYeast && (
                    <button
                      className="button secondary library-choose-yeast"
                      disabled={selectedYeastId === i.id}
                      onClick={() => onChooseYeast(i.id)}
                    >
                      {selectedYeastId === i.id
                        ? "Using this yeast in your recipe"
                        : "Use this yeast in recipe"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="empty-state">
              No matching ingredients. Adjust the filters or search terms.
            </div>
          )}
          {filtered.length > limit && (
            <button
              className="button secondary load-more"
              onClick={() => setLimit(limit + 24)}
            >
              Show 24 more ingredients
            </button>
          )}
        </>
      )}
    </>
  );
}
