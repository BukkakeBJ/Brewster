import type { Recipe } from "../engine/types";
import { processStages, processNoteEntries } from "../engine/processNotes";
export function SavedProcessNotes({ recipe }: { recipe: Recipe }) {
  const notes = processNoteEntries(recipe.processNotes);
  if (!notes.length) return null;
  return (
    <div className="saved-process-notes">
      <h3>Brewing process notes</h3>
      {notes.map((stage) => (
        <div key={stage.id}>
          <h4>{stage.label}</h4>
          <p>{stage.note}</p>
        </div>
      ))}
    </div>
  );
}
export default function RecipeNotes({
  recipe,
  onChange,
}: {
  recipe: Recipe;
  onChange: (r: Recipe) => void;
}) {
  const notes = processNoteEntries(recipe.processNotes);
  return (
    <>
      <details className="recipe-note-editor">
        <summary>
          Recipe notes & experiments
          {notes.length ? ` · ${notes.length} stages with notes` : ""}
        </summary>
        <p className="muted">
          Name your beer above. Save recipe keeps your name, general notes and
          every process note in My recipes. Drafts back up edits as you type.
          Notes record your observations; predictions use the numeric settings.
        </p>
        <label className="field">
          <span>Recipe description</span>
          <textarea
            rows={2}
            maxLength={1000}
            value={recipe.description ?? ""}
            placeholder="Describe your beer for the Recipe Book…"
            onChange={(e) =>
              onChange({ ...recipe, description: e.target.value })
            }
          />
        </label>
        <label className="field">
          <span>General recipe notes</span>
          <textarea
            rows={4}
            maxLength={20000}
            value={recipe.notes ?? ""}
            placeholder="Your idea, goals, substitutions, or overall experiment…"
            onChange={(e) => onChange({ ...recipe, notes: e.target.value })}
          />
        </label>
        <h3>Notes for each brewing stage</h3>
        <div className="process-note-grid">
          {processStages.map((stage) => (
            <details key={stage.id} className="process-note-stage">
              <summary>
                {stage.label}
                {recipe.processNotes?.[stage.id]?.trim()
                  ? " · Notes added"
                  : " · Add notes"}
              </summary>
              <label className="field">
                <span>{stage.label} notes</span>
                <textarea
                  rows={4}
                  maxLength={10000}
                  value={recipe.processNotes?.[stage.id] ?? ""}
                  placeholder={stage.hint}
                  onChange={(e) =>
                    onChange({
                      ...recipe,
                      processNotes: {
                        ...recipe.processNotes,
                        [stage.id]: e.target.value,
                      },
                    })
                  }
                />
              </label>
            </details>
          ))}
        </div>
        {recipe.origin && (
          <p className="muted">
            Source: {recipe.origin.author} · {recipe.origin.title}.{" "}
            {recipe.origin.adaptations}{" "}
            {recipe.origin.url && (
              <a href={recipe.origin.url} target="_blank" rel="noreferrer">
                Published source ↗
              </a>
            )}
          </p>
        )}
      </details>
      <div className="print-recipe-notes">
        {recipe.description && <p>{recipe.description}</p>}
        {recipe.notes && (
          <>
            <h3>General recipe notes</h3>
            <p>{recipe.notes}</p>
          </>
        )}
        <SavedProcessNotes recipe={recipe} />
      </div>
    </>
  );
}
