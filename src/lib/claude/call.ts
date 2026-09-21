import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

import {
  MODEL_CAPABILITIES,
  TASK_MODELS,
  type Effort,
  type TaskName,
} from "@/lib/claude/models";
import { anthropic } from "@/lib/claude/client";
import { estimateCostUsd, type TokenUsage } from "@/lib/claude/pricing";
import {
  ClaudeCallError,
  type ClaudeResult,
  type SystemPrompt,
} from "@/lib/claude/types";
import { prisma } from "@/lib/db";

export interface CallOptions<T> {
  task: TaskName;
  messages: Anthropic.MessageParam[];
  system?: SystemPrompt;
  /**
   * When supplied, the response is constrained server-side to this schema and
   * returned pre-parsed — no "please reply with JSON only" prompting needed.
   */
  schema?: ZodType<T>;
  schemaName?: string;
  /** Overrides for the task defaults in models.ts. */
  maxTokens?: number;
  effort?: Effort;
  tools?: Anthropic.Messages.ToolUnion[];
  /** Cache the last cacheable block (system prompt / wardrobe catalog). */
  cacheSystem?: boolean;
  /** Context stored alongside the ModelCall row. */
  meta?: Record<string, unknown>;
  maxAttempts?: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 600;

/**
 * The single entry point for every Claude call in the app.
 *
 * Responsibilities: pick the model for the task, keep the request shape legal
 * for that model, retry transient failures, and write one ModelCall row per
 * call with tokens, cache hits, latency and estimated cost.
 */
export async function callClaude<T = never>(
  options: CallOptions<T>,
): Promise<ClaudeResult<T>> {
  const {
    task,
    messages,
    system,
    schema,
    schemaName,
    tools,
    cacheSystem = false,
    meta,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  } = options;

  const config = TASK_MODELS[task];
  const capabilities = MODEL_CAPABILITIES[config.model];
  const maxTokens = options.maxTokens ?? config.maxTokens;
  const effort = options.effort ?? config.effort;

  const params: Record<string, unknown> = {
    model: config.model,
    max_tokens: maxTokens,
    messages,
  };

  if (system) params.system = system;
  if (tools?.length) params.tools = tools;

  // effort lives inside output_config, and only on models that accept it.
  if (effort && capabilities.supportsEffort) {
    params.output_config = { effort };
  }

  // Adaptive thinking on Sonnet/Opus; Haiku would 400 on it.
  if (config.thinking && capabilities.thinking === "adaptive") {
    params.thinking = { type: "adaptive" };
  }

  // Auto-cache the last cacheable block — the long, static system prompt.
  if (cacheSystem) {
    params.cache_control = { type: "ephemeral" };
  }

  if (schema) {
    params.output_config = {
      ...(params.output_config as object | undefined),
      format: zodOutputFormat(schema, schemaName ?? `${task}_output`),
    };
  }

  const startedAt = Date.now();
  let attempts = 0;
  let lastError: unknown;

  while (attempts < maxAttempts) {
    attempts += 1;
    const attemptStart = Date.now();

    try {
      // messages.parse validates against the schema and fills parsed_output.
      const response = schema
        ? ((await anthropic.messages.parse(
            params as never,
          )) as Anthropic.Message & { parsed_output: T | null })
        : ((await anthropic.messages.create(
            params as never,
          )) as Anthropic.Message & { parsed_output?: undefined });

      const usage = readUsage(response);
      const costUsd = estimateCostUsd(config.model, usage);
      const latencyMs = Date.now() - attemptStart;
      const text = collectText(response);

      if (response.stop_reason === "refusal") {
        throw new ClaudeCallError(
          `Claude refused the ${task} request (${response.stop_details?.category ?? "unknown"})`,
          task,
          attempts,
        );
      }

      if (response.stop_reason === "max_tokens") {
        // Truncated output is unusable for structured tasks — treat as retryable
        // once, then surface. Raising max_tokens is the real fix.
        throw new RetryableError(
          `Response hit max_tokens (${maxTokens}) for ${task}`,
        );
      }

      const parsed = schema ? (response.parsed_output ?? null) : null;
      if (schema && parsed === null) {
        throw new RetryableError(`Structured output failed to parse for ${task}`);
      }

      const modelCallId = await logCall({
        task,
        model: config.model,
        usage,
        costUsd,
        latencyMs,
        ok: true,
        attempts,
        stopReason: response.stop_reason ?? null,
        meta,
      });

      return {
        data: parsed,
        text,
        model: config.model,
        task,
        usage,
        costUsd,
        latencyMs: Date.now() - startedAt,
        attempts,
        stopReason: response.stop_reason ?? null,
        modelCallId,
        raw: response,
      };
    } catch (error) {
      lastError = error;

      if (!isRetryable(error) || attempts >= maxAttempts) {
        await logCall({
          task,
          model: config.model,
          usage: emptyUsage(),
          costUsd: 0,
          latencyMs: Date.now() - attemptStart,
          ok: false,
          attempts,
          errorType: errorLabel(error),
          meta,
        });
        throw new ClaudeCallError(
          `Claude call failed for ${task} after ${attempts} attempt(s): ${errorMessage(error)}`,
          task,
          attempts,
          error,
        );
      }

      await sleep(backoffMs(attempts));
    }
  }

  throw new ClaudeCallError(
    `Claude call exhausted retries for ${task}`,
    task,
    attempts,
    lastError,
  );
}

// ------------------------------------------------------------- internals ---

class RetryableError extends Error {}

function isRetryable(error: unknown): boolean {
  if (error instanceof RetryableError) return true;
  if (error instanceof Anthropic.RateLimitError) return true;
  if (error instanceof Anthropic.APIConnectionError) return true;
  if (error instanceof Anthropic.InternalServerError) return true;
  if (error instanceof Anthropic.APIError) {
    return typeof error.status === "number" && error.status >= 500;
  }
  return false;
}

function errorLabel(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    return `${error.constructor.name}:${error.status ?? "?"}`;
  }
  if (error instanceof Error) return error.constructor.name;
  return "UnknownError";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function backoffMs(attempt: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  return exponential + Math.floor(Math.random() * 250);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  };
}

function readUsage(response: Anthropic.Message): TokenUsage {
  return {
    inputTokens: response.usage.input_tokens ?? 0,
    outputTokens: response.usage.output_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
  };
}

function collectText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

interface LogInput {
  task: TaskName;
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
      `[claude] failed to log ModelCall for ${input.task}:`,
      errorMessage(error),
    );
    return null;
  }
}
