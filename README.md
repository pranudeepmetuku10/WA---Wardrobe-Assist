# Wardrobe Assistant

Outfit recommendations built from the clothes you actually own — filtered
deterministically, then styled by Claude, with the weather and the occasion
taken into account.

Mobile-first (designed at ~390px), installable as a PWA, single user, local.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router) + TypeScript + Tailwind v4 |
| DB | Postgres 16 (Docker) via Prisma 7 |
| AI | Pluggable. **Local (Ollama + qwen3.5) by default** — free, private, no rate limits. Anthropic (Haiku 4.5 / Sonnet 5 / Opus 5) is a one-line switch |
| Images | Local `./uploads` behind `src/lib/storage.ts` (S3/R2 drops in later) |

## Setup

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Start Postgres (needs Docker Desktop running)
npm run db:up

# 3. Pull the local models (~10 GB, one time)
ollama pull qwen3.5:4b    # photo extraction
ollama pull qwen3.5:9b    # outfit recommendations

# 4. Configure the environment
cp .env.example .env      # defaults to AI_PROVIDER=ollama; no API key needed

# 5. Create the schema and seed the single-user profile
npm run db:push
npm run db:seed

# 6. Run it
npm run dev
```

Then open http://localhost:3000 and hit the smoke test:

```bash
curl -s localhost:3000/api/smoke | jq
```

A healthy response returns `ok: true`, a schema-validated `response` object,
token counts, and `modelCallLogged: true` — meaning the call was recorded in
the `ModelCall` table.

## Switching providers

Local is the default and costs nothing. To compare against hosted Claude, put a
funded key in `.env` and set `AI_PROVIDER="anthropic"` — no code changes. For a
single call without changing config:

```bash
curl -s "localhost:3000/api/smoke?provider=anthropic" | jq
```

Which model runs which task lives in [`src/lib/ai/models.ts`](src/lib/ai/models.ts),
one table per provider. `ModelCall` records the provider, tokens, latency and
cost of every call, so the two can be compared on measured numbers rather than
vibes.

**Memory note:** on a 16 GB machine, `qwen3.5:9b` (~5.5 GB resident) alongside
Docker and the dev server runs the system into swap. If recommendations feel
sluggish, point `recommend_outfits` at `qwen3.5:4b` in `models.ts`, or stop the
Postgres container when you aren't using it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm test` | Vitest (filtering, colour, scoring — the non-LLM logic) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:up` / `db:down` | Start / stop Postgres |
| `npm run db:push` | Apply the Prisma schema |
| `npm run db:seed` | Seed the style profile and starter garments |
| `npm run db:reset` | Wipe and reseed |
| `npm run db:studio` | Browse the data |

## Layout

```
prisma/schema.prisma      Garment, Outfit, StyleProfile, FeedbackEvent, ModelCall
src/lib/env.ts            Zod-validated environment, fails fast at boot
src/lib/db.ts             Prisma singleton
src/lib/storage.ts        StorageAdapter + local disk implementation
src/lib/ai/
  types.ts                Provider-neutral request/response shapes
  models.ts               Model per task, per provider
  pricing.ts              $/MTok rates ($0 for local) and cost estimation
  providers/ollama.ts     Local models over Ollama's HTTP API
  providers/anthropic.ts  Hosted Claude
  call.ts                 callModel() — typed, retried, validated, logged
src/lib/garments/
  attributes.ts           Zod contract + the enum values the model may use
  normalize.ts            Deterministic fixes for physically wrong attributes
  persist.ts              Extraction -> Garment rows
src/lib/images/sniff.ts   Magic-byte image type detection
src/lib/client/image.ts   Browser resize (1024px) + batch concurrency
src/components/           Upload queue and the editable review card
src/app/add/              Add + review screen
src/app/api/garments/     ingest | text | verify | list | edit | delete
src/lib/rules/
  occasions.ts            Occasion -> formality window (edit this freely)
  color.ts                HSL, neutral detection, harmony, pattern clashes
  weather.ts              Warmth targets, breathability, the hot/cold veto
  filter.ts               Stage A: who is eligible today, and how well they fit
  combine.ts              Stage A: build and pre-score whole outfits
src/lib/weather/          Open-Meteo geocoding + forecast, cached hourly
src/lib/ai/recommend.ts   Stage B: the model ranks pre-validated outfits
src/lib/recommend/        The pipeline, including the relaxation ladder
src/app/api/recommend/    POST an occasion, get three outfits
src/app/api/smoke/        Phase 0 acceptance check
```

## Conventions

- **No model calls outside `src/lib/ai/`.** Every call goes through
  `callModel()` so it is typed, retried, validated, and logged to `ModelCall`.
- **Never call a model provider from the client.** `call.ts` imports `server-only`.
- Secrets live in `.env`; `.env.example` documents them.
- Models are configured per task in `models.ts` — change tiers there, not at
  call sites. Note that `output_config.effort` and adaptive thinking are not
  accepted by every Anthropic model, which is why `MODEL_CAPABILITIES` exists.
- Ask for structured output with a Zod schema, never by prompting "reply with
  JSON". Anthropic constrains generation server-side; Ollama applies a grammar
  from the same schema. Both are re-validated against the schema afterwards.
- Every table carries `userId` so auth can be added without a data migration.

## Wardrobe ingestion

`/add` takes a batch of photos (drag-and-drop on desktop, camera on mobile),
resizes each to 1024px client-side, and runs them through extraction three at a
time. One failure never loses the batch. Items come back as unverified drafts
and stay that way until you confirm them, so nothing enters the wardrobe on the
model's say-so.

Two things the model is reliably bad at locally, both handled in code rather
than by prompting:

- **Physically impossible attributes** — a linen blazer rated warmth 4 and
  tagged for winter. `normalize.ts` clamps warmth to what the fabric allows and
  strips contradictory seasons. This matters because Stage A scores weather fit
  from exactly those fields.
- **Pairs counted twice** — a photo of shoes returning two FOOTWEAR items.

## How a recommendation is made

Two stages, and the split is the whole design:

**Stage A is deterministic TypeScript** (`src/lib/rules/`). It picks who is
eligible — available, in season, in the occasion's formality window, not worn
too recently — scores what survives against the weather, assembles complete
outfits, and pre-scores them on colour harmony and formality coherence. Only
the best ~40 go any further.

**Stage B is the model.** It receives those pre-validated outfits as short ids
(`c1`, `c2`, ...) and ranks three of them with reasoning. It cannot assemble an
outfit, cannot name a garment you don't own, and a pick referencing an unknown
id is rejected and retried. Short ids are both cheaper in tokens and harder to
hallucinate than database ids.

Two rules are deliberately *not* negotiable by the model:

- **The weather veto.** A garment more than two warmth steps above what the
  temperature calls for is removed, not merely down-scored. Scoring alone let
  wool trousers reach the model at 32C, and it wrote a confident paragraph
  justifying them. It is excluded from the relaxation ladder: if nothing in the
  wardrobe suits the weather, the honest answer is to say so.
- **Accessory coherence.** An accessory is re-scored as part of the outfit, and
  neckwear needs a collar to sit on.

When Stage A cannot find three viable outfits it relaxes constraints in a fixed
order — recency, then formality by one step, then season — and reports which,
so the UI can tell you why today's suggestions look unusual.

```bash
curl -s localhost:3000/api/recommend -X POST -H 'Content-Type: application/json' \
  -d '{"occasion":"date night","weather":{"temperatureC":32,"humidity":80}}' | jq
```

Weather comes from Open-Meteo (no key needed), cached per city per hour, with a
manual override for travel.

## Screens

| Route | What it does |
|---|---|
| `/` | **Today** — occasion chips, live forecast, free-text override, three outfits |
| `/wardrobe` | Filterable grid, search, one-tap laundry toggle, inline edit |
| `/add` | Batch upload, extraction queue, review cards |
| `/history` | Every outfit suggested and worn, with ratings |
| `/profile` | Colours, hard rules, notes, and what the app thinks it learned |

Bottom tab bar on a phone, top bar on a desktop, same routes either way.
Outfit results swipe horizontally on a phone and become a grid at `sm:`.

Pages that read the database are `force-dynamic`. Without it Next prerenders
them at build time, and a production build serves whatever was in the wardrobe
the moment you deployed.

## Learning loop

Every *Wear this*, skip and rating writes a `FeedbackEvent`. **Refresh what
you've learned** on the Style screen reads the last 50 of them and rewrites
what the app believes about your taste.

The result is shown as **editable text**, not a read-only summary. If it infers
something wrong, change it — the corrected version is what gets read back when
suggesting outfits. Preferences that quietly steer suggestions without being
visible are worse than no preferences at all.

## Evals

```bash
npm run dev            # the harness drives the real HTTP API
npm run eval           # 25 scenarios, rules + LLM judge
npm run eval -- --no-judge            # rules only, much faster
npm run eval -- --only=<scenario-id>  # one scenario
```

- **64 fixture garments** under their own user id, so evals never touch your
  real wardrobe. Shaped like a real one, gaps included — there is no black tie
  in it, deliberately.
- **25 scenarios** crossing occasion, weather and constraints (laundry day,
  recently worn, explicit requests, and one case where the honest answer is
  "no outfit can be built").
- **Deterministic checks** for the things that are simply wrong: wool above
  28C, shorts at the office, suede in the rain, footwear formality more than
  one step from the top, a dress paired with trousers, anything in the laundry.
- **An LLM judge** scores the reasoning 1-5 against each scenario's rubric.
  Rules and judgement are reported separately, because they fail for different
  reasons: rules catch bugs, the judge catches blandness.
- Reports pass rate, failures grouped by rule, median and p90 latency, and cost.

Exit code is non-zero when any scenario fails, so it can gate a commit. If the
model provider stops answering mid-run the harness aborts rather than recording
twenty identical failures.

### Where it currently stands (local, qwen3.5:9b)

| | Result |
|---|---|
| Deterministic rules | **838 / 844 (99.3%)** |
| Scenarios fully passing | 12 / 25 (48%) |
| Judge mean | 2.79 / 5 |
| Latency | median 58s, p90 64s |
| Cost | $0 |

Read those two top rows as separate things, because they measure separate
things. **Outfit construction is essentially solved**: every rule about what
may be worn together — layers below 10C, no wool above 28C, footwear formality,
no dress with trousers, nothing from the laundry — now passes. All six
remaining rule failures are `reasoning_is_specific`, i.e. the model wrote
something generic.

**The reasoning is the weak half.** A mean judge score of 2.79 means the
suggestions are defensible but the explanations often are not: they restate the
occasion instead of engaging with it, and occasionally assert something the
outfit contradicts. This is a 9B model running on a laptop, and it is the
strongest argument for switching `AI_PROVIDER` to `anthropic` — the filtering
would not change at all, only the writing.

**Treat small pass-rate moves as noise.** The judge is itself a 9B model and is
not self-consistent: across runs of identical code, one scenario scored 2, then
5, then 3. The deterministic rule count is the number to trust.

## Status

- [x] **Phase 0** — scaffold, schema, storage, provider-pluggable AI wrapper, smoke test
- [x] **Phase 1** — ingestion, vision extraction, review screen
- [x] **Phase 2** — filtering engine, recommendation call, weather
- [x] **Phase 3** — full UI
- [ ] **Phase 4** — learning loop, insights, eval harness

Out of scope for v1: shopping recommendations, social sharing, multi-user
accounts, background removal / virtual try-on, native apps, calendar
integration.
