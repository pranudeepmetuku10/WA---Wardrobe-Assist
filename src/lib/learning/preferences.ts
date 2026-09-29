import { z } from "zod";

/**
 * The shape of what the app infers about your taste, plus the deterministic
 * clean-up applied to it.
 *
 * Kept free of server-only imports so it can be unit tested directly — the
 * orchestration that reads the database lives in `src/lib/ai/learn.ts`.
 */

export const LearnedPreferencesSchema = z.object({
  summary: z
    .string()
    .describe("Two or three plain sentences the person will read and edit"),
  colorsGravitatedTo: z.array(z.string()).max(6),
  colorsAvoidedInPractice: z.array(z.string()).max(6),
  combinationsRejected: z.array(z.string()).max(5),
  formalityByOccasion: z
    .array(z.object({ occasion: z.string(), observation: z.string() }))
    .max(6),
  neverWorn: z.array(z.string()).max(8),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How much the log actually supports these claims"),
});
export type LearnedPreferences = z.infer<typeof LearnedPreferencesSchema>;

/** Feedback events needed before a claim can be fully trusted. */
const CONFIDENCE_SATURATION = 40;

/**
 * Placeholders a model reaches for when it has nothing to say. They read as
 * findings in the UI, so they are stripped rather than shown.
 */
const EMPTY_ANSWERS = new Set([
  "unknown",
  "none",
  "n/a",
  "na",
  "not enough data",
  "all",
  "all available",
  "all colors",
  "all colours",
  "everything",
  "nothing",
]);

function stripPlaceholders(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && !EMPTY_ANSWERS.has(value.toLowerCase()));
}

/**
 * The model reported 0.95 confidence from eight events while saying nothing
 * substantive. Self-reported confidence is not calibrated to sample size, so
 * the sample size caps it here — this number is shown to the user as a reason
 * to trust or ignore the rest.
 */
export function calibrateConfidence(
  reported: number,
  eventCount: number,
): number {
  const evidenceCeiling = Math.min(1, eventCount / CONFIDENCE_SATURATION);
  return Number(Math.min(reported, evidenceCeiling).toFixed(2));
}

/** Deterministic clean-up of one learned-preferences payload. */
export function tidyPreferences(
  preferences: LearnedPreferences,
  eventCount: number,
): LearnedPreferences {
  return {
    ...preferences,
    colorsGravitatedTo: stripPlaceholders(preferences.colorsGravitatedTo),
    colorsAvoidedInPractice: stripPlaceholders(preferences.colorsAvoidedInPractice),
    combinationsRejected: stripPlaceholders(preferences.combinationsRejected),
    neverWorn: stripPlaceholders(preferences.neverWorn),
    confidence: calibrateConfidence(preferences.confidence, eventCount),
  };
}

