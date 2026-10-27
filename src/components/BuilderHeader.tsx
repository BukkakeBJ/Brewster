import { Check } from "lucide-react";
import { builderSteps, type BuilderStep } from "../engine/builder";
export default function BuilderHeader({
  stage,
  onStage,
  recipeName,
}: {
  stage: BuilderStep;
  onStage: (stage: BuilderStep) => void;
  recipeName: string;
}) {
  const index = builderSteps.findIndex((step) => step.id === stage);
  const current = builderSteps[index];
  return (
    <header className="builder-header">
      <nav className="stepper" aria-label="Recipe builder steps">
        {builderSteps.map((step, i) => (
          <button
            key={step.id}
            type="button"
            className={i < index ? "done" : ""}
            aria-current={step.id === stage ? "step" : undefined}
            aria-label={`Step ${i + 1}: ${step.label}`}
            onClick={() => onStage(step.id)}
          >
            <span className="stepper-dot">
              {i < index ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className="stepper-label">{step.label}</span>
          </button>
        ))}
      </nav>
      <p className="eyebrow">
        Step {index + 1} of {builderSteps.length} · {recipeName}
      </p>
      <h1>{current.title}</h1>
      <p className="lede">{current.description}</p>
    </header>
  );
}
