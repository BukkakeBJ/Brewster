import { useState, useEffect, useRef, type ReactNode } from "react";
export function Field({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const fmt = (v: number) => String(Number(v.toFixed(3)));
  const [draft, setDraft] = useState(() => fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(fmt(value));
  }, [value]);
  const bounded = (n: number) =>
    Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
  return (
    <label className="field">
      <span>{label}</span>
      <div className="number-wrap">
        <input
          type="number"
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
    </label>
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
          <h2>{title}</h2>
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
