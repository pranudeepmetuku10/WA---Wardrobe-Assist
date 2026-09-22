import "server-only";

import { recommendOutfits, type Recommendation } from "@/lib/ai/recommend";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { GarmentColor } from "@/lib/garments/attributes";
import { buildCombinations, type CombinableGarment } from "@/lib/rules/combine";
import {
  filterGarments,
  seasonForDate,
  type CandidateGarment,
  type Relaxation,
} from "@/lib/rules/filter";
import { resolveOccasion, type OccasionRule } from "@/lib/rules/occasions";
import type { WeatherConditions } from "@/lib/rules/weather";
import { forecastForCity } from "@/lib/weather/openMeteo";

/**
 * The whole recommendation flow: deterministic filtering, then the model.
 *
 * If Stage A cannot produce three viable outfits we relax constraints in a
 * fixed order and report what was relaxed, rather than silently lowering the
 * bar or returning one sad outfit.
 */
const RELAXATION_LADDER: Relaxation[][] = [
  [],
  ["recency"],
  ["recency", "formality"],
  ["recency", "formality", "season"],
];

const MIN_VIABLE = 3;

export interface RecommendRequest {
  occasion: string;
  city?: string;
  when?: Date;
  timeOfDay?: string;
  indoorOutdoor?: "indoor" | "outdoor" | "mixed";
  /** Manual override for travel, or when the forecast is wrong. */
  weather?: Partial<WeatherConditions>;
  userRequest?: string;
  persist?: boolean;
}

export interface OutfitSuggestion {
  candidateId: string;
  title: string;
  reasoning: string;
  stylingTips: string[];
  confidence: number;
  wildcard: boolean;
  garments: Array<{
    id: string;
    subcategory: string;
    category: string;
    thumbnailUrl: string | null;
    imageUrl: string | null;
  }>;
  scores: { overall: number; weather: number; colour: number; formality: number };
  outfitId?: string;
}

export interface RecommendResponse {
  ok: boolean;
  occasion: { id: string; label: string };
  weather: WeatherConditions & { description: string; place?: string };
  outfits: OutfitSuggestion[];
  gap: Recommendation["gap"];
  relaxed: Relaxation[];
  diagnostics: {
    wardrobeSize: number;
    passedFilter: number;
    combinationsGenerated: number;
    candidatesSent: number;
    missingSlots: string[];
    rejected: Record<string, number>;
    latencyMs: number;
    costUsd: number;
  };
  error?: string;
}

export async function recommend(
  request: RecommendRequest,
): Promise<RecommendResponse> {
  const now = request.when ?? new Date();
  const occasion = resolveOccasion(request.occasion);

  const profile = await prisma.styleProfile.findUnique({
    where: { userId: env.DEFAULT_USER_ID },
  });

  const weather = await resolveWeather(request, profile?.homeCity ?? null, now);
  const season = seasonForDate(now, weather.monsoonRegion);

  const rows = await prisma.garment.findMany({
    where: { userId: env.DEFAULT_USER_ID },
  });

  const candidates: CandidateGarment[] = rows.map((row) => ({
    id: row.id,
    category: row.category,
    subcategory: row.subcategory,
    formality: row.formality,
    warmth: row.warmth,
    materials: row.materials,
    seasons: row.seasons,
    styleTags: row.styleTags,
    status: row.status,
    isBasic: row.isBasic,
    lastWornAt: row.lastWornAt,
    isFavorite: row.isFavorite,
  }));

  const colorsById = new Map(
    rows.map((row) => [row.id, (row.colors ?? []) as unknown as GarmentColor[]]),
  );
  const patternById = new Map(rows.map((row) => [row.id, row.pattern]));

  // Walk the ladder until we have enough to choose from.
  let relaxed: Relaxation[] = [];
  let filtered = filterGarments(candidates, {
    occasion,
    weather: weather.conditions,
    season,
    recencyDays: profile?.wearRecencyDays ?? env.WEAR_RECENCY_DAYS,
    now,
  });
  let combinable = toCombinable(filtered.kept, colorsById, patternById);
  let built = buildCombinations(combinable, { weather: weather.conditions });

  for (const step of RELAXATION_LADDER.slice(1)) {
    if (built.combinations.length >= MIN_VIABLE) break;
    relaxed = step;
    filtered = filterGarments(candidates, {
      occasion,
      weather: weather.conditions,
      season,
      recencyDays: profile?.wearRecencyDays ?? env.WEAR_RECENCY_DAYS,
      now,
      relaxed: step,
    });
    combinable = toCombinable(filtered.kept, colorsById, patternById);
    built = buildCombinations(combinable, { weather: weather.conditions });
  }

  const garmentIndex = new Map(combinable.map((g) => [g.garment.id, g]));
  const base = {
    occasion: { id: occasion.id, label: occasion.label },
    weather: {
      ...weather.conditions,
      description: weather.description,
      place: weather.place,
    },
    relaxed,
  };

  if (!built.combinations.length) {
    return {
      ...base,
      ok: false,
      outfits: [],
      gap: gapFromMissingSlots(built.missingSlots),
      diagnostics: diagnostics(rows.length, filtered, built, 0, 0),
      error:
        built.missingSlots.length > 0
          ? `Not enough to build an outfit — missing ${built.missingSlots.join(", ")}.`
          : "No viable outfits for these conditions.",
    };
  }

  const recentlyWorn = rows
    .filter((row) => row.lastWornAt && daysSince(row.lastWornAt, now) <= 3)
    .map((row) => row.subcategory);

  const outcome = await recommendOutfits({
    combinations: built.combinations,
    garments: garmentIndex,
    context: {
      occasion,
      occasionText: request.occasion,
      weather: weather.conditions,
      weatherDescription: weather.description,
      place: weather.place,
      timeOfDay: request.timeOfDay ?? timeOfDayFor(now),
      indoorOutdoor: request.indoorOutdoor ?? "mixed",
      userRequest: request.userRequest,
      styleProfile: profile
        ? {
            colorsLoved: profile.colorsLoved,
            colorsToAvoid: profile.colorsToAvoid,
            neverPair: profile.neverPair,
            dressCodeNotes: profile.dressCodeNotes,
            freeformPreferences: profile.freeformPreferences,
            learnedPreferences: profile.learnedPreferences,
          }
        : undefined,
      recentlyWorn,
      relaxed,
    },
  });

  const diag = diagnostics(
    rows.length,
    filtered,
    built,
    built.combinations.length,
    outcome.latencyMs,
    outcome.costUsd,
  );

  if (!outcome.recommendation) {
    return {
      ...base,
      ok: false,
      outfits: [],
      gap: null,
      diagnostics: diag,
      error: outcome.error,
    };
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const outfits: OutfitSuggestion[] = outcome.recommendation.picks.map((pick) => {
    const combination = outcome.candidateMap.get(pick.candidate)!;
    return {
      candidateId: pick.candidate,
      title: pick.title,
      reasoning: pick.reasoning,
      stylingTips: pick.stylingTips,
      confidence: pick.confidence,
      wildcard: pick.wildcard,
      garments: combination.garmentIds.map((id) => {
        const row = rowById.get(id);
        return {
          id,
          subcategory: row?.subcategory ?? "unknown",
          category: row?.category ?? "TOP",
          thumbnailUrl: row?.thumbnailUrl ?? null,
          imageUrl: row?.imageUrl ?? null,
        };
      }),
      scores: {
        overall: combination.score,
        weather: combination.weatherScore,
        colour: combination.colorScore,
        formality: combination.formalityScore,
      },
    };
  });

  if (request.persist !== false) {
    await persistOutfits(outfits, request, occasion, weather, relaxed);
  }

  return {
    ...base,
    ok: true,
    outfits,
    gap: outcome.recommendation.gap,
    diagnostics: diag,
  };
}

// ---------------------------------------------------------------- helpers ---

function toCombinable(
  kept: ReturnType<typeof filterGarments>["kept"],
  colorsById: Map<string, GarmentColor[]>,
  patternById: Map<string, string>,
): CombinableGarment[] {
  return kept.map((scored) => ({
    ...scored,
    colors: colorsById.get(scored.garment.id) ?? [],
    pattern: (patternById.get(scored.garment.id) ??
      "SOLID") as CombinableGarment["pattern"],
  }));
}

interface ResolvedWeather {
  conditions: WeatherConditions;
  description: string;
  place?: string;
  monsoonRegion: boolean;
}

async function resolveWeather(
  request: RecommendRequest,
  profileCity: string | null,
  when: Date,
): Promise<ResolvedWeather> {
  const city = request.city ?? profileCity;

  // A manual override always wins — it exists for travel and bad forecasts.
  if (
    request.weather?.temperatureC !== undefined &&
    request.weather.humidity !== undefined
  ) {
    return {
      conditions: {
        temperatureC: request.weather.temperatureC,
        humidity: request.weather.humidity,
        precipitationChance: request.weather.precipitationChance ?? 0,
        windKph: request.weather.windKph,
        indoor: request.indoorOutdoor === "indoor",
      },
      description: "as you described",
      place: city ?? undefined,
      monsoonRegion: false,
    };
  }

  if (city) {
    const forecast = await forecastForCity(city, when).catch(() => null);
    if (forecast) {
      return {
        conditions: {
          temperatureC: forecast.temperatureC,
          humidity: forecast.humidity,
          precipitationChance: forecast.precipitationChance,
          windKph: forecast.windKph,
          indoor: request.indoorOutdoor === "indoor",
        },
        description: forecast.description,
        place: forecast.place,
        monsoonRegion: /India|Bangladesh|Pakistan|Sri Lanka/i.test(forecast.place),
      };
    }
  }

  // No city and no override: temperate defaults, clearly labelled as a guess.
  return {
    conditions: {
      temperatureC: 20,
      humidity: 55,
      precipitationChance: 10,
      indoor: request.indoorOutdoor === "indoor",
    },
    description: "unknown — set your city for a real forecast",
    monsoonRegion: false,
  };
}

function gapFromMissingSlots(missing: string[]): Recommendation["gap"] {
  if (!missing.length) return null;
  const item = missing[0] === "footwear" ? "a pair of shoes" : `a ${missing[0]}`;
  return {
    item,
    why: `Nothing in your wardrobe fills the ${missing.join(" or ")} slot for this occasion, so no complete outfit can be built.`,
  };
}

function diagnostics(
  wardrobeSize: number,
  filtered: ReturnType<typeof filterGarments>,
  built: ReturnType<typeof buildCombinations>,
  candidatesSent: number,
  latencyMs: number,
  costUsd = 0,
) {
  return {
    wardrobeSize,
    passedFilter: filtered.kept.length,
    combinationsGenerated: built.generated,
    candidatesSent,
    missingSlots: built.missingSlots,
    rejected: Object.fromEntries(filtered.rejected),
    latencyMs,
    costUsd,
  };
}

async function persistOutfits(
  outfits: OutfitSuggestion[],
  request: RecommendRequest,
  occasion: OccasionRule,
  weather: ResolvedWeather,
  relaxed: Relaxation[],
) {
  for (const outfit of outfits) {
    const created = await prisma.outfit.create({
      data: {
        userId: env.DEFAULT_USER_ID,
        name: outfit.title,
        occasion: request.occasion,
        weatherSnapshot: {
          ...weather.conditions,
          description: weather.description,
          place: weather.place ?? null,
        },
        reasoning: outfit.reasoning,
        stylingTips: outfit.stylingTips,
        confidence: outfit.confidence,
        isWildcard: outfit.wildcard,
        relaxedConstraints: relaxed,
        source: "AI_SUGGESTED",
        garments: {
          create: outfit.garments.map((garment) => ({
            garmentId: garment.id,
            role: garment.category.toLowerCase(),
          })),
        },
      },
      select: { id: true },
    });
    outfit.outfitId = created.id;
  }
  void occasion;
}

function daysSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / 86_400_000;
}

function timeOfDayFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}
