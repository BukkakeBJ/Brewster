import { z } from "zod";
const n = (min: number, max: number) => z.number().finite().min(min).max(max);
export const recipeSchema = z
  .object({
    id: z.string().min(1).max(160),
    name: z.string().min(1).max(200),
    styleId: z.string(),
    batchL: n(0.5, 10000),
    efficiency: n(1, 100),
    mashC: n(40, 85),
    mashMinutes: n(1, 240),
    fermentC: n(0, 45),
    boilMinutes: n(0, 240),
    boilOffLPerHour: n(0, 1000),
    lossL: n(0, 10000),
    whirlpoolFactor: n(0, 1),
    carbonation: n(0, 5),
    pitchMultiplier: n(0.1, 3),
    yeastId: z.string().min(1),
    grains: z
      .array(z.object({ ingredientId: z.string(), kg: n(0, 5000) }))
      .max(60),
    hops: z
      .array(
        z.object({
          ingredientId: z.string(),
          grams: n(0, 100000),
          use: z.enum(["boil", "whirlpool", "dry hop"]),
          minutes: n(0, 50000),
          alpha: n(0, 100).optional(),
        }),
      )
      .max(80),
  })
  .refine(
    (r) => r.lossL < r.batchL,
    "Transfer loss must be smaller than the batch.",
  );
const scores = z.record(z.string(), n(0, 5));
const sourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  accessed: z.string(),
  note: z.string().optional(),
});
export const descriptorSchema = z.object({
  id: z.string(),
  ingredientId: z.string(),
  descriptor: z.string(),
  intensity: n(0, 5),
  context: z.object({
    use: z.string().optional(),
    minPercent: z.number().optional(),
    maxPercent: z.number().optional(),
    minTempC: z.number().optional(),
    maxTempC: z.number().optional(),
  }),
  usageContext: z.string(),
  sourceType: z.literal("user"),
  confidence: z.enum(["low", "medium", "high"]),
  note: z.string().max(10000),
  source: sourceSchema,
});
const predictionSchema = z.object({
  og: n(1, 1.3),
  fg: n(1, 1.3),
  abv: n(0, 100),
  abvStandard: n(0, 100),
  ibu: n(0, 10000),
  srm: n(0, 5000),
  ebc: n(0, 10000),
  bugu: n(0, 10000),
  attenuation: n(0, 100),
  calories12oz: n(0, 10000),
  calories330: n(0, 10000),
  preBoilL: n(0, 100000),
  preBoilGravity: n(1, 1.3),
  postBoilL: n(0, 10000),
  fermenterL: n(0, 10000),
  pitchBillion: n(0, 10000000),
  warnings: z.array(z.string()),
});
export const logSchema = z
  .object({
    id: z.string().min(1).max(160),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    recipe: recipeSchema,
    predicted: predictionSchema,
    predictedFlavor: scores,
    actualOg: n(1.001, 1.3),
    actualFg: n(1, 1.3),
    actualVolumeL: n(0.1, 10000),
    actualTempC: n(0, 45),
    tasting: scores,
    notes: z.string().max(20000),
    descriptors: z.array(descriptorSchema).max(100),
  })
  .refine((l) => l.actualFg <= l.actualOg, "FG must not exceed OG.");
