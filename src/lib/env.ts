import { z } from "zod";

/**
 * Server-side environment. Parsed once at import time so a missing or
 * malformed variable fails loudly at boot rather than deep inside a request.
 *
 * Never import this from a client component — it would leak secrets into the
 * browser bundle.
 */
const EnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // Local by default: free, private, no rate limits. Flip to "anthropic"
    // once you want hosted quality — no code changes required.
    AI_PROVIDER: z.enum(["ollama", "anthropic"]).default("ollama"),
    OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
    ANTHROPIC_API_KEY: z.string().optional(),

    DEFAULT_USER_ID: z.string().min(1).default("local-user"),
    UPLOAD_DIR: z.string().min(1).default("./uploads"),
    WEAR_RECENCY_DAYS: z.coerce.number().int().min(0).default(7),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .superRefine((value, ctx) => {
    // Only demand a key for the provider actually in use.
    const placeholder = !value.ANTHROPIC_API_KEY?.startsWith("sk-ant-api");
    if (value.AI_PROVIDER === "anthropic" && placeholder) {
      ctx.addIssue({
        code: "custom",
        path: ["ANTHROPIC_API_KEY"],
        message:
          "a real key is required when AI_PROVIDER=anthropic (found missing or placeholder)",
      });
    }
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
