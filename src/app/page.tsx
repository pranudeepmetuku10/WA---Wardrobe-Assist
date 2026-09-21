import Link from "next/link";

/**
 * Placeholder home screen. Phase 3 replaces this with the Today screen
 * (occasion chips, weather, "Suggest outfits").
 *
 * Layout rule for the whole app: narrow layout first, then widen at md/lg.
 * Same URL, same code, usable on a phone and on a desktop browser.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Wardrobe
        </h1>
        <p className="text-sm text-muted sm:text-base">
          Outfits from the clothes you already own.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium">Phase 0 — scaffold</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Postgres schema, storage adapter, and Claude wrapper in place.</li>
            <li>Ingestion, the recommendation engine, and the UI come next.</li>
          </ul>
          <Link
            href="/api/smoke"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground"
          >
            Run the Claude smoke test
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium">What&rsquo;s coming</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted">
            <li>1. Photograph or describe what you own.</li>
            <li>2. Pick an occasion; the weather fills itself in.</li>
            <li>3. Get three outfits you can actually wear today.</li>
          </ol>
        </div>
      </section>
    </main>
  );
}
