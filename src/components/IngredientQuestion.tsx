import { useEffect, useId, useRef } from "react";
import type { Catalog, Recipe } from "../engine/types";
import { predict } from "../engine/calculations";
import {
  restyleWords,
  stylesForPick,
  type UnusualPick,
} from "../engine/ingredientFit";
import { alphabetical } from "../engine/search";
import BeerGlass from "./BeerGlass";

/** Asks whether an unusual pick keeps the beer in its style or moves it to another one. */
export default function IngredientQuestion({
  recipe,
  pick,
  catalog: c,
  onKeep,
  onChangeStyle,
  onUndo,
}: {
  recipe: Recipe;
  pick: UnusualPick;
  catalog: Catalog;
  onKeep: () => void;
  onChangeStyle: (styleId: string) => void;
  onUndo: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  const style = c.styles.find((s) => s.id === recipe.styleId)!;
  const options = stylesForPick(recipe, pick, c);
  const srm = predict(recipe, c).srm;
  return (
    <dialog
      className="share-dialog malt-question"
      ref={dialog}
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        e.preventDefault();
        onKeep();
      }}
    >
      <div className="malt-question-head">
        <BeerGlass srm={srm} styleId={recipe.styleId} size="sm" />
        <div>
          <p className="eyebrow">CHECK YOUR STYLE</p>
          <h2 id={`${id}-title`}>
            {pick.name} is unusual in {style.name}
          </h2>
        </div>
      </div>
      <h3>Why it may be unusual</h3>
      <ul className="malt-question-reasons">
        {pick.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <button className="button primary wide" onClick={onKeep}>
        Keep {style.name}
      </button>
      <p className="muted">
        {pick.name} stays in your recipe, and the style stays the same.
      </p>
      <h3>Or change the style</h3>
      <div className="malt-question-styles">
        {options.map((option) => (
          <button
            key={option.id}
            className="button secondary"
            onClick={() => onChangeStyle(option.id)}
          >
            {option.name}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Another style</span>
        <select
          aria-label="Change to another style"
          value=""
          onChange={(e) => e.target.value && onChangeStyle(e.target.value)}
        >
          <option value="">Choose a style…</option>
          {alphabetical(
            c.styles.filter((s) => s.id !== recipe.styleId),
            (s) => s.name,
          ).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">{restyleWords[pick.kind]}</p>
      <button className="text-button" onClick={onUndo}>
        Undo my change
      </button>
    </dialog>
  );
}
