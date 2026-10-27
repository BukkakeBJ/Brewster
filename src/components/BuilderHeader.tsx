import { builderSteps, type BuilderStep } from "../engine/builder";
export default function BuilderHeader({
  stage,
  onStage,
}: {
  stage: BuilderStep;
  onStage: (stage: BuilderStep) => void;
}) {
  const index = builderSteps.findIndex((step) => step.id === stage);
  const current = builderSteps[index];
  return (
    <header className="builder-header guided-builder-header">
      <p className="eyebrow">
        YOUR RECIPE · STEP {index + 1} OF {builderSteps.length}
      </p>
      <h1>{current.label}</h1>
      <p>{current.description}</p>
      <nav className="guided-steps" aria-label="Recipe builder steps">
        {builderSteps.map((step, i) => (
          <button
            key={step.id}
            type="button"
            aria-current={step.id === stage ? "step" : undefined}
            aria-label={`Step ${i + 1}: ${step.label}`}
            onClick={() => onStage(step.id)}
          >
            <span>{i + 1}</span>
            <strong>{step.label}</strong>
          </button>
        ))}
      </nav>
      <label className="guided-step-select field">
        <span>Jump to a step</span>
        <select
          aria-label="Recipe builder step"
          value={stage}
          onChange={(e) => onStage(e.target.value as BuilderStep)}
        >
          {builderSteps.map((step, i) => (
            <option key={step.id} value={step.id}>
              {i + 1}. {step.label}
            </option>
          ))}
        </select>
      </label>
    </header>
  );
}
