import { z } from "zod";

/**
 * Server-side environment. Parsed once at import time so a missing or
 * malformed variable fails loudly at boot rather than deep inside a request.
 *
 * Never import this from a client component — it would leak the API key into
 * the browser bundle. Everything here is server-only by construction.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ANTHROPIC_API_KEY: z
    .string()
    .min(1, "ANTHROPIC_API_KEY is required — copy .env.example to .env"),
  DEFAULT_USER_ID: z.string().min(1).default("local-user"),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  WEAR_RECENCY_DAYS: z.coerce.number().int().min(0).default(7),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
