import { MODEL_IDS, type ModelId } from "@/lib/claude/models";

/** USD per million tokens (Anthropic first-party API rates). */
interface ModelRate {
  input: number;
  output: number;
}

const RATES: Record<ModelId, ModelRate> = {
  [MODEL_IDS.haiku]: { input: 1.0, output: 5.0 },
  [MODEL_IDS.sonnet]: { input: 2.0, output: 10.0 },
  [MODEL_IDS.opus]: { input: 5.0, output: 25.0 },
};

/** Writing to the cache costs ~1.25x the input rate; reading ~0.1x. */
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const rate = RATES[model as ModelId];
  if (!rate) return 0; // unknown model — log zero rather than guess

  const cost =
    (usage.inputTokens * rate.input +
      usage.cacheCreationTokens * rate.input * CACHE_WRITE_MULTIPLIER +
      usage.cacheReadTokens * rate.input * CACHE_READ_MULTIPLIER +
      usage.outputTokens * rate.output) /
    1_000_000;

  return Number(cost.toFixed(6));
}

export function formatUsd(amount: number): string {
  if (amount === 0) return "$0";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
