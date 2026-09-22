import type { GarmentColor, Pattern } from "@/lib/garments/attributes";
import { outfitColorScore } from "@/lib/rules/color";
import type { ScoredGarment } from "@/lib/rules/filter";
import {
  needsOuterwear,
  rejectsOuterwear,
  type WeatherConditions,
} from "@/lib/rules/weather";

/**
 * Stage A, step 2: build plausible outfits from the surviving garments.
 *
 * The model never assembles an outfit from scratch — it ranks and explains
 * what this function produced. That is what stops a small local model from
 * suggesting a dress with trousers, or shoes that don't exist.
 */

export interface CombinableGarment extends ScoredGarment {
  colors: GarmentColor[];
  pattern: Pattern;
}

export type SlotName =
  | "top"
  | "bottom"
  | "one_piece"
  | "footwear"
  | "outerwear"
  | "accessory";

export interface Combination {
  id: string;
  garmentIds: string[];
  slots: Partial<Record<SlotName, string>>;
  score: number;
  colorScore: number;
  weatherScore: number;
  formalityScore: number;
}

export interface CombineOptions {
  weather: WeatherConditions;
  /** Hard cap on combinations handed to the model. */
  limit?: number;
  /** How many of each slot to consider before combining. */
  breadth?: number;
}

export interface CombineResult {
  combinations: Combination[];
  /** Slots with nothing available — the wardrobe gap to report. */
  missingSlots: SlotName[];
  /** Total combinations built before the cap was applied. */
  generated: number;
}

const DEFAULT_LIMIT = 40;
const DEFAULT_BREADTH = 8;

export function buildCombinations(
  garments: readonly CombinableGarment[],
  options: CombineOptions,
): CombineResult {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const breadth = options.breadth ?? DEFAULT_BREADTH;

  const bySlot = (category: string) =>
    garments
      .filter((g) => g.garment.category === category)
      .sort((a, b) => b.score - a.score);

  const tops = bySlot("TOP").slice(0, breadth);
  const bottoms = bySlot("BOTTOM").slice(0, breadth);
  const onePieces = bySlot("ONE_PIECE").slice(0, breadth);
  const footwear = bySlot("FOOTWEAR").slice(0, Math.max(3, breadth - 3));
  const outerwear = bySlot("OUTERWEAR").slice(0, 3);
  const accessories = [...bySlot("ACCESSORY"), ...bySlot("BAG")]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const missingSlots: SlotName[] = [];
  if (!footwear.length) missingSlots.push("footwear");
  if (!tops.length && !onePieces.length) missingSlots.push("top");
  if (!bottoms.length && !onePieces.length) missingSlots.push("bottom");

  // Without shoes, or without something to cover top and bottom, there is no
  // outfit to build — say so rather than returning half an outfit.
  if (!footwear.length || (!onePieces.length && (!tops.length || !bottoms.length))) {
    return { combinations: [], missingSlots, generated: 0 };
  }

  const wantsLayer = needsOuterwear(options.weather);
  const refusesLayer = rejectsOuterwear(options.weather);
  const layerChoices: (CombinableGarment | null)[] = refusesLayer
    ? [null]
    : wantsLayer && outerwear.length
      ? outerwear // a layer is required, so no bare option
      : [null, ...outerwear];

  const bases: CombinableGarment[][] = [];
  for (const top of tops) {
    for (const bottom of bottoms) bases.push([top, bottom]);
  }
  for (const piece of onePieces) bases.push([piece]);

  const combinations: Combination[] = [];
  for (const base of bases) {
    for (const shoes of footwear) {
      for (const layer of layerChoices) {
        const parts = layer ? [...base, shoes, layer] : [...base, shoes];
        combinations.push(assemble(parts, options.weather));
      }
    }
  }

  const generated = combinations.length;
  combinations.sort((a, b) => b.score - a.score);
  const top = combinations.slice(0, limit);

  // Offer an accessory on the strongest few, so the model has the option
  // without multiplying the candidate count.
  //
  // It must be re-scored with the accessory included, not bolted on after.
  // Attaching it post-scoring skipped formality coherence entirely and
  // produced a necktie with a t-shirt.
  if (accessories.length) {
    const partsById = new Map(garments.map((g) => [g.garment.id, g]));
    for (let i = 0; i < Math.min(5, top.length); i += 1) {
      const parts = top[i].garmentIds
        .map((id) => partsById.get(id))
        .filter((g): g is CombinableGarment => Boolean(g));

      const accessory = accessories.find((candidate) =>
        suitsOutfit(candidate, parts),
      );
      if (!accessory) continue;

      const rescored = assemble([...parts, accessory], options.weather);
      // Only keep the accessory if it does not make the outfit worse.
      if (rescored.score >= top[i].score - 0.02) top[i] = rescored;
    }
    top.sort((a, b) => b.score - a.score);
  }

  return { combinations: top, missingSlots, generated };
}

function assemble(
  parts: CombinableGarment[],
  weather: WeatherConditions,
): Combination {
  const slots: Partial<Record<SlotName, string>> = {};
  for (const part of parts) {
    slots[slotFor(part.garment.category)] = part.garment.id;
  }

  const colorScore = outfitColorScore(
    parts.map((p) => ({ colors: p.colors, pattern: p.pattern })),
  );
  const weatherFit = average(parts.map((p) => p.weatherFit));
  const formalityScore = formalityCoherence(parts);

  // Colour is a third of the pre-score: it is the cheapest way to cut the
  // candidate list down to things that look deliberate.
  const score =
    weatherFit * 0.35 +
    formalityScore * 0.3 +
    colorScore * 0.25 +
    average(parts.map((p) => p.styleFit)) * 0.1;

  return {
    id: parts.map((p) => p.garment.id).join("+"),
    garmentIds: parts.map((p) => p.garment.id),
    slots,
    score: Number(score.toFixed(4)),
    colorScore: Number(colorScore.toFixed(4)),
    weatherScore: Number(weatherFit.toFixed(4)),
    formalityScore: Number(formalityScore.toFixed(4)),
    ...(weather.indoor ? {} : {}),
  };
}

/**
 * An accessory has to belong to the outfit it is added to. A crimson silk tie
 * is a fine thing to own and a bad thing to wear with a crew-neck t-shirt.
 */
function suitsOutfit(
  accessory: CombinableGarment,
  parts: CombinableGarment[],
): boolean {
  const upper = parts.find(
    (p) => p.garment.category === "TOP" || p.garment.category === "ONE_PIECE",
  );
  if (!upper) return false;

  // Within one formality step of the garment it sits against.
  if (Math.abs(accessory.garment.formality - upper.garment.formality) > 1) {
    return false;
  }

  // Neckwear needs a collar to sit on.
  const needsCollar = /\b(tie|bow tie|cravat|pocket square)\b/i.test(
    accessory.garment.subcategory,
  );
  if (needsCollar) {
    const collared = /\b(shirt|blouse|kurta|polo)\b/i.test(
      upper.garment.subcategory,
    );
    if (!collared) return false;
  }

  return true;
}

/**
 * Formality has to hold together across the outfit: dress shoes with gym
 * shorts scores badly even when both suit the occasion on their own.
 */
function formalityCoherence(parts: CombinableGarment[]): number {
  const levels = parts.map((p) => p.garment.formality);
  const spread = Math.max(...levels) - Math.min(...levels);
  let score = 1 - spread / 4;

  const footwear = parts.find((p) => p.garment.category === "FOOTWEAR");
  const upper = parts.find(
    (p) => p.garment.category === "TOP" || p.garment.category === "ONE_PIECE",
  );
  // The eval rubric calls for footwear within one step of the top.
  if (footwear && upper) {
    const gap = Math.abs(footwear.garment.formality - upper.garment.formality);
    if (gap > 1) score -= 0.2 * (gap - 1);
  }

  return Math.min(1, Math.max(0, score));
}

function slotFor(category: string): SlotName {
  switch (category) {
    case "TOP":
      return "top";
    case "BOTTOM":
      return "bottom";
    case "ONE_PIECE":
      return "one_piece";
    case "FOOTWEAR":
      return "footwear";
    case "OUTERWEAR":
      return "outerwear";
    default:
      return "accessory";
  }
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
