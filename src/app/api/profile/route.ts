import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

async function ensureProfile() {
  return prisma.styleProfile.upsert({
    where: { userId: env.DEFAULT_USER_ID },
    create: { userId: env.DEFAULT_USER_ID },
    update: {},
  });
}

export async function GET() {
  return Response.json({ ok: true, profile: await ensureProfile() });
}

const PatchSchema = z.object({
  homeCity: z.string().max(80).nullable().optional(),
  timezone: z.string().max(60).nullable().optional(),
  units: z.enum(["metric", "imperial"]).optional(),
  bodyNotes: z.string().max(600).nullable().optional(),
  colorsLoved: z.array(z.string().max(30)).max(20).optional(),
  colorsToAvoid: z.array(z.string().max(30)).max(20).optional(),
  neverPair: z
    .array(z.object({ a: z.string().max(60), b: z.string().max(60) }))
    .max(20)
    .optional(),
  dressCodeNotes: z.string().max(600).nullable().optional(),
  freeformPreferences: z.string().max(1000).nullable().optional(),
  /** Learned preferences are editable — the user corrects what was inferred. */
  learnedPreferences: z.unknown().optional(),
  wearRecencyDays: z.number().int().min(0).max(60).optional(),
});

export async function PATCH(request: Request) {
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "invalid profile", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  await ensureProfile();
  const profile = await prisma.styleProfile.update({
    where: { userId: env.DEFAULT_USER_ID },
    data: parsed.data as never,
  });

  return Response.json({ ok: true, profile });
}
