import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const BodySchema = z.object({ ids: z.array(z.string()).min(1).max(200) });

/** Bulk-accept — the one-tap path on the review screen. */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "body must be { ids: string[] }" },
      { status: 400 },
    );
  }

  const result = await prisma.garment.updateMany({
    where: { id: { in: parsed.data.ids }, userId: env.DEFAULT_USER_ID },
    data: { userVerified: true },
  });

  return Response.json({ ok: true, verified: result.count });
}
