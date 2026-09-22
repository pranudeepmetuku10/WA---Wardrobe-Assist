import Link from "next/link";

import { AddGarments } from "@/components/AddGarments";
import type { ReviewGarment } from "@/components/GarmentReviewCard";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { GarmentColor } from "@/lib/garments/attributes";

/** Anything already extracted but not yet confirmed resumes here. */
export default async function AddPage() {
  const rows = await prisma.garment.findMany({
    where: { userId: env.DEFAULT_USER_ID, userVerified: false },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const drafts: ReviewGarment[] = rows.map((row) => ({
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
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add clothes</h1>
          <p className="mt-1 text-sm text-muted">
            Photograph or describe what you own. Check what the app read back.
          </p>
        </div>
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          Home
        </Link>
      </header>

      <AddGarments initialDrafts={drafts} />
    </main>
  );
}
