import type Anthropic from "@anthropic-ai/sdk";

import type { ModelId, TaskName } from "@/lib/claude/models";
import type { TokenUsage } from "@/lib/claude/pricing";

export interface ClaudeResult<T> {
  /** Schema-validated output when a schema was supplied, else null. */
  data: T | null;
  /** Concatenated text blocks — useful for schema-less calls and debugging. */
  text: string;
  model: ModelId;
  task: TaskName;
  usage: TokenUsage;
  costUsd: number;
  latencyMs: number;
  attempts: number;
  stopReason: string | null;
  /** Row id in ModelCall, or null if logging failed. */
  modelCallId: string | null;
  raw: Anthropic.Message;
}

/** A system prompt as either plain text or cache-controlled blocks. */
export type SystemPrompt = string | Anthropic.TextBlockParam[];

export class ClaudeCallError extends Error {
  constructor(
    message: string,
    readonly task: TaskName,
    readonly attempts: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ClaudeCallError";
  }
}
