import "server-only";

import type { ZodType } from "zod";

import { taskConfig } from "@/lib/ai/models";
import { estimateCostUsd, emptyUsage, type TokenUsage } from "@/lib/ai/pricing";
import { AnthropicProvider } from "@/lib/ai/providers/anthropic";
import { OllamaProvider } from "@/lib/ai/providers/ollama";
import {
  AiCallError,
  type AiMessage,
  type AiProvider,
  type AiResult,
  type Effort,
  type ProviderName,
  type TaskName,
} from "@/lib/ai/types";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export interface CallOptions<T> {
  task: TaskName;
  messages: AiMessage[];
  system?: string;
  /** Constrains and validates the response. Strongly preferred over prompting for JSON. */
  schema?: ZodType<T>;
  maxTokens?: number;
  effort?: Effort;
  thinking?: boolean;
  cacheSystem?: boolean;
  /** Override the configured provider for one call (used by the eval harness). */
  provider?: ProviderName;
  meta?: Record<string, unknown>;
  maxAttempts?: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 600;

const providerCache = new Map<ProviderName, AiProvider>();

export function getProvider(name: ProviderName = env.AI_PROVIDER): AiProvider {
  const cached = providerCache.get(name);
  if (cached) return cached;

  let provider: AiProvider;
  if (name === "ollama") {
    provider = new OllamaProvider(env.OLLAMA_BASE_URL);
  } else {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set — required when AI_PROVIDER=anthropic",
      );
    }
    provider = new AnthropicProvider(env.ANTHROPIC_API_KEY);
  }

  providerCache.set(name, provider);
  return provider;
}

/**
 * The single entry point for every model call in the app.
 *
 * Picks the model for the task and provider, keeps the request shape legal for
 * that model, retries transient failures, validates structured output, and
 * writes one ModelCall row per call with tokens, latency and estimated cost.
 */
export async function callModel<T = never>(
  options: CallOptions<T>,
): Promise<AiResult<T>> {
  const {
    task,
    messages,
    system,
    schema,
    cacheSystem = false,
    meta,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  } = options;

  const providerName = options.provider ?? env.AI_PROVIDER;
  const provider = getProvider(providerName);
  const config = taskConfig(task, providerName);

  const request = {
    model: config.model,
    messages,
    system,
    schema,
    maxTokens: options.maxTokens ?? config.maxTokens,
    effort: options.effort ?? config.effort,
    thinking: options.thinking ?? config.thinking,
    cacheSystem,
  };

  const startedAt = Date.now();
  let attempts = 0;
  let lastError: unknown;

  while (attempts < maxAttempts) {
    attempts += 1;
    const attemptStart = Date.now();

    try {
      const response = await provider.generate(request);
      const costUsd = estimateCostUsd(config.model, response.usage);
      const latencyMs = Date.now() - attemptStart;

      let data: T | null = null;
      if (schema) {
        const parsed = schema.safeParse(response.json);
        if (!parsed.success) {
          // Local grammars are best-effort; a bad shape is worth one more go.
          throw new SchemaError(
            `Output failed validation for ${task}: ${parsed.error.issues
              .map((i) => `${i.path.join(".") || "root"} ${i.message}`)
              .slice(0, 3)
              .join("; ")}`,
          );
        }
        data = parsed.data;
      }

      const modelCallId = await logCall({
        task,
        provider: providerName,
        model: config.model,
        usage: response.usage,
        costUsd,
        latencyMs,
        ok: true,
        attempts,
        stopReason: response.stopReason,
        meta,
      });

      return {
        data,
        text: response.text,
        provider: providerName,
        model: config.model,
        task,
        usage: response.usage,
        costUsd,
        latencyMs: Date.now() - startedAt,
        attempts,
        stopReason: response.stopReason,
        modelCallId,
      };
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof SchemaError || provider.isRetryable(error);

      if (!retryable || attempts >= maxAttempts) {
        await logCall({
          task,
          provider: providerName,
          model: config.model,
          usage: emptyUsage(),
          costUsd: 0,
          latencyMs: Date.now() - attemptStart,
          ok: false,
          attempts,
          errorType:
            error instanceof SchemaError
              ? "SchemaError"
              : provider.errorLabel(error),
          meta,
        });
        throw new AiCallError(
          `${providerName} call failed for ${task} after ${attempts} attempt(s): ${errorMessage(error)}`,
          task,
          attempts,
          error,
        );
      }

      await sleep(backoffMs(attempts));
    }
  }

  throw new AiCallError(
    `${providerName} call exhausted retries for ${task}`,
    task,
    attempts,
    lastError,
  );
}

// ------------------------------------------------------------- internals ---

class SchemaError extends Error {}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function backoffMs(attempt: number): number {
  return BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface LogInput {
  task: TaskName;
  provider: ProviderName;
  model: string;
  usage: TokenUsage;
  costUsd: number;
  latencyMs: number;
  ok: boolean;
  attempts: number;
  stopReason?: string | null;
  errorType?: string;
  meta?: Record<string, unknown>;
}

/** Observability must never break the request it is observing. */
async function logCall(input: LogInput): Promise<string | null> {
  try {
    const row = await prisma.modelCall.create({
      data: {
        task: input.task,
        provider: input.provider,
        model: input.model,
        inputTokens: input.usage.inputTokens,
        outputTokens: input.usage.outputTokens,
        cacheCreationTokens: input.usage.cacheCreationTokens,
        cacheReadTokens: input.usage.cacheReadTokens,
        latencyMs: input.latencyMs,
        costUsd: input.costUsd,
        ok: input.ok,
        attempts: input.attempts,
        stopReason: input.stopReason ?? null,
        errorType: input.errorType ?? null,
        meta: (input.meta ?? undefined) as never,
      },
      select: { id: true },
    });
    return row.id;
  } catch (error) {
    console.warn(
      `[ai] failed to log ModelCall for ${input.task}:`,
      errorMessage(error),
    );
    return null;
  }
}
