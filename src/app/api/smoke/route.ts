import { z } from "zod";

import { callModel } from "@/lib/ai/call";
import { formatUsd } from "@/lib/ai/pricing";
import { AiCallError } from "@/lib/ai/types";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Phase 0 acceptance check: proves the configured provider works, the wrapper
 * produces schema-valid output, and a ModelCall row lands in Postgres.
 *
 *   curl -s localhost:3000/api/smoke | jq
 *   curl -s "localhost:3000/api/smoke?provider=anthropic" | jq
 */
const SmokeSchema = z.object({
  greeting: z.string().describe("A one-sentence hello from the wardrobe assistant"),
  garment: z.string().describe("One garment suited to 32C humid weather"),
});

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("provider");
  const provider =
    requested === "anthropic" || requested === "ollama" ? requested : undefined;

  try {
    const result = await callModel({
      task: "smoke",
      provider,
      schema: SmokeSchema,
      system: "You are a wardrobe assistant. Answer briefly.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Say hello and name one garment good for hot, humid weather.",
            },
          ],
        },
      ],
      meta: { source: "GET /api/smoke" },
    });

    const logged = result.modelCallId
      ? await prisma.modelCall.findUnique({ where: { id: result.modelCallId } })
      : null;

    return Response.json({
      ok: true,
      provider: result.provider,
      model: result.model,
      response: result.data,
      usage: result.usage,
      cost: formatUsd(result.costUsd),
      latencyMs: result.latencyMs,
      attempts: result.attempts,
      modelCallLogged: Boolean(logged),
      modelCallId: result.modelCallId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof AiCallError ? 502 : 500;
    console.error("[smoke] failed:", message);
    return Response.json(
      { ok: false, provider: provider ?? env.AI_PROVIDER, error: message },
      { status },
    );
  }
}
