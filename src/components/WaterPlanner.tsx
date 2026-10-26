import { Droplets, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { Catalog, Recipe } from "../engine/types";
import {
  G_PER_OZ,
  kgToLb,
  KG_PER_LB,
  lToGal,
  L_PER_GAL,
} from "../engine/calculations";
import { planFromWater } from "../engine/waterPlan";
import { Field, Section, Tag } from "./ui";
export default function WaterPlanner({
  recipe,
  catalog,
  us,
  onChange,
}: {
  recipe: Recipe;
  catalog: Catalog;
  us: boolean;
  onChange: (r: Recipe) => void;
}) {
  const [waterL, setWaterL] = useState(5 * L_PER_GAL),
    [absorption, setAbsorption] = useState(0.8),
    [packLossL, setPackLossL] = useState(0.5),
    [bottleMl, setBottleMl] = useState(330),
    [dryCells, setDryCells] = useState(10),
    [liquidCells, setLiquidCells] = useState(100),
    [packGrams, setPackGrams] = useState(11.5);
  const yeast = catalog.yeasts.find((y) => y.id === recipe.yeastId)!;
  const dry = yeast.form === "dry";
  let plan: ReturnType<typeof planFromWater> | undefined,
    error = "";
  try {
    plan = planFromWater(
      recipe,
      catalog,
      waterL,
      absorption,
      packLossL,
      bottleMl,
      dry ? dryCells : liquidCells,
    );
  } catch (e) {
    error = (e as Error).message;
  }
  const vol = (l: number) =>
    `${(us ? lToGal(l) : l).toFixed(2)} ${us ? "gal" : "L"}`;
  return (
    <details className="water-planner">
      <summary>
        <Droplets size={24} />
        <span>
          <b>Start with your water.</b>
          <small>
            {(us ? lToGal(waterL) : waterL).toFixed(us ? 1 : 2)}{" "}
            {us ? "gal" : "L"} starting water · preview ingredients & bottles
          </small>
        </span>
        <ChevronDown className="water-chevron" size={18} />
      </summary>
      <Section
        title="Plan ingredients from water"
        eyebrow="WATER → RECIPE → BOTTLES"
      >
        <p className="muted">
          Enter all starting brewing water (mash + sparge). This scales your
          current recipe, keeping its ingredient varieties, grist ratios and hop
          timings. Start with a recipe from Design or the Recipe Book.
        </p>
        <div className="field-grid">
          <Field
            label="Starting brewing water"
            suffix={us ? "gal" : "L"}
            value={us ? lToGal(waterL) : waterL}
            min={0.1}
            onChange={(n) => setWaterL(us ? n * L_PER_GAL : n)}
            help="Total water before grain absorption and boiling, including mash and sparge water. This is not finished beer volume. No extra top-up, dead-space or cooling shrinkage is modeled; account for these in your equipment losses."
          />
          <Field
            label="Grain water absorption"
            suffix={us ? "gal/lb" : "L/kg"}
            value={us ? (absorption * KG_PER_LB) / L_PER_GAL : absorption}
            min={0}
            max={us ? 0.36 : 3}
            step={us ? 0.01 : 0.05}
            onChange={(n) =>
              setAbsorption(us ? (n * L_PER_GAL) / KG_PER_LB : n)
            }
            help="Planning assumption per kilogram of mash grain. Default 0.8 L/kg is an adjustable heuristic; squeezing a bag or draining differently changes retention. Extract and non-mash fermentables do not absorb water in this model."
          />
          <Field
            label="Packaging loss"
            suffix={us ? "gal" : "L"}
            value={us ? lToGal(packLossL) : packLossL}
            min={0}
            onChange={(n) => setPackLossL(us ? n * L_PER_GAL : n)}
            help="Additional beer lost after the kettle transfer, for example sediment and bottling losses. Subtracted from fermenter yield for bottle estimates only."
          />
          <label className="field">
            <span>Bottle size</span>
            <select
              aria-label="Bottle size"
              value={bottleMl}
              onChange={(e) => setBottleMl(Number(e.target.value))}
            >
              <option value={330}>330 mL</option>
              <option value={354.882}>12 US fl oz</option>
              <option value={500}>500 mL</option>
              <option value={650}>650 mL</option>
              <option value={750}>750 mL</option>
            </select>
          </label>
          <Field
            label={
              dry
                ? "Assumed viable cells per gram"
                : "Viable cells per liquid pack"
            }
            suffix="billion"
            value={dry ? dryCells : liquidCells}
            min={0.1}
            onChange={dry ? setDryCells : setLiquidCells}
            help="Editable planning assumption, not a specification for the selected strain. Use the supplier's viable cell count, accounting for age and storage. Pitch rate follows the recipe's ale/lager rate and pitch multiplier."
          />
          {dry && (
            <Field
              label="Dry yeast packet size"
              suffix="g"
              value={packGrams}
              min={0.1}
              onChange={setPackGrams}
            />
          )}
        </div>
        <Tag tone="objective">
          CALCULATED · WITH ADJUSTABLE LOSS & CELL ASSUMPTIONS
        </Tag>
        {error && <p role="alert">{error}</p>}
        {plan && (
          <>
            <p role="status">
              Post-boil wort {vol(plan.recipe.batchL)} · packaged beer ≈{" "}
              {vol(plan.packagedL)} · about {plan.bottles} full bottles
            </p>
            <p className="muted">
              Water retained by grain ≈ {vol(plan.absorbedL)} · evaporation{" "}
              {vol(plan.evaporationL)} · kettle transfer loss{" "}
              {vol(plan.recipe.lossL)}. Review boil-off and transfer settings
              below. Packaging loss is separate.
            </p>
            <ul>
              {plan.recipe.grains.map((g, i) => (
                <li key={`g${i}`}>
                  {catalog.malts.find((m) => m.id === g.ingredientId)?.name}:{" "}
                  {(us ? kgToLb(g.kg) : g.kg).toFixed(2)} {us ? "lb" : "kg"}
                </li>
              ))}
              {plan.recipe.hops.map((h, i) => (
                <li key={`h${i}`}>
                  {catalog.hops.find((m) => m.id === h.ingredientId)?.name}:{" "}
                  {(us ? h.grams / G_PER_OZ : h.grams).toFixed(2)}{" "}
                  {us ? "oz" : "g"} · {h.use} · {h.minutes} min
                </li>
              ))}
            </ul>
            <p>
              {yeast.name}: ≈ {plan.pitchBillion.toFixed(0)} billion viable
              cells;{" "}
              {dry
                ? `≈ ${plan.yeastUnits.toFixed(1)} g (${Math.ceil(plan.yeastUnits / packGrams)} packets of ${packGrams} g, rounded up)`
                : `≈ ${Math.ceil(plan.yeastUnits)} liquid packs, rounded up`}
              . Verify with the supplier; a starter may be needed.
            </p>
            <button className="button" onClick={() => onChange(plan!.recipe)}>
              Apply water-scaled ingredient amounts
            </button>
            <p className="muted">
              Applying updates this recipe's draft amounts and batch size; yeast
              dosage and bottles remain live estimates in this planner. Save the
              recipe to keep its scaled amounts. Bottle count is an approximate
              yield, not a carbonation or priming-sugar calculation.
            </p>
          </>
        )}
      </Section>
    </details>
  );
}
