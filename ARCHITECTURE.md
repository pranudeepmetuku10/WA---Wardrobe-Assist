# Architecture

How this app is put together and why. For setup and commands, see
[README.md](README.md).

## The one decision everything else follows from

Recommending an outfit splits into two jobs with completely different
requirements:

- **What *may* be worn together** — a question of facts. Wool is wrong at 34°C.
  A dress does not go with trousers. Shoes in the wash cannot be worn. Getting
  this wrong produces suggestions that are not merely unfashionable but absurd.
- **Which of the valid options is *best*, and why** — a question of judgement.

The first is ordinary TypeScript with unit tests. The second is a language
model. They are separated so completely that the model never assembles an
outfit; it only ranks and explains outfits the rules engine already built.

That separation is what lets a 9B model running on a laptop produce sane
suggestions, and it is why the eval reports two numbers instead of one: rule
compliance sits at 99%, while the model's writing scores 2.8/5.

```
  Browser
     │
     ▼
  Route handlers ──────► Rules engine            (plain TS, 106 tests)
  src/app/api/           src/lib/rules/
     │                        │
     │                   ~40 valid outfits
     │                        ▼
     └──────────────────► AI layer               (one door in and out)
                          src/lib/ai/
                               │
                     Ollama ───┴─── Anthropic
```

## Layers

### Frontend — Next.js 16 App Router, TypeScript, Tailwind v4

One codebase for phone and desktop. Pages are server components that query the
database directly, so the first paint already has data; anything stateful is a
client component.

| Route | File | Notes |
|---|---|---|
| `/` Today | [src/app/page.tsx](src/app/page.tsx) | Forecast fetched server-side |
| `/add` | [src/app/add/page.tsx](src/app/add/page.tsx) | Upload queue + review |
| `/wardrobe` | [src/app/wardrobe/page.tsx](src/app/wardrobe/page.tsx) | Grid, search, laundry toggle |
| `/history` | [src/app/history/page.tsx](src/app/history/page.tsx) | Outfits worn, with ratings |
| `/profile` | [src/app/profile/page.tsx](src/app/profile/page.tsx) | Preferences, hard rules, learned text |
| `/insights` | [src/app/insights/page.tsx](src/app/insights/page.tsx) | Wear stats, gaps, cost-per-wear |

**Every data-backed page sets `export const dynamic = "force-dynamic"`.**
Without it Next prerenders them at build time; a production build would serve
whatever was in the wardrobe at deploy. This was caught by finding a garment
count baked into `index.html` after a build.

Client components live in [src/components/](src/components/). There is no state
management library and no component library — server components and `useState`
cover the whole app.

### Database — Postgres 16 via Prisma 7

Postgres rather than SQLite so that `materials`, `seasons` and `styleTags` can
be native `String[]` columns instead of encoded JSON. It runs in Docker
([docker-compose.yml](docker-compose.yml)) on host port **5433**, chosen to
avoid colliding with any local Postgres.

- Schema: [prisma/schema.prisma](prisma/schema.prisma)
- Client singleton: [src/lib/db.ts](src/lib/db.ts)
- CLI/migration config: [prisma.config.ts](prisma.config.ts)

Two Prisma 7 specifics worth knowing before editing anything:

1. `url` is no longer allowed in the schema's `datasource` block. Connections
   go through a driver adapter (`@prisma/adapter-pg`) constructed in `db.ts`,
   and the CLI reads the URL from `prisma.config.ts`.
2. The generated client is emitted to `src/generated/prisma` (gitignored) and
   imported from there, not from `@prisma/client`.

**Every table carries `userId`** despite there being one user. Auth can be added
later without a data migration. The recommendation pipeline and the learning
loop both take an optional `userId` so the eval harness can run against a
fixture wardrobe without touching real data.

### AI layer — [src/lib/ai/](src/lib/ai/)

Every model call in the app goes through `callModel()`. Nothing else talks to a
provider.

| File | Responsibility |
|---|---|
| [types.ts](src/lib/ai/types.ts) | Provider-neutral request/response shapes |
| [models.ts](src/lib/ai/models.ts) | Model per task, per provider; per-model parameter rules |
| [pricing.ts](src/lib/ai/pricing.ts) | $/token rates and cost estimation ($0 for local) |
| [call.ts](src/lib/ai/call.ts) | Retries, schema validation, `ModelCall` logging |
| [providers/ollama.ts](src/lib/ai/providers/ollama.ts) | Local models over Ollama's HTTP API |
| [providers/anthropic.ts](src/lib/ai/providers/anthropic.ts) | Hosted Claude via the official SDK |
| [extract.ts](src/lib/ai/extract.ts) | Photo → garment attributes |
| [recommend.ts](src/lib/ai/recommend.ts) | Candidate outfits → ranked picks |
| [learn.ts](src/lib/ai/learn.ts) | Wear log → inferred preferences |

Switching providers is `AI_PROVIDER` in `.env`. No code changes. A single call
can override it (`?provider=anthropic` on the smoke route), which is how the two
get compared on the same scenarios.

**Structured output, never prompted JSON.** Callers pass a Zod schema.
Anthropic constrains generation server-side via `output_config.format`; Ollama
compiles the equivalent JSON Schema into a grammar. Both are re-validated
against the schema afterwards, so a malformed response is a typed failure
rather than a parse error deep in a route.

**Per-model parameter rules matter.** `MODEL_CAPABILITIES` in `models.ts` exists
because Anthropic tiers do not accept the same arguments: `output_config.effort`
is a 400 on Haiku, and Haiku thinks via `budget_tokens` while Sonnet and Opus
reject that and use adaptive thinking. Without that table, changing a tier in
one place would produce an invalid request in another.

**Thinking is forced off for structured local calls.** A thinking model plus a
grammar is a trap: the model reasons until it exhausts `num_predict` and the
constrained JSON is never emitted. Observed as an 8-minute call that returned
nothing; the same request with thinking off took 32 seconds. Enforced in the
Ollama provider, not just configured, so a future task cannot rediscover it.

**Observability.** Every call writes a `ModelCall` row: provider, model, token
counts, cache hits, latency, estimated cost, retries, error type. Cost per
recommendation is a query, not a guess.

### Rules engine — [src/lib/rules/](src/lib/rules/)

No AI, no I/O, no database. Pure functions, heavily tested.

| File | Responsibility |
|---|---|
| [occasions.ts](src/lib/rules/occasions.ts) | Occasion → formality window, favoured/avoided tags. Editable config. |
| [color.ts](src/lib/rules/color.ts) | hex→HSL, neutral detection, harmony classes, pattern clash penalties |
| [weather.ts](src/lib/rules/weather.ts) | Warmth targets, fabric breathability, rain and wind handling, vetoes |
| [filter.ts](src/lib/rules/filter.ts) | Who is eligible today, and how well each fits |
| [combine.ts](src/lib/rules/combine.ts) | Builds complete outfits, pre-scores, caps at ~40 |

Three rules here are deliberately not negotiable by the model:

- **The heat veto.** A garment more than two warmth steps above what the
  temperature calls for is removed, not down-scored. Scoring alone let wool
  trousers reach the model at 32°C, which then wrote a fluent paragraph
  justifying them. Excluded from the relaxation ladder: if nothing suits the
  weather, the honest answer is to say so.
- **The cold rule is different, and this asymmetry is load-bearing.** Warmth in
  the cold comes from the outer layer, so the too-thin veto applies *only* to
  outerwear. Applying it to every garment vetoed every shirt, every pair of
  trousers and all nine pairs of shoes at 2°C, leaving nothing to build with.
  Below 10°C a coat is instead *required*, and if none exists the pipeline
  reports the gap rather than suggesting a shirt at −4°C.
- **Accessory coherence.** Accessories are scored as part of the outfit, not
  attached afterwards, and neckwear requires a collar. Bolting the
  highest-scoring accessory on after scoring produced a necktie with a t-shirt.

### Weather — [src/lib/weather/openMeteo.ts](src/lib/weather/openMeteo.ts)

Open-Meteo: no API key, generous limits, geocoding included. Cached in memory
per city per hour. A manual override in the UI wins over the forecast, for
travel and for when the forecast is simply wrong.

**Temperature overrides the calendar.** `seasonForConditions()` treats ≤10°C as
winter and ≥28°C as summer whatever the date says. The calendar is only ever a
proxy for weather and we have the weather — without this, winter coats were
filtered as "out of season" during a 2°C snap in September.

### Garment ingestion

| File | Responsibility |
|---|---|
| [client/image.ts](src/lib/client/image.ts) | Browser-side resize to 1024px + thumbnail, bounded concurrency |
| [images/sniff.ts](src/lib/images/sniff.ts) | Magic-byte type detection |
| [garments/attributes.ts](src/lib/garments/attributes.ts) | Zod contract and the enum values the model may use |
| [garments/normalize.ts](src/lib/garments/normalize.ts) | Deterministic correction of physically wrong attributes |
| [garments/persist.ts](src/lib/garments/persist.ts) | Extraction → database rows |

Resizing happens in the browser because vision cost and latency scale with
pixels. 1024px rather than the 1568px that suits a hosted model: local models
are compute-bound rather than pixel-hungry, and the smaller image roughly halves
extraction time with no measurable attribute loss.

`sniff.ts` exists because a browser's declared Content-Type is a claim, not a
fact. A renamed file — in testing, a 2KB HTML error page named `.jpg` — reached
the model and failed after 47 seconds with an opaque provider error. Sniffing
rejects it in 276ms with a clear message and no model call.

`normalize.ts` exists because small models are fluent about garments and
unreliable about physics: a linen blazer came back as warmth 4, tagged for
winter. Warmth is clamped to what the fabric allows and contradictory seasons
are dropped. This is not cosmetic — Stage A scores weather fit from exactly
those fields, so a wrong warmth hides the right garment on a hot day.

### Recommendation pipeline — [src/lib/recommend/pipeline.ts](src/lib/recommend/pipeline.ts)

Orchestrates one request end to end:

1. Load the style profile and the wardrobe.
2. Resolve weather: manual override → city forecast → labelled default.
3. Filter and score ([filter.ts](src/lib/rules/filter.ts)).
4. Build and pre-score combinations ([combine.ts](src/lib/rules/combine.ts)).
5. **Relaxation ladder** — if fewer than three viable outfits, relax in a fixed
   order (recency → formality ±1 → season), recording which. The UI shows this,
   so an unusual suggestion is explained rather than mysterious.
6. Send the best ~40 to the model as short ids.
7. Validate every returned id, map back to garments, persist.

**Short ids (`c1`…`c40`) rather than database ids** are both cheaper in tokens
and harder to hallucinate: an invented `c99` fails a set lookup, where a
plausible-looking cuid might not.

### Learning loop

[ai/learn.ts](src/lib/ai/learn.ts) reads the last 50 `FeedbackEvent` rows and
rewrites what the app believes about the wearer. The result is surfaced as
**editable text** in the Style screen — inferred preferences that silently steer
suggestions are worse than none.

Pure logic lives separately in
[learning/preferences.ts](src/lib/learning/preferences.ts), including
`calibrateConfidence()`. The model reported 0.95 confidence from eight feedback
events while saying nothing substantive, so self-reported confidence is capped
by sample size, and placeholder answers ("unknown", "all available") are
stripped rather than displayed as findings.

### Storage — [src/lib/storage.ts](src/lib/storage.ts)

A `StorageAdapter` interface with a local-disk implementation writing to
`./uploads`, served through `/api/uploads/[...path]`. Moving to S3 or R2 means
implementing the interface and changing one export. Keys are resolved against
the upload root and anything escaping it is refused.

## Why some modules are split oddly

Modules importing `server-only` cannot be unit tested — vitest throws on
import. Pure logic therefore lives in its own files
([learning/preferences.ts](src/lib/learning/preferences.ts),
[insights.ts](src/lib/insights.ts), everything in
[rules/](src/lib/rules/)) while server-only modules orchestrate. Better layering
arrived at for an annoying reason.

## Testing

- **106 unit tests** ([tests/](tests/)) over the non-AI logic: colour, weather
  scoring, filtering, combination building, normalization, image sniffing,
  insights, pricing, confidence calibration. Several are regression tests named
  after real failures found by the eval harness.
- **25-scenario eval suite** ([evals/](evals/)) against a 64-garment fixture
  wardrobe, driving the real HTTP API. Deterministic rule checks plus an
  LLM judge, reported separately because they fail for different reasons: rules
  catch bugs, the judge catches blandness.

The judge is itself a small local model and is **not self-consistent** — across
runs of identical code one scenario scored 2, then 5, then 3. Treat the
deterministic rule count as the trustworthy number.

## Configuration

| What | Where |
|---|---|
| Provider, database URL, upload dir, recency default | `.env` (see [.env.example](.env.example)) |
| Which model does which job | [src/lib/ai/models.ts](src/lib/ai/models.ts) |
| Occasion → formality windows | [src/lib/rules/occasions.ts](src/lib/rules/occasions.ts) |
| Fabric warmth and breathability | [src/lib/rules/weather.ts](src/lib/rules/weather.ts) |
| Material-implied warmth clamps | [src/lib/garments/normalize.ts](src/lib/garments/normalize.ts) |

## Deliberately absent

No auth (single user, schema ready for it). No state management library. No
component library. No abstraction layer over Prisma. Out of scope for v1 per the
spec: shopping recommendations, social sharing, multi-user accounts, background
removal, virtual try-on, native apps, calendar integration.
