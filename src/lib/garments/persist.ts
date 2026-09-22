import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  FALLBACKS,
  type ExtractedGarment,
  type GarmentEdit,
} from "@/lib/garments/attributes";
import { normalizeExtractedGarment } from "@/lib/garments/normalize";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/** Plain tees and jeans are exempt from the wear-recency filter in Stage A. */
const BASIC_HINTS = [
  "t-shirt",
  "tee",
  "jeans",
  "chinos",
  "vest",
  "socks",
  "plain shirt",
];

function looksBasic(subcategory: string): boolean {
  const lower = subcategory.toLowerCase();
  return BASIC_HINTS.some((hint) => lower.includes(hint));
}

export interface CreateFromExtractionInput {
  item: ExtractedGarment;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  notes?: string | null;
}

/**
 * Turns one extracted item into a Garment row. Nulls the model returned become
 * conservative defaults so the row is valid, but the item stays
 * `userVerified: false` until a human has looked at it.
 */
export async function createGarmentFromExtraction(
  input: CreateFromExtractionInput,
) {
  // Physical facts the model gets wrong are corrected before they reach the DB.
  const item = normalizeExtractedGarment(input.item);

  return prisma.garment.create({
    data: {
      userId: env.DEFAULT_USER_ID,
      imageUrl: input.imageUrl ?? null,
      thumbnailUrl: input.thumbnailUrl ?? null,
      category: item.category,
      subcategory: item.subcategory,
      colors: item.colors as unknown as Prisma.InputJsonValue,
      pattern: item.pattern ?? FALLBACKS.pattern,
      materials: item.materials,
      formality: item.formality ?? FALLBACKS.formality,
      warmth: item.warmth ?? FALLBACKS.warmth,
      seasons: item.seasons.length ? item.seasons : [...FALLBACKS.seasons],
      fit: item.fit ?? FALLBACKS.fit,
      styleTags: item.styleTags,
      culturalContext: item.culturalContext,
      notes: input.notes ?? null,
      isBasic: looksBasic(item.subcategory),
      aiConfidence: item.confidence,
      fieldConfidence: item.fieldConfidence as unknown as Prisma.InputJsonValue,
      userVerified: false,
    },
  });
}

/** Applies a review-screen edit. Any edit means a human has seen the item. */
export async function applyGarmentEdit(id: string, edit: GarmentEdit) {
  const data: Prisma.GarmentUpdateInput = { userVerified: true };

  if (edit.category !== undefined) data.category = edit.category;
  if (edit.subcategory !== undefined) data.subcategory = edit.subcategory;
  if (edit.colors !== undefined) {
    data.colors = edit.colors as unknown as Prisma.InputJsonValue;
  }
  if (edit.pattern !== undefined) data.pattern = edit.pattern;
  if (edit.materials !== undefined) data.materials = edit.materials;
  if (edit.formality !== undefined) data.formality = edit.formality;
  if (edit.warmth !== undefined) data.warmth = edit.warmth;
  if (edit.seasons !== undefined) data.seasons = edit.seasons;
  if (edit.fit !== undefined) data.fit = edit.fit;
  if (edit.styleTags !== undefined) data.styleTags = edit.styleTags;
  if (edit.culturalContext !== undefined) {
    data.culturalContext = edit.culturalContext;
  }
  if (edit.brand !== undefined) data.brand = edit.brand;
  if (edit.notes !== undefined) data.notes = edit.notes;
  if (edit.isFavorite !== undefined) data.isFavorite = edit.isFavorite;
  if (edit.isBasic !== undefined) data.isBasic = edit.isBasic;
  if (edit.status !== undefined) data.status = edit.status;

  return prisma.garment.update({ where: { id }, data });
}
