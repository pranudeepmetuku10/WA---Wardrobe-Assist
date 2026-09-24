import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const BodySchema = z.object({
  action: z.enum(["worn", "skipped", "rated"]),
  rating: z.number().int().min(1).max(5).optional(),
  note: z.string().max(400).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * Every wear, skip and rating lands here — this is the raw material the
 * learning loop reads in Phase 4, so it records the event even when it also
 * updates the garments.
 */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "invalid feedback", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const outfit = await prisma.outfit.findFirst({
    where: { id, userId: env.DEFAULT_USER_ID },
    include: { garments: true },
  });
  if (!outfit) return Response.json({ ok: false }, { status: 404 });

  const { action, rating, note } = parsed.data;
  const garmentIds = outfit.garments.map((g) => g.garmentId);
  const now = new Date();

  if (action === "worn") {
    // Wearing an outfit is what makes the recency filter mean anything.
    await prisma.$transaction([
      prisma.outfit.update({ where: { id }, data: { wornAt: now } }),
      prisma.garment.updateMany({
        where: { id: { in: garmentIds } },
        data: { lastWornAt: now, wearCount: { increment: 1 } },
      }),
    ]);
  }

  if (action === "rated" && rating !== undefined) {
    await prisma.outfit.update({
      where: { id },
      data: { rating, feedbackNote: note ?? null },
    });
  }

  await prisma.feedbackEvent.create({
    data: {
      userId: env.DEFAULT_USER_ID,
      type: action === "worn" ? "WORN" : action === "skipped" ? "SKIPPED" : "RATED",
      outfitId: id,
      garmentIds,
      occasion: outfit.occasion,
      rating: rating ?? null,
      note: note ?? null,
    },
  });

  return Response.json({ ok: true });
}
