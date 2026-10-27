import { Droplets, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import type { Catalog, Recipe } from "../engine/types";
import {
  G_PER_OZ,
  kgToLb,
  KG_PER_LB,
  lToGal,
  L_PER_GAL,
  scaleRecipe,
} from "../engine/calculations";
import { planFromWater, waterSettings } from "../engine/waterPlan";
import { Field, Section, Tag } from "./ui";
export default function WaterPlanner({
  recipe,
  catalog,
  us,
  onChange,
  expanded = false,
}: {
  recipe: Recipe;
  catalog: Catalog;
  us: boolean;
  onChange: (r: Recipe) => void;
  expanded?: boolean;
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
    `${(us ? lToGal(l) : l).toFixed(2)} ${us ? "gal" : "L"}`;
  return (
    <details
      className={`water-planner ${expanded ? "water-planner-expanded" : ""}`}
      open={expanded || undefined}
    >
      <summary onClick={expanded ? (e) => e.preventDefault() : undefined}>
        <Droplets size={24} />
        <span>
          <b>Start with your water.</b>
          <small>
            {(us ? lToGal(waterL) : waterL).toFixed(us ? 1 : 2)}{" "}
            {us ? "gal" : "L"} starting water · live ingredient scaling
          </small>
        </span>
        <ChevronDown className="water-chevron" size={18} />
      </summary>
      <Section title="How much water?" eyebrow="WATER → RECIPE → BOTTLES">
        <p className="muted">
          Start with 5 US gallons (18.93 L), or enter your own amount. Finished
          beer will be less after grain absorption, boiling and losses.
        </p>
        <div className="field-grid">
          <Field
            label="Starting brewing water"
            suffix={us ? "gal" : "L"}
            value={us ? lToGal(waterL) : waterL}
            min={0.1}
            onChange={(n) => applyWater(us ? n * L_PER_GAL : n)}
            help="Total water before grain absorption and boiling, including mash and sparge water. This is not finished beer volume. No extra top-up, dead-space or cooling shrinkage is modeled; account for these in your equipment losses."
          />
        </div>
        {plan && (
          <div className="water-yield">
            <strong>{vol(plan.recipe.batchL)}</strong>
            <span>estimated post-boil wort</span>
            <p>
              About {plan.bottles} bottles ·{" "}
              {bottleMl === 354.882 ? "12 US fl oz" : `${bottleMl} mL`} each
            </p>
            <small>Yield updates as you build the recipe.</small>
          </div>
        )}
        <details className="advanced water-assumptions">
          <summary>Water losses, bottle size & yeast planning</summary>
          <div className="field-grid">
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
              help="Planning assumption per kilogram of mash grain. Default 0.8 L/kg is an adjustable heuristic; squeezing a bag or draining differently changes retention. Extract and non-mash fermentables do not absorb water in this model."
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
              help="Additional beer lost after the kettle transfer, for example sediment and bottling losses. Subtracted from fermenter yield for bottle estimates only."
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
            <Field
              label={
                dry
                  ? "Assumed viable cells per gram"
                  : "Viable cells per liquid pack"
              }
              suffix="billion"
              value={dry ? dryCells : liquidCells}
              min={0.1}
              onChange={(n) => {
                if (dry) setDryCells(n);
                else setLiquidCells(n);
                recordSettings(
                  dry
                    ? { dryCellsBillionPerG: n }
                    : { liquidCellsBillionPerPack: n },
                );
              }}
              help="Editable planning assumption, not a specification for the selected strain. Use the supplier's viable cell count, accounting for age and storage. Pitch rate follows the recipe's ale/lager rate and pitch multiplier."
            />
            {dry && (
              <Field
                label="Dry yeast packet size"
                suffix="g"
                value={packGrams}
                min={0.1}
                onChange={(n) => {
                  setPackGrams(n);
                  recordSettings({ dryPackGrams: n });
                }}
              />
            )}
          </div>
        </details>
        <details className="advanced water-equipment">
          <summary>Equipment, boil-off & efficiency</summary>
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
          </div>
        </details>
        <Tag tone="objective">
          CALCULATED · WITH ADJUSTABLE LOSS & CELL ASSUMPTIONS
        </Tag>
        {(error || equipmentError) && (
          <p className="notice" role="alert">
            {error || equipmentError}
          </p>
        )}
        {plan && (
          <>
            <p role="status">
              Post-boil wort {vol(plan.recipe.batchL)} · packaged beer ≈{" "}
              {vol(plan.packagedL)} · about {plan.bottles} full bottles
            </p>
            <p className="muted">
              Water retained by grain ≈ {vol(plan.absorbedL)} · evaporation{" "}
              {vol(plan.evaporationL)} · kettle transfer loss{" "}
              {vol(plan.recipe.lossL)}. Review boil-off and transfer settings in
              the equipment settings. Packaging loss is separate.
            </p>
            {!expanded && (
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
                    {us ? "oz" : "g"} ·{" "}
                    {h.use === "dry hop"
                      ? `Dry hopping · ${h.minutes / 1440} days`
                      : h.use === "whirlpool"
                        ? `Whirlpool · ${h.minutes} min contact`
                        : `Boil · ${h.minutes} min before the end`}
                  </li>
                ))}
              </ul>
            )}
            {!expanded && (
              <p>
                {yeast.name}: ≈ {plan.pitchBillion.toFixed(0)} billion viable
                cells;{" "}
                {dry
                  ? `≈ ${plan.yeastUnits.toFixed(1)} g (${Math.ceil(plan.yeastUnits / packGrams)} packets of ${packGrams} g, rounded up)`
                  : `≈ ${Math.ceil(plan.yeastUnits)} liquid packs, rounded up`}
                . Verify with the supplier; a starter may be needed.
              </p>
            )}
            <p hidden={expanded} className="water-scale-status" role="status">
              Ingredient amounts match this water plan.
            </p>
            <p className="muted">
              Water and absorption edits update your draft ingredient amounts
              and batch size immediately. Save your recipe to keep the scaled
              amounts. Yeast dosage and bottle count are planning estimates;
              bottle count does not calculate priming sugar.
            </p>
          </>
        )}
      </Section>
    </details>
  );
}
