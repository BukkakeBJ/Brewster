import InfoTip from "./InfoTip";
import { brewingHelp } from "../brewingHelp";
export { InfoTip };
import { useState, useEffect, useRef, useId, type ReactNode } from "react";
import { beerColor } from "../engine/calculations";
export function Field({
  label,
  inputLabel,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  suffix,
  help: explicitHelp,
  decimals = 3,
}: {
  label: string;
  inputLabel?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  help?: string;
  /** Digits shown when the field is not being edited. */
  decimals?: number;
}) {
  const id = useId();
  const help = explicitHelp ?? brewingHelp(label);
  const Container = help ? "div" : "label";
  const fmt = (v: number) => String(Number(v.toFixed(decimals)));
  const [draft, setDraft] = useState(() => fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(fmt(value));
  }, [value]);
  const bounded = (n: number) =>
    Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
  return (
    <Container className="field">
      {help ? (
        <HelpLabel label={label} help={help} htmlFor={id} />
      ) : (
        <span>{label}</span>
      )}
      <div className="number-wrap">
        <input
          type="number"
          id={id}
          aria-label={inputLabel ?? label}
          aria-describedby={suffix ? `${id}-unit` : undefined}
          value={draft}
          min={min}
          max={max}
          step={step}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            const n = draft.trim() === "" ? value : Number(draft);
            const v = Number.isFinite(n) ? bounded(n) : value;
            setDraft(fmt(v));
            if (v !== value) onChange(v);
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = e.target.valueAsNumber;
            if (
              e.target.value !== "" &&
              Number.isFinite(n) &&
              n >= (min ?? -Infinity) &&
              n <= (max ?? Infinity)
            )
              onChange(n);
          }}
        />
        {suffix && <small id={`${id}-unit`}>{suffix}</small>}
      </div>
    </Container>
  );
}
export function HelpLabel({
  label,
  help,
  htmlFor,
}: {
  label: string;
  help: string;
  htmlFor: string;
}) {
  return (
    <div className="field-label">
      <label htmlFor={htmlFor}>{label}</label>
      <InfoTip label={label} content={help} />
    </div>
  );
}
export function HelpTerm({
  label,
  helpKey = label,
}: {
  label: string;
  helpKey?: string;
}) {
  const help = brewingHelp(helpKey);
  return (
    <span className="help-term">
      {label}
      {help && <InfoTip label={label} content={help} />}
    </span>
  );
}
export function Section({
  title,
  eyebrow,
  children,
  action,
  hidden = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
  hidden?: boolean;
}) {
  return (
    <section className="panel" hidden={hidden}>
      <div className="section-head">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <div className="section-title">
            <h2>{title}</h2>
            {brewingHelp(title) && (
              <InfoTip label={title} content={brewingHelp(title)!} />
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Tag({
  children,
  tone = "subjective",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

/** A slider with a typed value beside it; an optional band shades the style's usual range. */
export function RangeField({
  label,
  help,
  unit,
  value,
  min,
  max,
  step,
  band,
  colorTrack = false,
  action,
  onChange,
}: {
  label: string;
  help?: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  band?: [number, number];
  colorTrack?: boolean;
  action?: ReactNode;
  onChange: (n: number) => void;
}) {
  const id = useId();
  const pct = (n: number) =>
    `${(100 * (Math.min(max, Math.max(min, n)) - min)) / (max - min)}%`;
  const track = colorTrack
    ? `linear-gradient(90deg, ${[1, 4, 8, 14, 20, 28, 40].map((n) => `${beerColor(n)} ${pct(n)}`).join(", ")})`
    : undefined;
  return (
    <div className="range-field">
      <div className="range-field-head">
        {help ? (
          <HelpLabel label={label} help={help} htmlFor={id} />
        ) : (
          <label htmlFor={id}>{label}</label>
        )}
        {action}
        <Field
          label={label}
          inputLabel={`${label} target`}
          value={value}
          min={min}
          max={max}
          step={step}
          suffix={unit}
          help=""
          onChange={onChange}
        />
      </div>
      <div className="range-track">
        {band && (
          <span
            className="range-band"
            style={{ left: pct(band[0]), width: `calc(${pct(band[1])} - ${pct(band[0])})` }}
            title={`Style range ${band.join("–")}`}
          />
        )}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          aria-label={`${label} slider`}
          style={{ background: track, ["--fill" as string]: pct(value) }}
          className={colorTrack ? "color-range" : ""}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      {band && (
        <small className="range-caption">
          Style range {band.join("–")} {unit}
        </small>
      )}
    </div>
  );
}
