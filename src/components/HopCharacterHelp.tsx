import help from "../../data/hop-character-help.json";
import type { HopFocus } from "../engine/recommendations";
import { InfoTip } from "./ui";

export default function HopCharacterHelp({ focus }: { focus: HopFocus }) {
  const selected = help.profiles.find((profile) => profile.id === focus)!;
  return (
    <aside
      className="hop-character-help"
      id="hop-character-explanation"
      aria-live="polite"
    >
      <div className="hop-character-heading">
        <h3>{selected.label}, explained</h3>
        <InfoTip
          label={selected.label}
          content={`${selected.summary} ${selected.when} ${selected.effect}`}
        />
      </div>
      <p>{selected.summary}</p>
      <dl>
        <div>
          <dt>When to add</dt>
          <dd>{selected.when}</dd>
        </div>
        <div>
          <dt>What to expect</dt>
          <dd>{selected.effect}</dd>
        </div>
        <div>
          <dt>How suggestions use it</dt>
          <dd>{selected.app}</dd>
        </div>
      </dl>
      <p className="hop-character-source">
        Typical brewing guidance · Flavor results are estimates.{" "}
        <a href={selected.source.url} target="_blank" rel="noreferrer">
          Producer reference ↗
        </a>
      </p>
      <details>
        <summary>Compare all four hop addition profiles</summary>
        <div className="hop-character-compare">
          {help.profiles.map((profile) => (
            <section key={profile.id}>
              <h4>{profile.label}</h4>
              <p>{profile.summary}</p>
              <p>{profile.when}</p>
            </section>
          ))}
        </div>
      </details>
    </aside>
  );
}
