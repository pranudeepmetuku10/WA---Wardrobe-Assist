import Link from "next/link";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  costPerWear,
  formatMoney,
  leastWorn,
  mostWorn,
  occasionCoverage,
  retireCandidates,
  summarize,
  type InsightGarment,
} from "@/lib/insights";

/**
 * Reads your garments on every request. Without this Next prerenders the page
 * at build time and serves stale data until the next deploy.
 */
export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const rows = await prisma.garment.findMany({
    where: { userId: env.DEFAULT_USER_ID },
  });

  const garments: InsightGarment[] = rows.map((row) => ({
    id: row.id,
    subcategory: row.subcategory,
    category: row.category,
    formality: row.formality,
    status: row.status,
    wearCount: row.wearCount,
    lastWornAt: row.lastWornAt,
    createdAt: row.createdAt,
    priceCents: row.priceCents,
    isFavorite: row.isFavorite,
  }));

  const now = new Date();
  const summary = summarize(garments);
  const top = mostWorn(garments);
  const bottom = leastWorn(garments);
  const value = costPerWear(garments);
  const retire = retireCandidates(garments, now);
  const coverage = occasionCoverage(garments);
  const uncovered = coverage.filter((c) => !c.covered);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Insights
          </h1>
          <p className="mt-1 text-sm text-muted">What your wardrobe is doing.</p>
        </div>
        <Link
          href="/wardrobe"
          className="flex-none text-sm text-muted underline underline-offset-4"
        >
          Wardrobe
        </Link>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Items" value={String(summary.total)} />
        <Stat label="Available" value={String(summary.available)} />
        <Stat label="Never worn" value={String(summary.neverWorn)} />
        <Stat label="Total wears" value={String(summary.totalWears)} />
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <Panel title="Worn most">
          {top.length ? (
            <ol className="space-y-1.5">
              {top.map((g) => (
                <li key={g.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{g.subcategory}</span>
                  <span className="flex-none text-muted">{g.wearCount}×</span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Nothing worn yet.</Empty>
          )}
        </Panel>

        <Panel title="Worn least">
          <ol className="space-y-1.5">
            {bottom.map((g) => (
              <li key={g.id} className="flex justify-between gap-3 text-sm">
                <span className="truncate">{g.subcategory}</span>
                <span className="flex-none text-muted">
                  {g.wearCount === 0 ? "never" : `${g.wearCount}×`}
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          title="Gaps"
          hint="Occasions this wardrobe cannot dress at all."
        >
          {uncovered.length ? (
            <ul className="space-y-2">
              {uncovered.map((c) => (
                <li key={c.occasion} className="text-sm">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-muted"> — needs {c.missing.join(" and ")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Every occasion can be dressed. Nice.</Empty>
          )}
        </Panel>

        <Panel
          title="Cost per wear"
          hint="Add prices when editing an item to see this."
        >
          {value.length ? (
            <ol className="space-y-1.5">
              {value.slice(0, 6).map((g) => (
                <li key={g.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{g.subcategory}</span>
                  <span className="flex-none text-muted">
                    {formatMoney(g.centsPerWear)}
                    <span className="text-[11px]">/wear</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>No prices entered yet.</Empty>
          )}
        </Panel>

        <Panel
          title="Worth letting go"
          hint="Owned a long time, never reached for. Favourites are never listed."
        >
          {retire.length ? (
            <ul className="space-y-1.5">
              {retire.slice(0, 8).map((g) => (
                <li key={g.id} className="text-sm">
                  <span>{g.subcategory}</span>
                  <span className="text-muted"> — {g.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing has been sitting unworn long enough.</Empty>
          )}
        </Panel>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {hint && <p className="mt-0.5 mb-3 text-xs text-muted">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
