import { z } from "zod";

import { extractGarments } from "@/lib/ai/extract";
import { createGarmentFromExtraction } from "@/lib/garments/persist";

const BodySchema = z.object({
  description: z.string().min(3).max(400),
});

/** Text-only entry: "navy linen blazer, Zara, slim fit" — same schema, no image. */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "body must be { description: string }" },
      { status: 400 },
    );
  }

  const outcome = await extractGarments({
    description: parsed.data.description,
  });

  if (!outcome.result) {
    return Response.json(
      { ok: false, needsManualEntry: true, error: outcome.error },
      { status: 200 },
    );
  }

  const garments = [];
  for (const item of outcome.result.items) {
    garments.push(
      await createGarmentFromExtraction({ item, notes: parsed.data.description }),
    );
  }

  return Response.json({
    ok: true,
    garments,
    latencyMs: outcome.latencyMs,
    attempts: outcome.attempts,
  });
}
