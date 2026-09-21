import type { ZodType } from "zod";

import type { TokenUsage } from "@/lib/ai/pricing";

export type ProviderName = "ollama" | "anthropic";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type TaskName =
  | "smoke"
  | "extract_garment"
  | "recommend_outfits"
  | "learn_preferences"
  | "style_review"
  | "eval_judge";

/**
 * Provider-neutral message shape. Anthropic wants typed content blocks and
 * Ollama wants a string plus a separate `images` array, so neither SDK's own
 * shape can be the lingua franca — this is translated in each provider.
 */
export type AiContent =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: string; base64: string };

export interface AiMessage {
  role: "user" | "assistant";
  content: AiContent[];
}

export interface AiRequest {
  model: string;
  messages: AiMessage[];
  maxTokens: number;
  system?: string;
  /**
   * Passed as a Zod schema rather than raw JSON Schema so each provider can
   * use its best mechanism: Anthropic constrains generation server-side,
   * Ollama applies a grammar built from the equivalent JSON Schema.
   */
  schema?: ZodType;
  effort?: Effort;
  thinking?: boolean;
  /** Cache the system prompt where the provider supports it. */
  cacheSystem?: boolean;
}

export interface AiResponse {
  text: string;
  /** Raw parsed JSON when a schema was requested; validated by the caller. */
  json: unknown;
  usage: TokenUsage;
  stopReason: string | null;
}

export interface AiProvider {
  readonly name: ProviderName;
  generate(request: AiRequest): Promise<AiResponse>;
  /** Transient failures worth another attempt (rate limits, 5xx, sockets). */
  isRetryable(error: unknown): boolean;
  /** Short stable label for the ModelCall row. */
  errorLabel(error: unknown): string;
}

export interface AiResult<T> {
  data: T | null;
  text: string;
  provider: ProviderName;
  model: string;
  task: TaskName;
  usage: TokenUsage;
  costUsd: number;
  latencyMs: number;
  attempts: number;
  stopReason: string | null;
  modelCallId: string | null;
}

export class AiCallError extends Error {
  constructor(
    message: string,
    readonly task: TaskName,
    readonly attempts: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiCallError";
  }
}
