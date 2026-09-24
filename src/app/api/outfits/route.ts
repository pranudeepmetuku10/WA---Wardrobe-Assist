import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/** GET /api/outfits?worn=true — outfit history and saved looks. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const worn = params.get("worn");

  const outfits = await prisma.outfit.findMany({
    where: {
      userId: env.DEFAULT_USER_ID,
      ...(worn === "true" ? { wornAt: { not: null } } : {}),
    },
    include: { garments: { include: { garment: true } } },
    orderBy: [{ wornAt: "desc" }, { createdAt: "desc" }],
    take: Math.min(Number(params.get("limit") ?? 50), 200),
  });

  return Response.json({ ok: true, count: outfits.length, outfits });
}
