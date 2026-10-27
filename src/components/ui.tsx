import InfoTip from "./InfoTip";
import { brewingHelp } from "../brewingHelp";
export { InfoTip };
import { useState, useEffect, useRef, useId, type ReactNode } from "react";
export function Field({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  suffix,
  help: explicitHelp,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  help?: string;
}) {
  const id = useId();
  const help = explicitHelp ?? brewingHelp(label);
  const Container = help ? "div" : "label";
  const fmt = (v: number) => String(Number(v.toFixed(3)));
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
          aria-label={label}
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
        {suffix && <small>{suffix}</small>}
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
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
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
