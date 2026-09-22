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

## Status

- [x] **Phase 0** — scaffold, schema, storage, provider-pluggable AI wrapper, smoke test
- [x] **Phase 1** — ingestion, vision extraction, review screen
- [ ] **Phase 2** — filtering engine, recommendation call, weather tool
- [ ] **Phase 3** — full UI
- [ ] **Phase 4** — learning loop, insights, eval harness

Out of scope for v1: shopping recommendations, social sharing, multi-user
accounts, background removal / virtual try-on, native apps, calendar
integration.
