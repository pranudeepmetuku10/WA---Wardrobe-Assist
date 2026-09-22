import type { Material } from "@/lib/garments/attributes";

/**
 * Weather fit scoring.
 *
 * Temperature sets a target warmth; humidity and rain then adjust how much the
 * fabric matters. At 34C and humid, breathability outranks everything — which
 * is the difference between suggesting linen and suggesting a cotton oxford.
 */

export interface WeatherConditions {
  temperatureC: number;
  /** 0-100. Drives how much breathability counts. */
  humidity: number;
  /** 0-100 chance of rain. */
  precipitationChance: number;
  windKph?: number;
  /** Set when the outfit will mostly be indoors in air conditioning. */
  indoor?: boolean;
}

/** 0 (traps heat) to 1 (breathes freely). */
const BREATHABILITY: Partial<Record<Material, number>> = {
  LINEN: 1.0,
  CHIFFON: 0.95,
  COTTON: 0.8,
  RAYON: 0.75,
  VISCOSE: 0.75,
  SILK: 0.7,
  CANVAS: 0.6,
  KNIT: 0.55,
  DENIM: 0.5,
  SATIN: 0.45,
  WOOL: 0.4,
  POLYESTER: 0.3,
  SYNTHETIC: 0.3,
  NYLON: 0.25,
  VELVET: 0.25,
  CASHMERE: 0.35,
  SUEDE: 0.2,
  LEATHER: 0.15,
  FLEECE: 0.15,
  RUBBER: 0.1,
  DOWN: 0.05,
};

/** Materials that suffer in rain. */
const RAIN_VULNERABLE: Material[] = ["SUEDE", "SILK", "LINEN", "CHIFFON", "SATIN"];
const RAIN_RESISTANT: Material[] = ["RUBBER", "NYLON", "POLYESTER", "SYNTHETIC", "LEATHER"];

/** The warmth level (1-5) a temperature calls for. */
export function targetWarmth(temperatureC: number): number {
  if (temperatureC >= 30) return 1;
  if (temperatureC >= 25) return 1.5;
  if (temperatureC >= 20) return 2;
  if (temperatureC >= 15) return 3;
  if (temperatureC >= 8) return 4;
  return 5;
}

export function breathability(materials: readonly Material[]): number {
  if (!materials.length) return 0.5;
  // An outfit breathes like its least breathable layer.
  return Math.min(
    ...materials.map((m) => BREATHABILITY[m] ?? 0.5),
  );
}

export interface WeatherScorable {
  warmth: number;
  materials: Material[];
  category: string;
}

/**
 * 0-1 fit for the conditions. Not a filter — Stage A ranks with it, and the
 * stylist model sees the reasoning behind the ordering.
 */
export function weatherScore(
  garment: WeatherScorable,
  weather: WeatherConditions,
): number {
  const target = targetWarmth(
    // Indoors in AC, dress for a few degrees cooler than outside.
    weather.indoor ? Math.min(weather.temperatureC, 24) : weather.temperatureC,
  );

  // Distance from the ideal warmth, normalised over the 1-5 scale.
  const warmthGap = Math.abs(garment.warmth - target);
  let score = 1 - warmthGap / 4;

  // Being too warm on a hot day is worse than being slightly under-dressed.
  if (garment.warmth > target && weather.temperatureC >= 28) {
    score -= 0.15 * (garment.warmth - target);
  }

  const breathes = breathability(garment.materials);
  const humidHeat = weather.temperatureC >= 28 || weather.humidity >= 70;
  if (humidHeat) {
    // At this point fabric matters as much as weight.
    score = score * 0.6 + breathes * 0.4;
  } else if (weather.temperatureC <= 10) {
    // In the cold, trapping heat is the point.
    score = score * 0.8 + (1 - breathes) * 0.2;
  }

  if (weather.precipitationChance >= 50) {
    if (garment.materials.some((m) => RAIN_VULNERABLE.includes(m))) {
      // Suede shoes in the rain is a ruined shoe, not a style opinion.
      score -= garment.category === "FOOTWEAR" ? 0.35 : 0.15;
    }
    if (garment.materials.some((m) => RAIN_RESISTANT.includes(m))) {
      score += 0.1;
    }
  }

  if ((weather.windKph ?? 0) >= 30 && garment.category === "OUTERWEAR") {
    score += 0.05;
  }

  return Math.min(1, Math.max(0, score));
}

/** Does the weather call for a layer at all? */
export function needsOuterwear(weather: WeatherConditions): boolean {
  return (
    weather.temperatureC <= 18 ||
    weather.precipitationChance >= 60 ||
    (weather.windKph ?? 0) >= 35
  );
}

/** Would outerwear be actively wrong? */
export function rejectsOuterwear(weather: WeatherConditions): boolean {
  return weather.temperatureC >= 27 && weather.precipitationChance < 50;
}
