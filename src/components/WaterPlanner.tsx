import { Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Catalog, Recipe } from "../engine/types";
import {
  KG_PER_LB,
  lToGal,
  L_PER_GAL,
  scaleRecipe,
} from "../engine/calculations";
import { planFromWater, waterSettings } from "../engine/waterPlan";
import { Field } from "./ui";
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
  const settings = waterSettings(recipe, catalog);
  const [waterL, setWaterL] = useState(settings.startingWaterL),
    [absorption, setAbsorption] = useState(settings.absorptionLPerKg),
    [packLossL, setPackLossL] = useState(settings.packagingLossL),
    [bottleMl, setBottleMl] = useState(settings.bottleMl),
    [dryCells, setDryCells] = useState(settings.dryCellsBillionPerG),
    [liquidCells, setLiquidCells] = useState(
      settings.liquidCellsBillionPerPack,
    ),
    [packGrams, setPackGrams] = useState(settings.dryPackGrams),
    [equipmentError, setEquipmentError] = useState("");
  useEffect(() => {
    setWaterL(settings.startingWaterL);
    setAbsorption(settings.absorptionLPerKg);
    setPackLossL(settings.packagingLossL);
    setBottleMl(settings.bottleMl);
    setDryCells(settings.dryCellsBillionPerG);
    setLiquidCells(settings.liquidCellsBillionPerPack);
    setPackGrams(settings.dryPackGrams);
  }, [recipe.id, recipe.waterPlan]);
  const recordSettings = (patch: Partial<typeof settings>) =>
    onChange({ ...recipe, waterPlan: { ...settings, ...patch } });
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
  const applyWater = (nextWaterL: number, nextAbsorption = absorption) => {
    setWaterL(nextWaterL);
    setAbsorption(nextAbsorption);
    let next: Recipe;
    try {
      next = planFromWater(
        recipe,
        catalog,
        nextWaterL,
        nextAbsorption,
        packLossL,
        bottleMl,
        dry ? dryCells : liquidCells,
      ).recipe;
    } catch {
      // The render shows the invalid water budget; keep the last valid recipe.
      return;
    }
    onChange({
      ...next,
      waterPlan: {
        ...next.waterPlan!,
        dryCellsBillionPerG: dryCells,
        liquidCellsBillionPerPack: liquidCells,
        dryPackGrams: packGrams,
      },
    });
  };
  const applyEquipment = (next: Recipe) => {
    try {
      onChange(
        planFromWater(next, catalog, waterL, absorption, packLossL, bottleMl)
          .recipe,
      );
      setEquipmentError("");
    } catch (e) {
      setEquipmentError((e as Error).message);
    }
  };
  const vol = (l: number) =>
    `${(us ? lToGal(l) : l).toFixed(us ? 1 : 1)} ${us ? "gal" : "L"}`;
  const presets = us ? [2.5, 5, 6.5, 10] : [10, 20, 25, 40];
  const shownWater = us ? lToGal(waterL) : waterL;
  const bottleLabel =
    bottleMl === 354.882 ? "12 oz" : bottleMl === 330 ? "330 mL" : `${bottleMl} mL`;
  return (
    <section className="panel water-step">
      <div className="water-input">
        <Field
          label="Starting water"
          suffix={us ? "gal" : "L"}
          value={shownWater}
          min={0.1}
          decimals={2}
          onChange={(n) => applyWater(us ? n * L_PER_GAL : n)}
          help="All the water you'll use on brew day (mash plus sparge), before grain soaks some up and the boil evaporates some. Finished beer will be less."
        />
        <div className="chip-row" role="group" aria-label="Common batch sizes">
          {presets.map((n) => (
            <button
              type="button"
              key={n}
              className="chip"
              aria-pressed={Math.abs(shownWater - n) < 0.01}
              onClick={() => applyWater(us ? n * L_PER_GAL : n)}
            >
              {n} {us ? "gal" : "L"}
            </button>
          ))}
        </div>
      </div>
      {plan && (
        <ol className="water-flow" aria-label="Where your water goes">
          <li>
            <strong>{vol(waterL)}</strong>
            <span>Starting water</span>
          </li>
          <li>
            <strong>{vol(plan.recipe.batchL)}</strong>
            <span>In the kettle after the boil</span>
          </li>
          <li>
            <strong>{vol(plan.packagedL)}</strong>
            <span>Finished beer</span>
          </li>
          <li className="water-flow-bottles">
            <strong>≈ {plan.bottles}</strong>
            <span>{bottleLabel} bottles</span>
          </li>
        </ol>
      )}
      {plan && (
        <p className="muted">
          Grain soaks up about {vol(plan.absorbedL)}, the boil evaporates about{" "}
          {vol(plan.evaporationL)}, and about {vol(plan.recipe.lossL)} stays
          behind in the kettle. Change these under Equipment & losses.
        </p>
      )}
      {(error || equipmentError) && (
        <p className="notice" role="alert">
          {error || equipmentError}
        </p>
      )}
      <details className="advanced">
        <summary>
          <Settings2 size={16} /> Equipment & losses
        </summary>
        <p className="muted">
          The defaults suit most home setups. Adjust them once you know how
          your own system behaves.
        </p>
        <div className="field-grid">
          <Field
            label="Brewhouse efficiency"
            suffix="%"
            value={recipe.efficiency}
            min={1}
            max={100}
            step={1}
            onChange={(n) =>
              applyEquipment(scaleRecipe(recipe, recipe.batchL, n, catalog))
            }
          />
          <Field
            label="Boil duration"
            suffix="min"
            value={recipe.boilMinutes}
            min={0}
            max={240}
            step={1}
            onChange={(n) => applyEquipment({ ...recipe, boilMinutes: n })}
          />
          <Field
            label="Boil-off rate"
            suffix={us ? "gal/h" : "L/h"}
            value={
              us ? lToGal(recipe.boilOffLPerHour) : recipe.boilOffLPerHour
            }
            min={0}
            onChange={(n) =>
              applyEquipment({
                ...recipe,
                boilOffLPerHour: us ? n * L_PER_GAL : n,
              })
            }
          />
          <Field
            label="Transfer loss"
            suffix={us ? "gal" : "L"}
            value={us ? lToGal(recipe.lossL) : recipe.lossL}
            min={0}
            max={(us ? lToGal(recipe.batchL) : recipe.batchL) - 0.1}
            onChange={(n) =>
              onChange({
                ...recipe,
                lossL: us ? n * L_PER_GAL : n,
                waterPlan: settings,
              })
            }
          />
          <Field
            label="Grain water absorption"
            suffix={us ? "gal/lb" : "L/kg"}
            value={us ? (absorption * KG_PER_LB) / L_PER_GAL : absorption}
            min={0}
            max={us ? 0.36 : 3}
            step={us ? 0.01 : 0.05}
            onChange={(n) =>
              applyWater(waterL, us ? (n * L_PER_GAL) / KG_PER_LB : n)
            }
            help="How much water each pound or kilogram of grain holds onto after mashing. Squeezing a grain bag lowers it."
          />
          <Field
            label="Packaging loss"
            suffix={us ? "gal" : "L"}
            value={us ? lToGal(packLossL) : packLossL}
            min={0}
            onChange={(n) => {
              const loss = us ? n * L_PER_GAL : n;
              setPackLossL(loss);
              recordSettings({ packagingLossL: loss });
            }}
            help="Beer left behind with the yeast and when bottling. Only affects the bottle count."
          />
          <label className="field">
            <span>Bottle size</span>
            <select
              aria-label="Bottle size"
              value={bottleMl}
              onChange={(e) => {
                const size = Number(e.target.value);
                setBottleMl(size);
                recordSettings({ bottleMl: size });
              }}
            >
              <option value={330}>330 mL</option>
              <option value={354.882}>12 US fl oz</option>
              <option value={500}>500 mL</option>
              <option value={650}>650 mL</option>
              <option value={750}>750 mL</option>
            </select>
          </label>
        </div>
      </details>
    </section>
  );
}
