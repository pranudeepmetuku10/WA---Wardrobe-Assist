import type { Category, Material, Season } from "@/lib/garments/attributes";
import type { OccasionRule } from "@/lib/rules/occasions";
import {
  targetWarmth,
  weatherScore,
  type WeatherConditions,
} from "@/lib/rules/weather";

/**
 * Stage A, step 1: narrow the wardrobe to garments that could plausibly work
 * today, and score what survives. Pure functions — no database, no model.
 */

export interface CandidateGarment {
  id: string;
  category: Category;
  subcategory: string;
  formality: number;
  warmth: number;
  materials: Material[];
  seasons: Season[];
  styleTags: string[];
  status: string;
  isBasic: boolean;
  lastWornAt: Date | null;
  isFavorite: boolean;
}

export interface FilterContext {
  occasion: OccasionRule;
  weather: WeatherConditions;
  season: Season;
  recencyDays: number;
  now: Date;
  /** Relaxations applied by the ladder, in order. */
  relaxed?: Relaxation[];
}

export type Relaxation = "recency" | "formality" | "season";

export type RejectionReason =
  | "unavailable"
  | "out_of_season"
  | "too_formal"
  | "too_casual"
  | "worn_recently"
  | "wrong_for_weather";

/**
 * How far a garment's warmth may sit from what the temperature calls for
 * before it is vetoed outright rather than merely scored down.
 *
 * Scoring alone is not enough: when few candidates survive, a low-scoring
 * garment still reaches the model, which then writes a confident paragraph
 * justifying wool trousers at 32C. Some suggestions should be impossible, not
 * unlikely — this is the rule behind "never suggest wool at 35C".
 *
 * Deliberately not part of the relaxation ladder. If the wardrobe holds
 * nothing wearable in this weather, the honest answer is to say so.
 */
const WARMTH_VETO_GAP = 2;

export interface ScoredGarment {
  garment: CandidateGarment;
  weatherFit: number;
  formalityFit: number;
  styleFit: number;
  score: number;
}

export interface FilterResult {
  kept: ScoredGarment[];
  rejected: Map<RejectionReason, number>;
}

export function filterGarments(
  garments: readonly CandidateGarment[],
  context: FilterContext,
): FilterResult {
  const relaxed = new Set(context.relaxed ?? []);
  const rejected = new Map<RejectionReason, number>();
  const kept: ScoredGarment[] = [];

  // Relaxing formality widens the window by one step on each side.
  const [minFormality, maxFormality] = relaxed.has("formality")
    ? [context.occasion.formality[0] - 1, context.occasion.formality[1] + 1]
    : context.occasion.formality;

  for (const garment of garments) {
    if (garment.status !== "AVAILABLE") {
      bump(rejected, "unavailable");
      continue;
    }

    if (
      !relaxed.has("season") &&
      !garment.seasons.includes("ALL_SEASON") &&
      !garment.seasons.includes(context.season)
    ) {
      bump(rejected, "out_of_season");
      continue;
    }

    if (garment.formality > maxFormality) {
      bump(rejected, "too_formal");
      continue;
    }
    if (garment.formality < minFormality) {
      bump(rejected, "too_casual");
      continue;
    }

    if (isWrongForWeather(garment, context.weather)) {
      bump(rejected, "wrong_for_weather");
      continue;
    }

    // Basics are exempt: nobody minds wearing the same jeans twice in a week.
    if (
      !relaxed.has("recency") &&
      !garment.isBasic &&
      wornWithin(garment.lastWornAt, context.recencyDays, context.now)
    ) {
      bump(rejected, "worn_recently");
      continue;
    }

    kept.push(scoreGarment(garment, context, [minFormality, maxFormality]));
  }

  kept.sort((a, b) => b.score - a.score);
  return { kept, rejected };
}

function scoreGarment(
  garment: CandidateGarment,
  context: FilterContext,
  window: [number, number],
): ScoredGarment {
  const weatherFit = weatherScore(garment, context.weather);

  // Closeness to the occasion's sweet spot, not just inside the window.
  const span = Math.max(1, window[1] - window[0]);
  const formalityFit = Math.max(
    0,
    1 - Math.abs(garment.formality - context.occasion.ideal) / (span + 1),
  );

  const favour = context.occasion.favourTags ?? [];
  const avoid = context.occasion.avoidTags ?? [];
  const tags = garment.styleTags;
  let styleFit = 0.6;
  if (favour.some((tag) => tags.includes(tag))) styleFit += 0.3;
  if (avoid.some((tag) => tags.includes(tag))) styleFit -= 0.45;
  if (garment.isFavorite) styleFit += 0.1;
  styleFit = Math.min(1, Math.max(0, styleFit));

  // Weather is weighted hardest: being wrong for the temperature is the most
  // visible kind of bad suggestion.
  const score = weatherFit * 0.45 + formalityFit * 0.35 + styleFit * 0.2;

  return { garment, weatherFit, formalityFit, styleFit, score };
}

/** True when the garment is physically unsuited to the temperature. */
export function isWrongForWeather(
  garment: Pick<CandidateGarment, "warmth">,
  weather: WeatherConditions,
): boolean {
  // Indoors, the outside temperature matters much less.
  if (weather.indoor) return false;

  const target = targetWarmth(weather.temperatureC);

  // Too warm for real heat.
  if (weather.temperatureC >= 28 && garment.warmth >= target + WARMTH_VETO_GAP) {
    return true;
  }
  // Too thin for real cold.
  if (weather.temperatureC <= 5 && garment.warmth <= target - WARMTH_VETO_GAP) {
    return true;
  }
  return false;
}

function wornWithin(
  lastWornAt: Date | null,
  days: number,
  now: Date,
): boolean {
  if (!lastWornAt || days <= 0) return false;
  const elapsedDays = (now.getTime() - lastWornAt.getTime()) / 86_400_000;
  return elapsedDays < days;
}

function bump(map: Map<RejectionReason, number>, reason: RejectionReason) {
  map.set(reason, (map.get(reason) ?? 0) + 1);
}

/** Northern-hemisphere-ish default; India's monsoon months matter here too. */
export function seasonForDate(date: Date, monsoon = false): Season {
  const month = date.getMonth() + 1;
  if (monsoon && month >= 6 && month <= 9) return "MONSOON";
  if (month >= 3 && month <= 5) return "SPRING";
  if (month >= 6 && month <= 8) return "SUMMER";
  if (month >= 9 && month <= 11) return "AUTUMN";
  return "WINTER";
}
