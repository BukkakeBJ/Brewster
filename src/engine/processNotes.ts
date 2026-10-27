/** User observations, never inputs to the numeric or sensory prediction engines. */
export const processStages = [
  {
    id: "preparation",
    label: "Ingredients & preparation",
    hint: "Grain substitutions, water treatment, milling, equipment setup…",
  },
  {
    id: "mash",
    label: "Mash & lauter",
    hint: "Mash rests, pH readings, sparging, conversion, changes to try…",
  },
  {
    id: "boil",
    label: "Boil & hop additions",
    hint: "Hop timing experiments, kettle additions, boil observations…",
  },
  {
    id: "whirlpool",
    label: "Whirlpool / hop stand",
    hint: "Post-boil additions, contact temperature, time before chilling…",
  },
  {
    id: "cooling",
    label: "Chilling & transfer",
    hint: "Hop-stand temperature and duration, chilling, transfer losses…",
  },
  {
    id: "steep-dry-hop",
    label: "Steep / dry hop",
    hint: "Cocoa nib or spice steeping, cold-side additions, dry-hop contact time…",
  },
  {
    id: "fermentation",
    label: "Yeast & fermentation",
    hint: "Pitching, temperature changes, gravity readings, dry hopping…",
  },
  {
    id: "conditioning",
    label: "Conditioning & aging",
    hint: "Cold crash, oak or fruit additions, aging time, blending…",
  },
  {
    id: "packaging",
    label: "Packaging & carbonation",
    hint: "Bottling or kegging, priming, pressure, carbonation experiments…",
  },
  {
    id: "tasting",
    label: "Tasting & next batch",
    hint: "What worked, what changed, and what to try next time…",
  },
] as const;
export type ProcessStage = (typeof processStages)[number]["id"];
export type ProcessNotes = Partial<Record<ProcessStage, string>>;
export function processNoteEntries(notes?: ProcessNotes) {
  return processStages.flatMap((stage) =>
    notes?.[stage.id]?.trim() ? [{ ...stage, note: notes[stage.id]! }] : [],
  );
}
