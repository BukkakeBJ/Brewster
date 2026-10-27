export default function BuilderHeader({
  stage,
  onStage,
}: {
  stage: string;
  onStage: (stage: string) => void;
}) {
  const goals = stage === "Design";
  return (
    <header className="builder-header">
      <p className="eyebrow">YOUR RECIPE WORKSPACE</p>
      <h1>Recipe Builder</h1>
      <p>
        {goals
          ? "Set the alcohol, bitterness and flavor you want. Generate recipes, then choose one to customize."
          : "Adjust your ingredients and brew plan. The numbers and flavor estimate update as you edit."}
      </p>
      <div
        className="builder-stages"
        role="group"
        aria-label="Recipe builder steps"
      >
        <button
          type="button"
          aria-label="Beer goals"
          aria-pressed={goals}
          aria-controls="builder-goals"
          onClick={() => onStage("Design")}
        >
          <span className="builder-step-number" aria-hidden="true">
            1
          </span>
          <span>
            <strong>Beer goals</strong>
            <small>Targets & recipe suggestions</small>
          </span>
        </button>
        <button
          type="button"
          aria-label="Ingredients & brew plan"
          aria-pressed={!goals}
          aria-controls="builder-recipe"
          onClick={() => onStage("Recipe Editor")}
        >
          <span className="builder-step-number" aria-hidden="true">
            2
          </span>
          <span>
            <strong>Ingredients & brew plan</strong>
            <small>Edit, name & save your recipe</small>
          </span>
        </button>
      </div>
    </header>
  );
}
