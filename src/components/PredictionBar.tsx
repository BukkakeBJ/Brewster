import type { Prediction, Style, Target } from "../engine/types";
import { beerColor, lToGal } from "../engine/calculations";
import { targetStatus, TOLERANCE, type TargetStatus } from "../engine/guidance";
import { HelpTerm } from "./ui";

const statusText: Record<TargetStatus, string> = {
  low: "Below goal",
  ok: "On target",
  high: "Above goal",
};

/** Live calculated numbers for the working recipe, each compared with the brewer's goal. */
export default function PredictionBar({
  p,
  target,
  style,
  bottles,
  us,
}: {
  p: Prediction;
  target: Target;
  style?: Style;
  bottles?: number;
  us: boolean;
}) {
  const stats: {
    key: string;
    label: string;
    help: string;
    value: string;
    unit: string;
    goal?: string;
    status?: TargetStatus;
    swatch?: string;
    secondary?: boolean;
  }[] = [
    {
      key: "abv",
      label: "Alcohol",
      help: "ABV",
      value: p.abv.toFixed(1),
      unit: "%",
      goal: `${target.abv}%`,
      status: targetStatus(p.abv, target.abv, TOLERANCE.abv),
    },
    {
      key: "ibu",
      label: "Bitterness",
      help: "BITTERNESS",
      value: p.ibu.toFixed(0),
      unit: "IBU",
      goal: `${target.ibu}`,
      status: targetStatus(p.ibu, target.ibu, TOLERANCE.ibu),
    },
    {
      key: "srm",
      label: "Color",
      help: "COLOR",
      value: p.srm.toFixed(1),
      unit: "SRM",
      goal: target.srm === undefined ? undefined : `${target.srm}`,
      status: targetStatus(p.srm, target.srm, TOLERANCE.srm),
      swatch: beerColor(p.srm),
    },
    {
      key: "og",
      label: "Starting gravity",
      help: "ORIGINAL GRAVITY",
      value: p.og.toFixed(3),
      unit: "OG",
      goal: style ? style.og.map((n) => n.toFixed(3)).join("–") : undefined,
      secondary: true,
    },
    {
      key: "fg",
      label: "Final gravity",
      help: "FINAL GRAVITY",
      value: p.fg.toFixed(3),
      unit: "FG",
      goal: style ? style.fg.map((n) => n.toFixed(3)).join("–") : undefined,
      secondary: true,
    },
    {
      key: "yield",
      label: "Into fermenter",
      help: "Fermenter volume",
      value: (us ? lToGal(p.fermenterL) : p.fermenterL).toFixed(1),
      unit: us ? "gal" : "L",
      goal: bottles === undefined ? undefined : `≈ ${bottles} bottles`,
      secondary: true,
    },
  ];
  return (
    <section className="prediction-bar" aria-label="Predicted results">
      {stats.map((s) => (
        <div
          key={s.key}
          className={`stat ${s.status ?? ""} ${s.secondary ? "secondary" : ""}`}
        >
          <span className="stat-label">
            <HelpTerm label={s.label} helpKey={s.help} />
          </span>
          <span className="stat-value">
            {s.swatch && (
              <i className="swatch" style={{ background: s.swatch }} />
            )}
            <strong>{s.value}</strong>
            <small>{s.unit}</small>
          </span>
          <span className="stat-goal">
            {s.status && (
              <span className={`status-dot ${s.status}`}>
                {statusText[s.status]}
              </span>
            )}
            {s.goal && (
              <span>
                {s.key === "yield"
                  ? s.goal
                  : s.secondary
                    ? `Style ${s.goal}`
                    : `Goal ${s.goal}`}
              </span>
            )}
            {!s.goal && !s.status && <span>No goal set</span>}
          </span>
        </div>
      ))}
    </section>
  );
}
