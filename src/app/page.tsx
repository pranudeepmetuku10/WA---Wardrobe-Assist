import Link from "next/link";

/**
 * Placeholder home screen. Phase 3 replaces this with the Today screen
 * (occasion chips, weather, "Suggest outfits").
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col gap-6 px-5 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Wardrobe</h1>
        <p className="text-sm text-muted">
          Outfits from the clothes you already own.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium">Phase 0 — scaffold</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>Postgres schema, storage adapter, and Claude wrapper are in place.</li>
          <li>Ingestion, the recommendation engine, and the UI come next.</li>
        </ul>
        <Link
          href="/api/smoke"
          className="mt-5 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground"
        >
          Run the Claude smoke test
        </Link>
      </section>
    </main>
  );
}
