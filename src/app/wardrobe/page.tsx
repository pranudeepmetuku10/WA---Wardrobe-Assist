import Link from "next/link";

import { WardrobeGrid, type WardrobeItem } from "@/components/WardrobeGrid";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { GarmentColor } from "@/lib/garments/attributes";

/**
 * Reads your garments on every request. Without this Next prerenders the page at
 * build time and serves stale data until the next deploy.
 */
export const dynamic = "force-dynamic";


export default async function WardrobePage() {
  const rows = await prisma.garment.findMany({
    where: { userId: env.DEFAULT_USER_ID },
    orderBy: [{ isFavorite: "desc" }, { createdAt: "desc" }],
  });

  const items: WardrobeItem[] = rows.map((row) => ({
    id: row.id,
    thumbnailUrl: row.thumbnailUrl,
    imageUrl: row.imageUrl,
    category: row.category,
    subcategory: row.subcategory,
    colors: (row.colors ?? []) as unknown as GarmentColor[],
    pattern: row.pattern,
    materials: row.materials,
    formality: row.formality,
    warmth: row.warmth,
    seasons: row.seasons,
    fit: row.fit,
    styleTags: row.styleTags,
    aiConfidence: row.aiConfidence,
    userVerified: row.userVerified,
    status: row.status,
    wearCount: row.wearCount,
    lastWornAt: row.lastWornAt?.toISOString() ?? null,
    isFavorite: row.isFavorite,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Wardrobe
          </h1>
          <p className="mt-1 text-sm text-muted">{items.length} items</p>
        </div>
        <Link
          href="/add"
          className="flex-none rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
        >
          Add
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Nothing here yet.
        </p>
      ) : (
        <WardrobeGrid initialItems={items} />
      )}
    </main>
  );
}
