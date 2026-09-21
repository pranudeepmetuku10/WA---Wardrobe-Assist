import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { MODEL_CAPABILITIES } from "@/lib/ai/models";
import { emptyUsage, type TokenUsage } from "@/lib/ai/pricing";
import type { AiProvider, AiRequest, AiResponse } from "@/lib/ai/types";

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic" as const;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      // Timeouts are milliseconds in the TS SDK.
      timeout: 120_000,
      // We run our own retry loop so every attempt is logged.
      maxRetries: 0,
    });
  }

  async generate(request: AiRequest): Promise<AiResponse> {
    const capabilities = MODEL_CAPABILITIES[request.model];

    const params: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content.map((block) =>
          block.type === "text"
            ? { type: "text" as const, text: block.text }
            : {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: block.mediaType,
                  data: block.base64,
                },
              },
        ),
      })),
    };

    if (request.system) params.system = request.system;

    // effort lives inside output_config, and only on models that accept it.
    if (request.effort && capabilities?.supportsEffort) {
      params.output_config = { effort: request.effort };
    }
    // Adaptive thinking on Sonnet/Opus; Haiku would 400 on it.
    if (request.thinking && capabilities?.thinking === "adaptive") {
      params.thinking = { type: "adaptive" };
    }
    // Auto-caches the last cacheable block — the long, static system prompt.
    if (request.cacheSystem) {
      params.cache_control = { type: "ephemeral" };
    }
    if (request.schema) {
      params.output_config = {
        ...(params.output_config as object | undefined),
        format: zodOutputFormat(request.schema),
      };
    }

    const response = request.schema
      ? ((await this.client.messages.parse(params as never)) as Anthropic.Message & {
          parsed_output: unknown;
        })
      : await this.client.messages.create(params as never);

    const usage: TokenUsage = {
      ...emptyUsage(),
      inputTokens: response.usage.input_tokens ?? 0,
      outputTokens: response.usage.output_tokens ?? 0,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    };

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return {
      text,
      json:
        request.schema && "parsed_output" in response
          ? response.parsed_output
          : null,
      usage,
      stopReason: response.stop_reason ?? null,
    };
  }

  isRetryable(error: unknown): boolean {
    if (error instanceof Anthropic.RateLimitError) return true;
    if (error instanceof Anthropic.APIConnectionError) return true;
    if (error instanceof Anthropic.InternalServerError) return true;
    if (error instanceof Anthropic.APIError) {
      return typeof error.status === "number" && error.status >= 500;
    }
    return false;
  }

  errorLabel(error: unknown): string {
    if (error instanceof Anthropic.APIError) {
      return `${error.constructor.name}:${error.status ?? "?"}`;
    }
    return error instanceof Error ? error.constructor.name : "UnknownError";
  }
}
