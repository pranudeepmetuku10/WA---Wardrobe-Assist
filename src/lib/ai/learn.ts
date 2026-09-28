import "server-only";

import { z } from "zod";

import { callModel } from "@/lib/ai/call";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Turns the wear log into a picture of the person's taste.
 *
 * Everything here is shown back to them as editable text in the Style screen.
 * Inferred preferences that quietly steer suggestions are worse than useless —
 * the point is that they can see what the app believes and correct it.
 */

const SYSTEM_PROMPT = `You study what someone actually wears and infer their taste.

You receive a log of outfits they were offered: which they wore, which they skipped, and how they rated them.

Return honest observations only. Rules:
- Base every claim on the log. If the evidence is thin, say so in "confidence" and keep the claim vague rather than inventing a pattern.
- "worn" is a weak signal on its own; a high rating or a repeated choice is a strong one. A single skip means almost nothing.
- Write "summary" as two or three plain sentences addressed to the person ("You reach for..."). This is shown to them directly, so no jargon and no flattery.
- Prefer specific nouns from the log over general fashion language.`;

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

export interface LearnOutcome {
  preferences: LearnedPreferences | null;
  eventsConsidered: number;
  latencyMs: number;
  costUsd: number;
  error?: string;
}

/** Not enough signal below this to say anything honest. */
const MIN_EVENTS = 5;
const EVENT_WINDOW = 50;

export async function refreshLearnedPreferences(): Promise<LearnOutcome> {
  const events = await prisma.feedbackEvent.findMany({
    where: { userId: env.DEFAULT_USER_ID },
    orderBy: { createdAt: "desc" },
    take: EVENT_WINDOW,
    include: { outfit: { include: { garments: { include: { garment: true } } } } },
  });

  if (events.length < MIN_EVENTS) {
    return {
      preferences: null,
      eventsConsidered: events.length,
      latencyMs: 0,
      costUsd: 0,
      error: `Only ${events.length} pieces of feedback so far — wear and rate a few more outfits first.`,
    };
  }

  const garments = await prisma.garment.findMany({
    where: { userId: env.DEFAULT_USER_ID },
    select: { subcategory: true, wearCount: true, createdAt: true },
  });

  const neverWorn = garments
    .filter((g) => g.wearCount === 0)
    .map((g) => g.subcategory);

  const log = events
    .map((event) => {
      const items =
        event.outfit?.garments.map((g) => g.garment.subcategory).join(" + ") ??
        "unknown outfit";
      const verdict =
        event.type === "WORN"
          ? "WORE"
          : event.type === "SKIPPED"
            ? "skipped"
            : `rated ${event.rating ?? "?"}/5`;
      return `- [${event.occasion ?? "any"}] ${verdict}: ${items}${
        event.note ? ` (note: ${event.note})` : ""
      }`;
    })
    .join("\n");

  const prompt = [
    `FEEDBACK LOG (most recent first, ${events.length} entries):`,
    log,
    "",
    neverWorn.length
      ? `NEVER WORN (owned but never chosen): ${neverWorn.join(", ")}`
      : "Everything owned has been worn at least once.",
    "",
    "What does this say about how they dress?",
  ].join("\n");

  const result = await callModel({
    task: "learn_preferences",
    system: SYSTEM_PROMPT,
    cacheSystem: true,
    schema: LearnedPreferencesSchema,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    meta: { events: events.length },
  }).catch((error) => ({ error }) as const);

  if ("error" in result) {
    return {
      preferences: null,
      eventsConsidered: events.length,
      latencyMs: 0,
      costUsd: 0,
      error:
        result.error instanceof Error
          ? result.error.message
          : String(result.error),
    };
  }

  if (result.data) {
    await prisma.styleProfile.update({
      where: { userId: env.DEFAULT_USER_ID },
      data: {
        learnedPreferences: result.data as never,
        learnedPreferencesUpdated: new Date(),
      },
    });
  }

  return {
    preferences: result.data,
    eventsConsidered: events.length,
    latencyMs: result.latencyMs,
    costUsd: result.costUsd,
  };
}
