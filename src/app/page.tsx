import Link from "next/link";

import { TodayScreen } from "@/components/TodayScreen";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/** Home is Today: pick an occasion, get three outfits. */
export default async function Home() {
  const [profile, wardrobeSize] = await Promise.all([
    prisma.styleProfile.findUnique({
      where: { userId: env.DEFAULT_USER_ID },
      select: { homeCity: true },
    }),
    prisma.garment.count({
      where: { userId: env.DEFAULT_USER_ID, status: "AVAILABLE" },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Today
        </h1>
        <p className="mt-1 text-sm text-muted">
          {wardrobeSize > 0
            ? `${wardrobeSize} things available to wear.`
            : "Your wardrobe is empty — add a few things first."}
        </p>
      </header>

      {wardrobeSize === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-sm">Nothing to suggest from yet.</p>
          <Link
            href="/add"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground"
          >
            Add your clothes
          </Link>
        </div>
      ) : (
        <TodayScreen initialCity={profile?.homeCity ?? null} />
      )}
    </main>
  );
}
