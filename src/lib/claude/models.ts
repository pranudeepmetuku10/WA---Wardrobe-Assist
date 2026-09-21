/**
 * One place to pick the model tier per job, so tiers can be swapped or A/B'd
 * without touching call sites.
 *
 * Model IDs are complete as written — never append a date suffix.
 */

export const MODEL_IDS = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-5",
} as const;

export type ModelId = (typeof MODEL_IDS)[keyof typeof MODEL_IDS];

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Per-model request-shape rules. Sending a parameter a model rejects is a hard
 * 400, so callClaude consults this rather than assuming a uniform surface:
 *  - `effort` (output_config.effort) errors on Haiku 4.5.
 *  - Haiku 4.5 thinks only via `budget_tokens`; Sonnet 5 / Opus 5 reject it and
 *    use adaptive thinking instead.
 */
export interface ModelCapabilities {
  supportsEffort: boolean;
  thinking: "adaptive" | "budget" | "none";
}

export const MODEL_CAPABILITIES: Record<ModelId, ModelCapabilities> = {
  [MODEL_IDS.haiku]: { supportsEffort: false, thinking: "budget" },
  [MODEL_IDS.sonnet]: { supportsEffort: true, thinking: "adaptive" },
  [MODEL_IDS.opus]: { supportsEffort: true, thinking: "adaptive" },
};

export type TaskName =
  | "smoke"
  | "extract_garment"
  | "recommend_outfits"
  | "learn_preferences"
  | "style_review"
  | "eval_judge";

export interface TaskConfig {
  model: ModelId;
  maxTokens: number;
  /** Omitted for models that reject output_config.effort. */
  effort?: Effort;
  /** Adaptive thinking on/off for this task. */
  thinking: boolean;
}

export const TASK_MODELS: Record<TaskName, TaskConfig> = {
  // Connectivity check only — keep it cheap and short.
  smoke: { model: MODEL_IDS.haiku, maxTokens: 512, thinking: false },

  // High volume, narrow extraction from a photo. Cheapest tier.
  extract_garment: { model: MODEL_IDS.haiku, maxTokens: 4096, thinking: false },

  // The core stylist call — needs real judgment over ~40 candidates.
  recommend_outfits: {
    model: MODEL_IDS.sonnet,
    maxTokens: 8192,
    effort: "high",
    thinking: true,
  },

  // Periodic summarization of feedback into learned preferences.
  learn_preferences: {
    model: MODEL_IDS.sonnet,
    maxTokens: 4096,
    effort: "medium",
    thinking: true,
  },

  // Occasional, expensive, whole-wardrobe reasoning.
  style_review: {
    model: MODEL_IDS.opus,
    maxTokens: 16000,
    effort: "high",
    thinking: true,
  },

  // LLM-as-judge in the eval harness.
  eval_judge: {
    model: MODEL_IDS.sonnet,
    maxTokens: 2048,
    effort: "low",
    thinking: false,
  },
};
