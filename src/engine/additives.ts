import seed from "../../data/additives.json";
import sensorySeed from "../../data/additive-descriptors.json";
import type { Source, Descriptor } from "./types";
import type { ProcessStage } from "./processNotes";
import { searchByName } from "./search";
export type AdditiveUnit = "g" | "mL" | "item";
export type ContactUnit = "minutes" | "hours" | "days";
export interface Additive {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  form: string;
  stages: ProcessStage[];
  source: Source;
  guide: {
    amountPer20L: number;
    unit: AdditiveUnit;
    time: number;
    timeUnit: ContactUnit;
    doseBasis: string;
    how: string;
    limits: string;
  };
}
export interface AdditiveAddition {
  id: string;
  ingredientId: string;
  customName?: string;
  amount: number;
  unit: AdditiveUnit;
  stage: ProcessStage;
  time: number;
  timeUnit: ContactUnit;
  notes: string;
}
export const additives = seed as Additive[];
export const additiveDescriptors = sensorySeed as Descriptor[];
export const additiveModelNote =
  "Additives are recorded in the schedule, but their alcohol, sugar, dilution, color, flavor, clarity and loss effects are not included in the predictions. Numbers and radar describe the base beer.";
export function findAdditives(query = "", category = "", stage = "") {
  const eligible = additives.filter(
    (a) =>
      (!category || a.category === category) &&
      (!stage || a.stages.includes(stage as ProcessStage)),
  );
  return searchByName(
    eligible,
    query,
    (a) => a.name,
    (a) => JSON.stringify({ ...a, source: undefined }),
  );
}
export function createAdditiveAddition(
  ingredientId: string,
  batchL: number,
  id: string,
): AdditiveAddition {
  const item = additives.find((a) => a.id === ingredientId);
  if (!item) throw new Error("Unknown additive.");
  if (!Number.isFinite(batchL) || batchL <= 0)
    throw new Error("Use a positive batch volume.");
  return {
    id,
    ingredientId,
    amount: +((item.guide.amountPer20L * batchL) / 20).toFixed(4),
    unit: item.guide.unit,
    stage: item.stages[0],
    time: item.guide.time,
    timeUnit: item.guide.timeUnit,
    notes: "",
  };
}
export function displayAdditiveAmount(
  amount: number,
  unit: AdditiveUnit,
  us = false,
) {
  return {
    amount: us
      ? unit === "g"
        ? amount / 28.349523125
        : unit === "mL"
          ? amount / 29.5735295625
          : amount
      : amount,
    unit: us
      ? unit === "g"
        ? "oz"
        : unit === "mL"
          ? "US fl oz"
          : "item"
      : unit,
  };
}
export function canonicalAdditiveAmount(
  amount: number,
  unit: AdditiveUnit,
  us = false,
) {
  return us
    ? amount * (unit === "g" ? 28.349523125 : unit === "mL" ? 29.5735295625 : 1)
    : amount;
}
export function contactMinutes(addition: AdditiveAddition) {
  return (
    addition.time *
    (addition.timeUnit === "days"
      ? 1440
      : addition.timeUnit === "hours"
        ? 60
        : 1)
  );
}

export const CUSTOM_ADDITIVE_ID = "custom";
export function additiveName(row: AdditiveAddition) {
  return row.ingredientId === CUSTOM_ADDITIVE_ID
    ? row.customName?.trim() || "Custom additive"
    : (additives.find((a) => a.id === row.ingredientId)?.name ??
        row.ingredientId);
}
export function createCustomAdditive(
  name: string,
  id: string,
): AdditiveAddition {
  const customName = name.trim();
  if (!customName || customName.length > 200)
    throw new Error("Enter an additive name between 1 and 200 characters.");
  return {
    id,
    ingredientId: CUSTOM_ADDITIVE_ID,
    customName,
    amount: 0,
    unit: "g",
    stage: "conditioning",
    time: 0,
    timeUnit: "days",
    notes: "",
  };
}
