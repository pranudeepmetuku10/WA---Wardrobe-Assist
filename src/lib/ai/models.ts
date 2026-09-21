import type { Effort, ProviderName, TaskName } from "@/lib/ai/types";

/**
 * One place to pick the model per job, per provider. Swap tiers here — never
 * at a call site.
 *
 * We run locally first (free, private, no rate limits) and keep the Anthropic
 * column current so switching is a config change, not a rewrite.
 */

export interface TaskConfig {
  model: string;
  maxTokens: number;
  /** Only sent to providers/models that accept it. */
  effort?: Effort;
  thinking: boolean;
}

/**
 * Local models on Ollama. qwen3.5 is multimodal at every size, so the same
 * family covers photo extraction and styling — 4b for the narrow, high-volume
 * extraction, 9b where judgment matters.
 */
const OLLAMA_TASKS: Record<TaskName, TaskConfig> = {
  smoke: { model: "qwen3.5:4b", maxTokens: 512, thinking: false },
  extract_garment: { model: "qwen3.5:4b", maxTokens: 2048, thinking: false },
  recommend_outfits: { model: "qwen3.5:9b", maxTokens: 4096, thinking: true },
  learn_preferences: { model: "qwen3.5:9b", maxTokens: 2048, thinking: false },
  style_review: { model: "qwen3.5:9b", maxTokens: 4096, thinking: true },
  eval_judge: { model: "qwen3.5:9b", maxTokens: 1024, thinking: false },
};

/**
 * Anthropic model IDs are complete as written — never append a date suffix.
 * Note the per-model request-shape rules in MODEL_CAPABILITIES below.
 */
export const ANTHROPIC_MODEL_IDS = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-5",
} as const;

const ANTHROPIC_TASKS: Record<TaskName, TaskConfig> = {
  smoke: { model: ANTHROPIC_MODEL_IDS.haiku, maxTokens: 512, thinking: false },
  extract_garment: {
    model: ANTHROPIC_MODEL_IDS.haiku,
    maxTokens: 4096,
    thinking: false,
  },
  recommend_outfits: {
    model: ANTHROPIC_MODEL_IDS.sonnet,
    maxTokens: 8192,
    effort: "high",
    thinking: true,
  },
  learn_preferences: {
    model: ANTHROPIC_MODEL_IDS.sonnet,
    maxTokens: 4096,
    effort: "medium",
    thinking: true,
  },
  style_review: {
    model: ANTHROPIC_MODEL_IDS.opus,
    maxTokens: 16000,
    effort: "high",
    thinking: true,
  },
  eval_judge: {
    model: ANTHROPIC_MODEL_IDS.sonnet,
    maxTokens: 2048,
    effort: "low",
    thinking: false,
  },
};

/**
 * Anthropic tiers do not accept the same parameters. Sending one a model
 * rejects is a hard 400:
 *  - output_config.effort errors on Haiku 4.5.
 *  - Haiku 4.5 thinks only via budget_tokens; Sonnet 5 / Opus 5 reject that
 *    and use adaptive thinking instead.
 */
export interface ModelCapabilities {
  supportsEffort: boolean;
  thinking: "adaptive" | "budget" | "none";
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  [ANTHROPIC_MODEL_IDS.haiku]: { supportsEffort: false, thinking: "budget" },
  [ANTHROPIC_MODEL_IDS.sonnet]: { supportsEffort: true, thinking: "adaptive" },
  [ANTHROPIC_MODEL_IDS.opus]: { supportsEffort: true, thinking: "adaptive" },
};

const TASKS_BY_PROVIDER: Record<ProviderName, Record<TaskName, TaskConfig>> = {
  ollama: OLLAMA_TASKS,
  anthropic: ANTHROPIC_TASKS,
};

export function taskConfig(
  task: TaskName,
  provider: ProviderName,
): TaskConfig {
  return TASKS_BY_PROVIDER[provider][task];
}

/** Models we need pulled before the local provider works. */
export const REQUIRED_OLLAMA_MODELS = Array.from(
  new Set(Object.values(OLLAMA_TASKS).map((c) => c.model)),
);
