import glossary from "../data/brewing-help.json";
const entries = new Map(
  Object.entries(glossary).map(([key, value]) => [key.toLowerCase(), value]),
);
const aliases: Record<string, string> = {
  og: "Original gravity",
  fg: "Final gravity",
  ibu: "Bitterness",
  srm: "Color",
  ppg: "Potential",
  lovibond: "Malt color",
  ebc: "Malt color",
  extractpercent: "Extract percent",
  diastaticpower: "Diastatic power",
  requiresmash: "Requires mash",
  maxpercent: "Max grist",
  maxpercentisestimate: "Max grist",
  alpha: "Alpha acids",
  beta: "Beta acids",
  totaloil: "Total oils",
  oils: "Oil breakdown",
  alcoholtolerance: "Alcohol tolerance",
  tempc: "Temperature",
  "wort original gravity for abv estimate": "Original gravity",
  "estimated abv minimum": "ABV at entered OG",
  "estimated abv maximum": "ABV at entered OG",
  "measured og": "Original gravity",
  "measured fg": "Final gravity",
  "actual fermentation temperature": "Fermentation temperature",
  "dry yeast packet size": "Dry packet size",
  "make it personal": "Calibration",
};
export function brewingHelp(label: string): string | undefined {
  const key = label.toLowerCase();
  if (/^hop \d+ aa %$/.test(key)) return entries.get("alpha acids");
  if (/^hop \d+ minutes$/.test(key)) return entries.get("hop minutes");
  if (/^hop \d+ days$/.test(key)) return entries.get("hop days");
  if (key.startsWith("calories /")) return entries.get("calories");
  return entries.get((aliases[key] ?? key).toLowerCase());
}
