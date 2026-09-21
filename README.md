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
| AI | Anthropic TypeScript SDK — Haiku 4.5 for extraction, Sonnet 5 for recommendations, Opus 5 for deep reviews |
| Images | Local `./uploads` behind `src/lib/storage.ts` (S3/R2 drops in later) |

## Setup

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Start Postgres (needs Docker Desktop running)
npm run db:up

# 3. Configure the environment
cp .env.example .env     # already done if .env exists
#   -> paste your key into ANTHROPIC_API_KEY

# 4. Create the schema and seed the single-user profile
npm run db:push
npm run db:seed

# 5. Run it
npm run dev
```

Then open http://localhost:3000 and hit the smoke test:

```bash
curl -s localhost:3000/api/smoke | jq
```

A healthy response returns `ok: true`, a schema-validated `response` object,
token counts, and `modelCallLogged: true` — meaning the call was recorded in
the `ModelCall` table.

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
src/lib/claude/
  models.ts               Model per task, and which params each model accepts
  pricing.ts              $/MTok rates and cost estimation
  client.ts               The one Anthropic client (server-only)
  call.ts                 callClaude() — typed, retried, logged
src/app/api/smoke/        Phase 0 acceptance check
```

## Conventions

- **No Claude calls outside `src/lib/claude/`.** Every call goes through
  `callClaude()` so it is typed, retried, and logged to `ModelCall`.
- **Never call Anthropic from the client.** `client.ts` imports `server-only`.
- Secrets live in `.env`; `.env.example` documents them.
- Model IDs are configured per task in `models.ts` — change tiers there, not at
  call sites. Note that `output_config.effort` and adaptive thinking are not
  accepted by every model, which is why `MODEL_CAPABILITIES` exists.
- Every table carries `userId` so auth can be added without a data migration.

## Status

- [x] **Phase 0** — scaffold, schema, storage, Claude wrapper, smoke test
- [ ] **Phase 1** — ingestion, vision extraction, review screen
- [ ] **Phase 2** — filtering engine, recommendation call, weather tool
- [ ] **Phase 3** — full UI
- [ ] **Phase 4** — learning loop, insights, eval harness

Out of scope for v1: shopping recommendations, social sharing, multi-user
accounts, background removal / virtual try-on, native apps, calendar
integration.
