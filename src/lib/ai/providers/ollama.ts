import { z } from "zod";

import { emptyUsage, type TokenUsage } from "@/lib/ai/pricing";
import type {
  AiMessage,
  AiProvider,
  AiRequest,
  AiResponse,
} from "@/lib/ai/types";

/** Ollama's /api/chat message shape: content is a string, images sit beside it. */
interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

interface OllamaChatResponse {
  message?: { content?: string; thinking?: string };
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

export class OllamaError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "OllamaError";
  }
}

export class OllamaProvider implements AiProvider {
  readonly name = "ollama" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 300_000,
  ) {}

  async generate(request: AiRequest): Promise<AiResponse> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: toOllamaMessages(request),
      stream: false,
      options: { num_predict: request.maxTokens },
    };

    // Ollama constrains generation with a grammar built from the JSON Schema.
    if (request.schema) {
      body.format = z.toJSONSchema(request.schema, { io: "output" });
    }
    // Thinking models emit a separate `thinking` field; keep it off unless the
    // task wants it, because it roughly doubles local latency.
    body.think = request.thinking === true;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      // Connection refused / timeout — the daemon may be starting or busy.
      throw new OllamaError(
        `Could not reach Ollama at ${this.baseUrl} (${
          error instanceof Error ? error.message : String(error)
        }). Is it running?`,
        null,
        true,
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const missingModel =
        response.status === 404 || detail.includes("not found");
      throw new OllamaError(
        missingModel
          ? `Model "${request.model}" is not pulled. Run: ollama pull ${request.model}`
          : `Ollama returned ${response.status}: ${detail.slice(0, 300)}`,
        response.status,
        // A missing model will never fix itself by retrying.
        !missingModel && response.status >= 500,
      );
    }

    const payload = (await response.json()) as OllamaChatResponse;
    if (payload.error) {
      throw new OllamaError(payload.error, null, false);
    }

    const text = (payload.message?.content ?? "").trim();
    const usage: TokenUsage = {
      ...emptyUsage(),
      inputTokens: payload.prompt_eval_count ?? 0,
      outputTokens: payload.eval_count ?? 0,
    };

    return {
      text,
      json: request.schema ? safeParseJson(text) : null,
      usage,
      stopReason: payload.done_reason ?? null,
    };
  }

  isRetryable(error: unknown): boolean {
    return error instanceof OllamaError && error.retryable;
  }

  errorLabel(error: unknown): string {
    if (error instanceof OllamaError) {
      return `OllamaError:${error.status ?? "conn"}`;
    }
    return error instanceof Error ? error.constructor.name : "UnknownError";
  }
}

function toOllamaMessages(request: AiRequest): OllamaMessage[] {
  const messages: OllamaMessage[] = [];
  if (request.system) {
    messages.push({ role: "system", content: request.system });
  }

  for (const message of request.messages) {
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const images = message.content
      .filter((block) => block.type === "image")
      .map((block) => block.base64);

    messages.push({
      role: message.role,
      content: text,
      ...(images.length ? { images } : {}),
    });
  }

  return messages;
}

/**
 * Grammar-constrained output is usually clean JSON, but a model can still stop
 * early and truncate it. Returning null lets the caller's schema check fail in
 * one place rather than throwing from two.
 */
function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
