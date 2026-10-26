import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser";
import type { Catalog, Recipe } from "./engine/types";
import { recipeSchema } from "./validation";
import {
  additives,
  contactMinutes,
  additiveName,
  CUSTOM_ADDITIVE_ID,
} from "./engine/additives";
import { processNoteEntries } from "./engine/processNotes";
export function exportBeerXML(r: Recipe, c: Catalog) {
  const y = c.yeasts.find((y) => y.id === r.yeastId)!;
  const data = {
    RECIPES: {
      RECIPE: {
        NAME: r.name,
        VERSION: 1,
        TYPE: "All Grain",
        BREWER: "Brew Designer",
        BATCH_SIZE: r.batchL,
        BOIL_SIZE: r.batchL + (r.boilOffLPerHour * r.boilMinutes) / 60,
        BOIL_TIME: r.boilMinutes,
        EFFICIENCY: r.efficiency,
        PRIMARY_TEMP: r.fermentC,
        CARBONATION: r.carbonation,
        NOTES: [
          r.notes ?? "",
          ...processNoteEntries(r.processNotes).map(
            (s) => `${s.label}:\n${s.note}`,
          ),
        ]
          .filter(Boolean)
          .join("\n\n"),
        BD_GENERAL_NOTES: r.notes ?? "",
        BD_ADDITIVES: JSON.stringify(r.additives ?? []),
        BD_PROCESS_NOTES: JSON.stringify(r.processNotes ?? {}),
        BD_DESCRIPTION: r.description ?? "",
        BD_TAGS: JSON.stringify(r.tags ?? []),
        BD_ORIGIN: r.origin ? JSON.stringify(r.origin) : "",
        BD_STYLE_ID: r.styleId,
        BD_LOSS_L: r.lossL,
        BD_WHIRLPOOL_FACTOR: r.whirlpoolFactor,
        BD_PITCH_MULTIPLIER: r.pitchMultiplier,
        MISCS: {
          MISC: (r.additives ?? []).map((a) => ({
            NAME: additiveName(a),
            VERSION: 1,
            TYPE: additives
              .find((i) => i.id === a.ingredientId)
              ?.category.includes("finings")
              ? "Fining"
              : "Flavor",
            USE:
              a.stage === "boil"
                ? "Boil"
                : a.stage === "mash" || a.stage === "preparation"
                  ? "Mash"
                  : a.stage === "fermentation"
                    ? "Primary"
                    : a.stage === "packaging" || a.stage === "tasting"
                      ? "Bottling"
                      : "Secondary",
            TIME: contactMinutes(a),
            AMOUNT: a.unit === "item" ? 0 : a.amount / 1000,
            AMOUNT_IS_WEIGHT: a.unit === "g",
            BD_ID: a.ingredientId,
            BD_ADDITION_ID: a.id,
            BD_AMOUNT: a.amount,
            BD_UNIT: a.unit,
            BD_STAGE: a.stage,
            BD_TIME: a.time,
            BD_TIME_UNIT: a.timeUnit,
            NOTES: `${a.amount} ${a.unit}; ${a.stage}; ${a.time} ${a.timeUnit}. ${a.notes}${a.unit === "item" ? " Count retained in BD_AMOUNT/BD_UNIT; no tablet mass or volume assumed." : ""}`,
            BD_NOTES: a.notes,
          })),
        },
        FERMENTABLES: {
          FERMENTABLE: r.grains.map((g) => {
            const m = c.malts.find((m) => m.id === g.ingredientId)!;
            return {
              NAME: m.name,
              VERSION: 1,
              TYPE:
                m.type === "sugar"
                  ? "Sugar"
                  : m.type === "extract"
                    ? "Extract"
                    : "Grain",
              AMOUNT: g.kg,
              YIELD: m.extractPercent,
              COLOR: m.lovibond,
              BD_ID: m.id,
            };
          }),
        },
        HOPS: {
          HOP: r.hops.map((h) => ({
            NAME: c.hops.find((x) => x.id === h.ingredientId)!.name,
            VERSION: 1,
            ALPHA:
              h.alpha ?? c.hops.find((x) => x.id === h.ingredientId)!.alpha[0],
            AMOUNT: h.grams / 1000,
            USE:
              h.use === "dry hop"
                ? "Dry Hop"
                : h.use === "whirlpool"
                  ? "Aroma"
                  : "Boil",
            TIME: h.minutes,
            FORM: "Pellet",
            BD_ID: h.ingredientId,
          })),
        },
        YEASTS: {
          YEAST: {
            NAME: y.name,
            VERSION: 1,
            TYPE: y.type === "lager" ? "Lager" : "Ale",
            FORM: y.form === "dry" ? "Dry" : "Liquid",
            AMOUNT: 0.011,
            ATTENUATION: (y.attenuation[0] + y.attenuation[1]) / 2,
            LABORATORY: y.lab,
            PRODUCT_ID: y.code,
            BD_ID: y.id,
          },
        },
        MASH: {
          NAME: "Single infusion",
          VERSION: 1,
          GRAIN_TEMP: 20,
          MASH_STEPS: {
            MASH_STEP: {
              NAME: "Saccharification",
              VERSION: 1,
              TYPE: "Infusion",
              STEP_TEMP: r.mashC,
              STEP_TIME: r.mashMinutes,
            },
          },
        },
      },
    },
  };
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    new XMLBuilder({ format: true }).build(data)
  );
}
export function importRecipe(
  text: string,
  c: Catalog,
  defaults: Recipe,
): Recipe {
  if (text.trimStart().startsWith("{")) {
    const r = recipeSchema.parse(JSON.parse(text));
    assertKnown(r, c);
    return { ...r, id: crypto.randomUUID() };
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error("DTD and entity declarations are not supported.");
  if (XMLValidator.validate(text) !== true) throw new Error("Invalid XML.");
  const parsed = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: false,
  }).parse(text);
  let x = parsed.RECIPES?.RECIPE ?? parsed.RECIPE;
  if (Array.isArray(x)) throw new Error("Import one recipe at a time.");
  if (!x) throw new Error("No BeerXML recipe found.");
  const arr = (a: unknown) => (a == null ? [] : Array.isArray(a) ? a : [a]);
  const resolveId = (a: any, list: { id: string; name: string }[]) => {
    const match =
      list.find((i) => i.id === a.BD_ID) ||
      list.find((i) => i.name.toLowerCase() === String(a.NAME).toLowerCase());
    if (!match)
      throw new Error(
        `Unknown ingredient: ${a.NAME}. Add it to the catalog before importing.`,
      );
    return match.id;
  };
  const ys = arr(x.YEASTS?.YEAST);
  if (ys.length !== 1) throw new Error("Exactly one known yeast is required.");
  const steps = arr(x.MASH?.MASH_STEPS?.MASH_STEP);
  if (steps.length > 1)
    throw new Error(
      "Multi-step mashes are not supported; import a single-infusion recipe.",
    );
  const batch = Number(x.BATCH_SIZE),
    boil = Number(x.BOIL_TIME ?? 60);
  const r = recipeSchema.parse({
    ...defaults,
    id: crypto.randomUUID(),
    name: x.NAME,
    styleId: x.BD_STYLE_ID ?? "",
    notes: String(x.BD_GENERAL_NOTES ?? x.NOTES ?? ""),
    additives: x.BD_ADDITIVES
      ? JSON.parse(String(x.BD_ADDITIVES))
      : arr(x.MISCS?.MISC).map((a: any) => {
          const item =
            a.BD_ID === CUSTOM_ADDITIVE_ID
              ? undefined
              : additives.find(
                  (i) =>
                    i.id === a.BD_ID ||
                    [i.name, ...i.aliases].some(
                      (name) =>
                        name.toLowerCase() === String(a.NAME).toLowerCase(),
                    ),
                );
          const customName = !item ? String(a.NAME ?? "").trim() : undefined;
          if (!item && !customName)
            throw new Error("An unlisted additive needs a name.");
          if (!a.BD_UNIT && a.AMOUNT_IS_WEIGHT === undefined)
            throw new Error(`Missing amount unit for additive: ${a.NAME}`);
          const weight =
            a.AMOUNT_IS_WEIGHT === true ||
            String(a.AMOUNT_IS_WEIGHT).toLowerCase() === "true";
          if (
            !a.BD_UNIT &&
            item &&
            (item.guide.unit === "item" || (item.guide.unit === "g") !== weight)
          )
            throw new Error(
              `Cannot infer a compatible amount unit for ${a.NAME}; include the BrewMaster additive fields or convert it explicitly.`,
            );
          const stages: Record<string, string> = {
            mash: "mash",
            boil: "boil",
            primary: "fermentation",
            secondary: "conditioning",
            bottling: "packaging",
          };
          const stage = a.BD_STAGE ?? stages[String(a.USE).toLowerCase()];
          if (!stage) throw new Error(`Unsupported additive stage: ${a.USE}`);
          return {
            id: a.BD_ADDITION_ID || crypto.randomUUID(),
            ingredientId: item?.id ?? CUSTOM_ADDITIVE_ID,
            ...(customName ? { customName } : {}),
            amount:
              a.BD_AMOUNT !== undefined
                ? Number(a.BD_AMOUNT)
                : Number(a.AMOUNT) * 1000,
            unit: a.BD_UNIT ?? (weight ? "g" : "mL"),
            stage,
            time: Number(a.BD_TIME ?? a.TIME ?? 0),
            timeUnit: a.BD_TIME_UNIT ?? "minutes",
            notes: String(a.BD_NOTES ?? a.NOTES ?? ""),
          };
        }),
    processNotes: x.BD_PROCESS_NOTES
      ? JSON.parse(String(x.BD_PROCESS_NOTES))
      : undefined,
    description: String(x.BD_DESCRIPTION ?? ""),
    tags: x.BD_TAGS ? JSON.parse(String(x.BD_TAGS)) : [],
    origin: x.BD_ORIGIN ? JSON.parse(String(x.BD_ORIGIN)) : undefined,
    batchL: batch,
    efficiency: Number(x.EFFICIENCY ?? 72),
    boilMinutes: boil,
    boilOffLPerHour:
      boil > 0
        ? (Math.max(0, Number(x.BOIL_SIZE ?? batch) - batch) * 60) / boil
        : 0,
    lossL: Number(x.BD_LOSS_L ?? 0),
    whirlpoolFactor: Number(x.BD_WHIRLPOOL_FACTOR ?? 0.15),
    pitchMultiplier: Number(x.BD_PITCH_MULTIPLIER ?? 1),
    mashC: Number(steps[0]?.STEP_TEMP ?? 65),
    mashMinutes: Number(steps[0]?.STEP_TIME ?? 60),
    fermentC: Number(x.PRIMARY_TEMP ?? 19),
    carbonation: Number(x.CARBONATION ?? 2.4),
    yeastId: resolveId(ys[0], c.yeasts),
    grains: arr(x.FERMENTABLES?.FERMENTABLE).map((a: any) => ({
      ingredientId: resolveId(a, c.malts),
      kg: Number(a.AMOUNT),
    })),
    hops: arr(x.HOPS?.HOP).map((a: any) => {
      const use = String(a.USE).toLowerCase();
      if (!["boil", "aroma", "whirlpool", "dry hop"].includes(use))
        throw new Error(`Unsupported hop use: ${a.USE}`);
      return {
        ingredientId: resolveId(a, c.hops),
        grams: Number(a.AMOUNT) * 1000,
        alpha: Number(a.ALPHA),
        use:
          use === "dry hop" ? "dry hop" : use === "boil" ? "boil" : "whirlpool",
        minutes: Number(a.TIME),
      };
    }),
  });
  return r;
}
function assertKnown(r: Recipe, c: Catalog) {
  for (const g of r.grains)
    if (!c.malts.some((m) => m.id === g.ingredientId))
      throw new Error("Unknown grain");
  for (const h of r.hops)
    if (!c.hops.some((m) => m.id === h.ingredientId))
      throw new Error("Unknown hop");
  if (!c.yeasts.some((y) => y.id === r.yeastId))
    throw new Error("Unknown yeast");
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
