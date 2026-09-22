import "server-only";

import { z } from "zod";

import { callModel } from "@/lib/ai/call";
import type { AiMessage } from "@/lib/ai/types";
import type { Combination } from "@/lib/rules/combine";
import type { CombinableGarment } from "@/lib/rules/combine";
import type { OccasionRule } from "@/lib/rules/occasions";
import type { WeatherConditions } from "@/lib/rules/weather";

/**
 * Stage B: the model ranks and explains pre-validated outfits. It never
 * assembles one.
 *
 * Candidates are referenced by short ids (c1, c2, ...) rather than database
 * cuids. That is both far cheaper in tokens and far harder to hallucinate — a
 * made-up "c99" is caught by a set lookup, where a plausible-looking cuid
 * might not be.
 */

const SYSTEM_PROMPT = `You are a personal stylist choosing what someone should wear today from clothes they already own.

You are given a numbered list of complete, pre-validated outfits. Every one already fits the weather, the occasion and the person's wardrobe rules.

Your job:
1. Choose the best three, ranked. Refer to them ONLY by their candidate id (c1, c2, ...). Never invent an id and never describe a garment that is not in the outfit you picked.
2. For each, write two or three sentences of reasoning that mention the actual weather and occasion. Be specific: "34C and humid, so the linen breathes" beats "this is a great summer look".
3. Give one or two concrete styling tips — roll the sleeves, tuck the shirt, swap the belt.
4. You may mark ONE pick as a wildcard if it is bolder than this person's usual taste. Only if it genuinely is.
5. If the wardrobe is weak for this occasion, say so plainly in "gap" and name the single item that would unlock the most new outfits. Otherwise set gap to null.

Write like a person talking to a friend. No filler, no hedging, no fashion cliches.`;

const PickSchema = z.object({
  candidate: z.string().describe("The candidate id, e.g. c3"),
  title: z.string().max(60).describe("Short name for the look"),
  reasoning: z
    .string()
    .describe("2-3 sentences, specific to today's weather and occasion"),
  stylingTips: z.array(z.string()).max(3),
  confidence: z.number().min(0).max(1),
  wildcard: z.boolean(),
});

export const RecommendationSchema = z.object({
  picks: z.array(PickSchema).min(1).max(3),
  gap: z
    .object({
      item: z.string().describe("The single item that would help most"),
      why: z.string(),
    })
    .nullable(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export interface RecommendContext {
  occasion: OccasionRule;
  occasionText: string;
  weather: WeatherConditions;
  weatherDescription: string;
  place?: string;
  timeOfDay: string;
  indoorOutdoor: "indoor" | "outdoor" | "mixed";
  /** Free-text override: "same as yesterday but dressier". */
  userRequest?: string;
  styleProfile?: {
    colorsLoved: string[];
    colorsToAvoid: string[];
    neverPair: unknown;
    dressCodeNotes?: string | null;
    freeformPreferences?: string | null;
    learnedPreferences?: unknown;
  };
  recentlyWorn?: string[];
  relaxed?: string[];
}

export interface RecommendInput {
  combinations: Combination[];
  garments: Map<string, CombinableGarment>;
  context: RecommendContext;
}

export interface RecommendOutcome {
  recommendation: Recommendation | null;
  /** Candidate id -> combination, for mapping picks back to garments. */
  candidateMap: Map<string, Combination>;
  attempts: number;
  latencyMs: number;
  costUsd: number;
  error?: string;
}

export async function recommendOutfits(
  input: RecommendInput,
): Promise<RecommendOutcome> {
  const candidateMap = new Map<string, Combination>();
  input.combinations.forEach((combination, index) => {
    candidateMap.set(`c${index + 1}`, combination);
  });

  const prompt = buildPrompt(input, candidateMap);
  const messages: AiMessage[] = [{ role: "user", content: [{ type: "text", text: prompt }] }];

  let attempts = 0;
  let latencyMs = 0;
  let costUsd = 0;
  let lastError: string | undefined;

  for (let pass = 0; pass < 2; pass += 1) {
    attempts += 1;
    try {
      const result = await callModel({
        task: "recommend_outfits",
        system: SYSTEM_PROMPT,
        cacheSystem: true,
        schema: RecommendationSchema,
        messages:
          pass === 0
            ? messages
            : [
                ...messages,
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `Your previous answer was rejected: ${lastError}. Use only the candidate ids listed above.`,
                    },
                  ],
                },
              ],
        maxAttempts: 1,
        meta: {
          candidates: input.combinations.length,
          occasion: input.context.occasion.id,
        },
      });

      latencyMs += result.latencyMs;
      costUsd += result.costUsd;

      if (!result.data) {
        lastError = "empty response";
        continue;
      }

      // The hard guarantee: every pick must reference a supplied candidate.
      const unknown = result.data.picks
        .map((pick) => pick.candidate)
        .filter((id) => !candidateMap.has(id));
      if (unknown.length) {
        lastError = `unknown candidate id(s): ${unknown.join(", ")}`;
        continue;
      }

      // Duplicate picks are a ranking failure, not a hallucination — dedupe.
      const seen = new Set<string>();
      const picks = result.data.picks.filter((pick) => {
        if (seen.has(pick.candidate)) return false;
        seen.add(pick.candidate);
        return true;
      });

      return {
        recommendation: { ...result.data, picks },
        candidateMap,
        attempts,
        latencyMs,
        costUsd,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    recommendation: null,
    candidateMap,
    attempts,
    latencyMs,
    costUsd,
    error: lastError ?? "recommendation failed",
  };
}

function buildPrompt(
  input: RecommendInput,
  candidateMap: Map<string, Combination>,
): string {
  const { context, garments } = input;
  const lines: string[] = [];

  lines.push(`OCCASION: ${context.occasionText} (${context.occasion.label})`);
  if (context.occasion.note) lines.push(`Occasion note: ${context.occasion.note}`);
  lines.push(
    `WEATHER: ${Math.round(context.weather.temperatureC)}C, ${context.weatherDescription}, humidity ${Math.round(context.weather.humidity)}%, rain chance ${Math.round(context.weather.precipitationChance)}%${
      context.place ? ` in ${context.place}` : ""
    }`,
  );
  lines.push(`TIME: ${context.timeOfDay}, mostly ${context.indoorOutdoor}`);

  if (context.userRequest) {
    lines.push(`THE PERSON ALSO ASKED: "${context.userRequest}"`);
  }

  const profile = context.styleProfile;
  if (profile) {
    const bits: string[] = [];
    if (profile.colorsLoved.length) bits.push(`loves ${profile.colorsLoved.join(", ")}`);
    if (profile.colorsToAvoid.length) bits.push(`avoids ${profile.colorsToAvoid.join(", ")}`);
    if (profile.dressCodeNotes) bits.push(profile.dressCodeNotes);
    if (profile.freeformPreferences) bits.push(profile.freeformPreferences);
    if (bits.length) lines.push(`STYLE PROFILE: ${bits.join("; ")}`);

    const neverPair = Array.isArray(profile.neverPair) ? profile.neverPair : [];
    if (neverPair.length) {
      lines.push(`HARD RULES (never break): ${JSON.stringify(neverPair)}`);
    }
    if (profile.learnedPreferences) {
      lines.push(`LEARNED PREFERENCES: ${JSON.stringify(profile.learnedPreferences)}`);
    }
  }

  if (context.recentlyWorn?.length) {
    lines.push(`WORN IN THE LAST FEW DAYS: ${context.recentlyWorn.join(", ")}`);
  }
  if (context.relaxed?.length) {
    lines.push(
      `NOTE: the wardrobe was thin today, so these constraints were relaxed: ${context.relaxed.join(", ")}.`,
    );
  }

  lines.push("", "CANDIDATE OUTFITS:");
  for (const [id, combination] of candidateMap) {
    const parts = combination.garmentIds
      .map((garmentId) => describe(garments.get(garmentId)))
      .filter(Boolean)
      .join(" + ");
    lines.push(`${id}: ${parts}`);
  }

  lines.push(
    "",
    "Pick the best three by candidate id, ranked best first.",
  );

  return lines.join("\n");
}

/** One compact line per garment — every token here is paid 40 times over. */
function describe(entry: CombinableGarment | undefined): string {
  if (!entry) return "";
  const g = entry.garment;
  const colour = entry.colors[0]?.name ?? "";
  const pattern = entry.pattern === "SOLID" ? "" : ` ${entry.pattern.toLowerCase()}`;
  const material = g.materials[0] ? ` ${g.materials[0].toLowerCase()}` : "";
  return `${colour}${material}${pattern} ${g.subcategory}`.trim();
}
