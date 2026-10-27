import type { Catalog, Recipe, Target } from "../engine/types";
import type { BuilderStep } from "../engine/builder";
import {
  cToF,
  G_PER_OZ,
  kgToLb,
  lToGal,
  predict,
} from "../engine/calculations";
import { waterSettings } from "../engine/waterPlan";
import { ReadOnlyAdditives } from "./RecipeAdditives";
import { IngredientInfo } from "./IngredientPicker";
import { Section } from "./ui";
export default function RecipeSummary({
  recipe: r,
  catalog: c,
  us,
  target,
  onEdit,
}: {
  recipe: Recipe;
  catalog: Catalog;
  us: boolean;
  target: Target;
  onEdit: (step: BuilderStep) => void;
}) {
  const plan = waterSettings(r, c),
    p = predict(r, c);
  const yeast = c.yeasts.find((y) => y.id === r.yeastId)!;
  const total = r.grains.reduce((sum, grain) => sum + grain.kg, 0);
  const volume = (liters: number) =>
    `${(us ? lToGal(liters) : liters).toFixed(2)} ${us ? "gal" : "L"}`;
  const temperature = (value: number) =>
    `${(us ? cToF(value) : value).toFixed(1)} ${us ? "°F" : "°C"}`;
  const bottles = Math.floor(
    (Math.max(0, p.fermenterL - plan.packagingLossL) * 1000) / plan.bottleMl,
  );
  return (
    <Section title="Full recipe">
      <div className="recipe-summary-part">
        <div className="summary-part-title">
          <h3>Water & yield</h3>
          <button
            type="button"
            className="text-button"
            onClick={() => onEdit("water")}
          >
            Edit water
          </button>
        </div>
        <p>
          <strong>{volume(plan.startingWaterL)} starting water</strong> →{" "}
          {volume(r.batchL)} post-boil wort → about {bottles} bottles of{" "}
          {plan.bottleMl === 354.882 ? "12 US fl oz" : `${plan.bottleMl} mL`}{" "}
          after losses.
        </p>
        <p className="muted">
          {r.boilMinutes}-minute boil · {r.efficiency}% efficiency ·{" "}
          {volume(r.lossL)} kettle transfer loss · {volume(plan.packagingLossL)}{" "}
          packaging loss
        </p>
      </div>
      <div className="recipe-summary-part">
        <div className="summary-part-title">
          <h3>Goals</h3>
          <button
            type="button"
            className="text-button"
            onClick={() => onEdit("goals")}
          >
            Edit goals
          </button>
        </div>
        <p>
          {target.abv}% ABV · {target.ibu} IBU ·{" "}
          {target.srm === undefined ? "Any color" : `${target.srm} SRM`} ·{" "}
          {c.styles.find((s) => s.id === r.styleId)?.name ?? "Freeform"}
        </p>
      </div>
      <div className="recipe-summary-part">
        <div className="summary-part-title">
          <h3>Malts</h3>
          <button
            type="button"
            className="text-button"
            onClick={() => onEdit("malts")}
          >
            Edit malts
          </button>
        </div>
        {r.grains.map((grain, i) => {
          const malt = c.malts.find((m) => m.id === grain.ingredientId)!;
          return (
            <div className="summary-ingredient" key={i}>
              <div className="ingredient-name-with-info">
                <strong>{malt.name}</strong>
                <IngredientInfo
                  item={malt}
                  catalog={c}
                  usage={{ percent: total ? (grain.kg / total) * 100 : 0 }}
                  us={us}
                />
              </div>
              <span>
                {(us ? kgToLb(grain.kg) : grain.kg).toFixed(2)}{" "}
                {us ? "lb" : "kg"} ·{" "}
                {(total ? (grain.kg / total) * 100 : 0).toFixed(1)}%
              </span>
            </div>
          );
        })}
        <p>
          Mash at {temperature(r.mashC)} for {r.mashMinutes} minutes.
        </p>
      </div>
      <div className="recipe-summary-part">
        <div className="summary-part-title">
          <h3>Hops</h3>
          <button
            type="button"
            className="text-button"
            onClick={() => onEdit("hops")}
          >
            Edit hops
          </button>
        </div>
        {r.hops.map((addition, i) => {
          const hop = c.hops.find((h) => h.id === addition.ingredientId)!;
          return (
            <div className="summary-ingredient" key={i}>
              <div className="ingredient-name-with-info">
                <strong>{hop.name}</strong>
                <IngredientInfo
                  item={hop}
                  catalog={c}
                  usage={{ use: addition.use }}
                  us={us}
                />
              </div>
              <span>
                {(us ? addition.grams / G_PER_OZ : addition.grams).toFixed(2)}{" "}
                {us ? "oz" : "g"} ·{" "}
                {addition.use === "boil"
                  ? `Boil · ${addition.minutes} min before end`
                  : addition.use === "whirlpool"
                    ? `Whirlpool · ${addition.minutes} min contact`
                    : `Dry hop · ${addition.minutes / 1440} days`}
              </span>
            </div>
          );
        })}
        {!r.hops.length && <p>No hop additions.</p>}
      </div>
      <div className="recipe-summary-part">
        <div className="summary-part-title">
          <h3>Yeast & fermentation</h3>
          <button
            type="button"
            className="text-button"
            onClick={() => onEdit("yeast")}
          >
            Edit yeast
          </button>
        </div>
        <div className="ingredient-name-with-info">
          <strong>
            {yeast.lab} {yeast.code} · {yeast.name}
          </strong>
          <IngredientInfo
            item={yeast}
            catalog={c}
            usage={{ tempC: r.fermentC }}
            us={us}
          />
        </div>
        <p>
          Ferment at {temperature(r.fermentC)} · pitch ≈{" "}
          {p.pitchBillion.toFixed(0)} billion viable cells (
          {yeast.form === "dry"
            ? `≈ ${(p.pitchBillion / plan.dryCellsBillionPerG).toFixed(1)} g at your cell-count assumption`
            : `≈ ${Math.ceil(p.pitchBillion / plan.liquidCellsBillionPerPack)} packs at your cell-count assumption`}
          ).
        </p>
      </div>
      <div className="recipe-summary-part">
        <div className="summary-part-title">
          <h3>Extras</h3>
          <a className="text-button" href="#extras">
            Edit extras
          </a>
        </div>
        <ReadOnlyAdditives recipe={r} us={us} />
        {!r.additives?.length && (
          <p className="muted">
            None. Fruit, spices, oak and more are optional.
          </p>
        )}
      </div>
    </Section>
  );
}
