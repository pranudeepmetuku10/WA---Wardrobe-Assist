import Link from "next/link";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

function formatDate(value: Date | null): string {
  if (!value) return "not worn";
  return value.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Outfit history and saved looks, most recently worn first. */
export default async function HistoryPage() {
  const outfits = await prisma.outfit.findMany({
    where: { userId: env.DEFAULT_USER_ID },
    include: { garments: { include: { garment: true } } },
    orderBy: [{ wornAt: "desc" }, { createdAt: "desc" }],
    take: 60,
  });

  const worn = outfits.filter((o) => o.wornAt);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          History
        </h1>
        <p className="mt-1 text-sm text-muted">
          {worn.length} worn · {outfits.length - worn.length} suggested but not worn
        </p>
      </header>

      {outfits.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted">No outfits yet.</p>
          <Link
            href="/"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground"
          >
            Get a suggestion
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {outfits.map((outfit) => (
            <li
              key={outfit.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-medium">{outfit.name ?? outfit.occasion}</h2>
                <span className="flex-none text-xs text-muted">
                  {formatDate(outfit.wornAt)}
                </span>
              </div>

              <div className="mt-3 flex gap-1.5">
                {outfit.garments.slice(0, 5).map((link) =>
                  link.garment.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={link.garmentId}
                      src={link.garment.thumbnailUrl}
                      alt={link.garment.subcategory}
                      className="h-16 w-14 rounded-lg object-cover"
                    />
                  ) : (
                    <span
                      key={link.garmentId}
                      className="flex h-16 w-14 items-center justify-center rounded-lg bg-background px-1 text-center text-[9px] leading-tight text-muted"
                    >
                      {link.garment.subcategory}
                    </span>
                  ),
                )}
              </div>

              <p className="mt-2 text-xs text-muted">
                {outfit.garments.map((g) => g.garment.subcategory).join(" · ")}
              </p>

              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                <span className="capitalize">{outfit.occasion}</span>
                {outfit.rating && (
                  <span className="text-accent">{outfit.rating}/5</span>
                )}
                {outfit.isWildcard && <span>wildcard</span>}
                {outfit.relaxedConstraints.length > 0 && (
                  <span title={outfit.relaxedConstraints.join(", ")}>
                    relaxed: {outfit.relaxedConstraints.join(", ")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
