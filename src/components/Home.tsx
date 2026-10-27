import {
  ArrowRight,
  BookMarked,
  Droplets,
  FlaskConical,
  NotebookPen,
  Plus,
  Target as TargetIcon,
  Wheat,
} from "lucide-react";
import type { Catalog, Prediction, Recipe } from "../engine/types";
import type { SavedRecipe } from "../sharing";
import { beerColor, predict } from "../engine/calculations";
import { builderSteps, type BuilderStep } from "../engine/builder";
import BrandMark from "./BrandMark";

export default function Home({
  recipe,
  prediction,
  step,
  saved,
  catalog,
  onContinue,
  onNew,
  onOpen,
  onBook,
  onLog,
}: {
  recipe: Recipe;
  prediction?: Prediction;
  step: BuilderStep;
  saved: SavedRecipe[];
  catalog: Catalog;
  onContinue: () => void;
  onNew: () => void;
  onOpen: (r: SavedRecipe) => void;
  onBook: () => void;
  onLog: () => void;
}) {
  const style = catalog.styles.find((s) => s.id === recipe.styleId);
  const stepLabel = builderSteps.find((s) => s.id === step)?.label;
  return (
    <div className="home">
      <section className="home-hero">
        <div>
          <p className="eyebrow">Homebrew recipe planner</p>
          <h1>Design a beer, see how it will turn out, then brew it.</h1>
          <p className="lede">
            Start with how much water you have. BrewMaster sizes your malts,
            hops and yeast to match, predicts alcohol, bitterness, color and
            flavor as you go, and keeps every recipe and brew day in one place.
          </p>
          <div className="home-actions">
            <button className="button primary large" onClick={onNew}>
              <Plus size={18} /> Start a new recipe
            </button>
            <button className="button secondary large" onClick={onBook}>
              <BookMarked size={18} /> Start from a proven recipe
            </button>
          </div>
        </div>
        <div className="home-hero-art" aria-hidden="true">
          <BrandMark size={220} />
        </div>
      </section>

      {prediction && (
        <section className="panel continue-card">
          <i
            className="glass"
            style={{ background: beerColor(prediction.srm) }}
            aria-hidden="true"
          />
          <div className="continue-body">
            <p className="eyebrow">Continue where you left off</p>
            <h2>{recipe.name}</h2>
            <p className="muted">
              {style?.name ?? "No particular style"} · next up: {stepLabel}
            </p>
            <div className="mini-stats">
              <span>
                <b>{prediction.abv.toFixed(1)}%</b> ABV
              </span>
              <span>
                <b>{prediction.ibu.toFixed(0)}</b> IBU
              </span>
              <span>
                <b>{prediction.srm.toFixed(1)}</b> SRM
              </span>
            </div>
          </div>
          <button className="button primary" onClick={onContinue}>
            Continue <ArrowRight size={16} />
          </button>
        </section>
      )}

      <section className="how-it-works" aria-labelledby="how-title">
        <h2 id="how-title">How it works</h2>
        <ol>
          <li>
            <Droplets size={22} />
            <b>Water first</b>
            <span>
              Tell us how much water you're brewing with. Everything else is
              sized from it.
            </span>
          </li>
          <li>
            <TargetIcon size={22} />
            <b>Set your goals</b>
            <span>
              Pick a style and the alcohol, bitterness and flavors you want.
            </span>
          </li>
          <li>
            <Wheat size={22} />
            <b>Choose ingredients</b>
            <span>
              Add malts, hops and yeast, or let us suggest a recipe. Results
              update live.
            </span>
          </li>
          <li>
            <NotebookPen size={22} />
            <b>Brew and log it</b>
            <span>
              Save, print a brew sheet, then record how it actually turned out.
            </span>
          </li>
        </ol>
      </section>

      <section className="home-columns">
        <div className="panel">
          <div className="section-head">
            <h2>Your recipes</h2>
            <button className="text-button" onClick={onBook}>
              See all <ArrowRight size={14} />
            </button>
          </div>
          {saved.length ? (
            <ul className="recipe-list">
              {saved.slice(0, 6).map((r) => {
                let p: Prediction | undefined;
                try {
                  p = predict(r, catalog);
                } catch {}
                return (
                  <li key={r.id}>
                    <button onClick={() => onOpen(r)}>
                      <i
                        className="glass small"
                        style={{
                          background: p ? beerColor(p.srm) : "var(--line)",
                        }}
                      />
                      <span>
                        <b>{r.name}</b>
                        <small>
                          {catalog.styles.find((s) => s.id === r.styleId)
                            ?.name ?? "No particular style"}
                          {p ? ` · ${p.abv.toFixed(1)}% ABV` : ""}
                        </small>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">
              Recipes you save appear here. They stay private unless you choose
              to share them.
            </p>
          )}
        </div>
        <div className="panel home-log">
          <h2>Brewed something?</h2>
          <p className="muted">
            Log your measured gravities and tasting notes. BrewMaster compares
            them with its predictions and can learn your system over time.
          </p>
          <button className="button secondary" onClick={onLog}>
            <FlaskConical size={16} /> Open the Brew Log
          </button>
        </div>
      </section>
    </div>
  );
}
