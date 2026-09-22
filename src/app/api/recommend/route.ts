import { z } from "zod";

import { recommend } from "@/lib/recommend/pipeline";

const BodySchema = z.object({
  occasion: z.string().min(1).max(120),
  city: z.string().max(80).optional(),
  when: z.coerce.date().optional(),
  timeOfDay: z.string().max(30).optional(),
  indoorOutdoor: z.enum(["indoor", "outdoor", "mixed"]).optional(),
  weather: z
    .object({
      temperatureC: z.number().min(-60).max(60),
      humidity: z.number().min(0).max(100),
      precipitationChance: z.number().min(0).max(100).optional(),
      windKph: z.number().min(0).max(300).optional(),
    })
    .optional(),
  userRequest: z.string().max(300).optional(),
  persist: z.boolean().optional(),
});

/**
 * POST /api/recommend
 *   { "occasion": "date night", "weather": { "temperatureC": 32, "humidity": 80 } }
 */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await recommend(parsed.data);
    return Response.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[recommend] failed:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
