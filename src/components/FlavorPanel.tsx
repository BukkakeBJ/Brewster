import { useState } from "react";
import type { Catalog, Flavor } from "../engine/types";
import { Section } from "./ui";
export function Radar({
  scores,
  target,
  axes = [
    "bready",
    "caramel",
    "roast",
    "citrus",
    "tropical",
    "floral",
    "body",
    "bitterness",
  ],
  size = 300,
}: {
  scores: Record<string, number>;
  target?: Record<string, number>;
  axes?: string[];
  size?: number;
}) {
  const point = (i: number, v: number) => {
    const a = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
    return [
      150 + (Math.cos(a) * v * 108) / 5,
      150 + (Math.sin(a) * v * 108) / 5,
    ];
  };
  const poly = (s: Record<string, number>) =>
    axes.map((a, i) => point(i, s[a] ?? 0).join(",")).join(" ");
  return (
    <svg
      className="radar"
      role="img"
      aria-label="Flavor estimate radar on a zero to five scale"
      viewBox="-30 -4 360 308"
      width={size}
      height={size}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <polygon
          key={n}
          points={axes.map((_, i) => point(i, n).join(",")).join(" ")}
          fill="none"
          stroke="var(--line)"
          strokeWidth=".6"
        />
      ))}
      {axes.map((a, i) => {
        const [x, y] = point(i, 5.85);
        const [lx, ly] = point(i, 5);
        return (
          <g key={a}>
            <line
              x1="150"
              y1="150"
              x2={lx}
              y2={ly}
              stroke="var(--line)"
              strokeWidth=".7"
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--ink-3)"
              fontSize="11"
              fontWeight="600"
            >
              {a.replace("-", " ").toUpperCase()}
            </text>
          </g>
        );
      })}
      {target && (
        <polygon
          points={poly(target)}
          fill="none"
          stroke="var(--accent)"
          strokeDasharray="4 3"
          strokeWidth="1.2"
        />
      )}
      <polygon
        points={poly(scores)}
        fill="var(--brand-fill)"
        stroke="var(--brand)"
        strokeWidth="1.8"
      />
      {axes.map((a, i) => {
        const [x, y] = point(i, scores[a] ?? 0);
        return <circle key={a} cx={x} cy={y} r="2.8" fill="var(--brand)" />;
      })}
    </svg>
  );
}
export default function FlavorPanel({
  flavor: f,
  catalog: c,
  target,
  readOnly = false,
}: {
  flavor: Flavor;
  catalog: Catalog;
  target?: Record<string, number>;
  readOnly?: boolean;
}) {
  const [axis, setAxis] = useState("citrus");
  const rows = f.contributions[axis] ?? [];
  const label = (id: string) =>
    c.vocabulary.find((v) => v.id === id)?.label ?? id;
  const gaps = target
    ? Object.entries(target)
        .filter(
          ([id]) =>
            !["carbonation", "bitterness"].includes(id) &&
            c.vocabulary.some((v) => v.id === id && v.axis),
        )
        .map(([id, goal]) => ({ id, goal, diff: (f.scores[id] ?? 0) - goal }))
        .filter((g) => Math.abs(g.diff) >= 0.75)
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
        .slice(0, 3)
    : [];
  return (
    <Section title="Flavor estimate">
      <Radar scores={f.scores} target={target} />
      <div className="radar-legend">
        <span className="legend-predicted">Your recipe</span>
        {target && <span className="legend-target">Your goal</span>}
      </div>
      {target &&
        (gaps.length ? (
          <ul className="flavor-gaps">
            {gaps.map((g) => (
              <li key={g.id}>
                <b>{label(g.id)}</b>{" "}
                {g.diff < 0 ? "is weaker than" : "is stronger than"} your goal
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Close to your flavor goals.</p>
        ))}
      {readOnly ? (
        <p className="muted">
          An estimate from the ingredients and process, not a measurement.
        </p>
      ) : (
        <details className="advanced">
          <summary>What's behind each flavor?</summary>
          <p className="muted">
            An estimate from brewer reports about each ingredient, not a
            measurement.
          </p>
          <select
            aria-label="Explain flavor axis"
            value={axis}
            onChange={(e) => setAxis(e.target.value)}
          >
            {c.vocabulary.map((v) => (
              <option value={v.id} key={v.id}>
                {v.label} · {(f.scores[v.id] ?? 0).toFixed(1)}/5
              </option>
            ))}
          </select>
          <div className="flavor-explanation">
            {rows.length === 0 ? (
              <p className="muted">
                Nothing in this recipe is known to add this flavor.
              </p>
            ) : (
              rows.map((r, i) => (
                <div key={i}>
                  <b>
                    {r.ingredient} <span>+{r.score.toFixed(2)}</span>
                  </b>
                  <p>{r.reason}</p>
                  {r.descriptorIds.map((id) => {
                    const d = c.descriptors.find((d) => d.id === id);
                    return (
                      d && (
                        <details key={id}>
                          <summary>
                            {d.sourceType} · {d.confidence} confidence ·{" "}
                            {d.intensity}/5
                          </summary>
                          <p>
                            {d.usageContext} · {d.note}
                          </p>
                          <a
                            href={d.source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {d.source.title} ↗
                          </a>
                        </details>
                      )
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </details>
      )}
    </Section>
  );
}
