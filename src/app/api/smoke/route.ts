import { z } from "zod";

import { callClaude } from "@/lib/claude/call";
import { formatUsd } from "@/lib/claude/pricing";
import { ClaudeCallError } from "@/lib/claude/types";
import { prisma } from "@/lib/db";

/**
 * Phase 0 acceptance check: proves the API key works, the wrapper produces
 * schema-valid output, and a ModelCall row lands in Postgres.
 *
 *   curl -s localhost:3000/api/smoke | jq
 */
const SmokeSchema = z.object({
  greeting: z.string().describe("A one-sentence hello from the wardrobe assistant"),
  garment: z.string().describe("Any single garment you would recommend for 32C humid weather"),
});

export async function GET() {
  try {
    const result = await callClaude({
      task: "smoke",
      schema: SmokeSchema,
      schemaName: "smoke_check",
      system: "You are a wardrobe assistant. Answer briefly.",
      messages: [
        {
          role: "user",
          content: "Say hello and name one garment good for hot, humid weather.",
        },
      ],
      meta: { source: "GET /api/smoke" },
    });

    const modelCall = result.modelCallId
      ? await prisma.modelCall.findUnique({ where: { id: result.modelCallId } })
      : null;

    return Response.json({
      ok: true,
      response: result.data,
      model: result.model,
      usage: result.usage,
      cost: formatUsd(result.costUsd),
      latencyMs: result.latencyMs,
      attempts: result.attempts,
      modelCallLogged: Boolean(modelCall),
      modelCallId: result.modelCallId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof ClaudeCallError ? 502 : 500;
    console.error("[smoke] failed:", message);
    return Response.json({ ok: false, error: message }, { status });
  }
}
