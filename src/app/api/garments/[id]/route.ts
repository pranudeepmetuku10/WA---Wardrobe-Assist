import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { GarmentEditSchema } from "@/lib/garments/attributes";
import { applyGarmentEdit } from "@/lib/garments/persist";
import { storage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garment = await prisma.garment.findFirst({
    where: { id, userId: env.DEFAULT_USER_ID },
  });
  if (!garment) return Response.json({ ok: false }, { status: 404 });
  return Response.json({ ok: true, garment });
}

/** Inline edit from the review screen. Any edit flips userVerified to true. */
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const existing = await prisma.garment.findFirst({
    where: { id, userId: env.DEFAULT_USER_ID },
    select: { id: true },
  });
  if (!existing) return Response.json({ ok: false }, { status: 404 });

  const parsed = GarmentEditSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "invalid edit", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const garment = await applyGarmentEdit(id, parsed.data);
  return Response.json({ ok: true, garment });
}

/** Discard a draft the model got wrong, and its image. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const garment = await prisma.garment.findFirst({
    where: { id, userId: env.DEFAULT_USER_ID },
  });
  if (!garment) return Response.json({ ok: false }, { status: 404 });

  await prisma.garment.delete({ where: { id } });

  // Only remove the file if nothing else references it (multi-item photos).
  if (garment.imageUrl) {
    const stillUsed = await prisma.garment.count({
      where: { imageUrl: garment.imageUrl },
    });
    if (stillUsed === 0) {
      const key = garment.imageUrl.replace("/api/uploads/", "");
      await storage.delete(key);
    }
  }

  return Response.json({ ok: true });
}
