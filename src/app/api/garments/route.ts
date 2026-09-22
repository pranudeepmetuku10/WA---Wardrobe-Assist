import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  CATEGORIES,
  ColorSchema,
  FALLBACKS,
  FITS,
  GARMENT_STATUSES,
  MATERIALS,
  PATTERNS,
  SEASONS,
} from "@/lib/garments/attributes";

/** GET /api/garments?verified=false&status=AVAILABLE&category=TOP&q=linen */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const where: Prisma.GarmentWhereInput = { userId: env.DEFAULT_USER_ID };

  const verified = params.get("verified");
  if (verified === "true" || verified === "false") {
    where.userVerified = verified === "true";
  }

  const status = params.get("status");
  if (status && (GARMENT_STATUSES as readonly string[]).includes(status)) {
    where.status = status as (typeof GARMENT_STATUSES)[number];
  }

  const category = params.get("category");
  if (category && (CATEGORIES as readonly string[]).includes(category)) {
    where.category = category as (typeof CATEGORIES)[number];
  }

  const q = params.get("q");
  if (q) {
    where.OR = [
      { subcategory: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { styleTags: { has: q.toLowerCase() } },
    ];
  }

  const garments = await prisma.garment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(params.get("limit") ?? 200), 500),
  });

  return Response.json({ ok: true, count: garments.length, garments });
}

/** Manual entry — used when extraction failed or the user skips the model. */
const CreateSchema = z.object({
  category: z.enum(CATEGORIES),
  subcategory: z.string().min(1).max(80),
  colors: z.array(ColorSchema).min(1).max(4),
  pattern: z.enum(PATTERNS).default(FALLBACKS.pattern),
  materials: z.array(z.enum(MATERIALS)).max(4).default([]),
  formality: z.number().int().min(1).max(5).default(FALLBACKS.formality),
  warmth: z.number().int().min(1).max(5).default(FALLBACKS.warmth),
  seasons: z.array(z.enum(SEASONS)).max(6).default([...FALLBACKS.seasons]),
  fit: z.enum(FITS).default(FALLBACKS.fit),
  styleTags: z.array(z.string()).max(8).default([]),
  culturalContext: z.string().max(80).nullable().default(null),
  brand: z.string().max(60).nullable().default(null),
  notes: z.string().max(400).nullable().default(null),
  imageUrl: z.string().nullable().default(null),
  thumbnailUrl: z.string().nullable().default(null),
  isBasic: z.boolean().default(false),
});

export async function POST(request: Request) {
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "invalid garment", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { colors, ...rest } = parsed.data;
  const garment = await prisma.garment.create({
    data: {
      ...rest,
      colors: colors as unknown as Prisma.InputJsonValue,
      userId: env.DEFAULT_USER_ID,
      // Typed by hand, so it is verified by definition.
      userVerified: true,
    },
  });

  return Response.json({ ok: true, garment }, { status: 201 });
}
