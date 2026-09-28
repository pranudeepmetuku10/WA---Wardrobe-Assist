import { z } from "zod";

import { callModel } from "@/lib/ai/call";

/**
 * LLM-as-judge, used only by the eval harness in `evals/`.
 *
 * It lives in the app rather than the harness so judging goes through the same
 * provider and the same ModelCall logging as everything else — which is what
 * makes the cost and latency figures in the eval report real.
 *
 * Not available in production.
 */
const BodySchema = z.object({
  rubric: z.string().max(600),
  occasion: z.string().max(120),
  conditions: z.string().max(200),
  outfit: z.string().max(400),
  reasoning: z.string().max(2000),
});

const VerdictSchema = z.object({
  score: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("1 unusable, 3 acceptable, 5 exactly right"),
  verdict: z.string().max(300).describe("One sentence explaining the score"),
});

const SYSTEM_PROMPT = `You grade outfit suggestions against a rubric.

Score 1-5 on how well the suggestion and its reasoning meet the rubric:
5 - exactly right; the reasoning is specific to these conditions
4 - good, with a small weakness
3 - acceptable; nothing wrong but nothing considered
2 - poor; ignores part of the rubric
1 - unusable; contradicts the rubric or the weather

Judge the outfit and the reasoning together. Generic reasoning that would fit any
day is worth at most 3, however good the clothes are. Be strict and brief.`;

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const { rubric, occasion, conditions, outfit, reasoning } = parsed.data;

  try {
    const result = await callModel({
      task: "eval_judge",
      system: SYSTEM_PROMPT,
      cacheSystem: true,
      schema: VerdictSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `RUBRIC: ${rubric}`,
                `OCCASION: ${occasion}`,
                `CONDITIONS: ${conditions}`,
                `OUTFIT: ${outfit}`,
                `REASONING GIVEN: ${reasoning}`,
                "",
                "Score it.",
              ].join("\n"),
            },
          ],
        },
      ],
      meta: { harness: "evals" },
    });

    return Response.json({
      ok: true,
      score: result.data?.score ?? null,
      verdict: result.data?.verdict ?? "",
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
