import type { BrewLog, Recipe } from "./engine/types";
export type Visibility = "private" | "public";
export interface RecordAccess {
  visibility: Visibility;
  owned: boolean;
}
export type SavedRecipe = Recipe & { access: RecordAccess };
export type SavedBrewLog = BrewLog & { access: RecordAccess };
export function recordAccess(
  record: Recipe | BrewLog,
): RecordAccess | undefined {
  return "access" in record
    ? (record as SavedRecipe | SavedBrewLog).access
    : undefined;
}
