import { ANTHROPIC_MODEL_IDS } from "@/lib/ai/models";

/** USD per million tokens. Local models are free — they are simply absent. */
interface ModelRate {
  input: number;
  output: number;
}

const RATES: Record<string, ModelRate> = {
  [ANTHROPIC_MODEL_IDS.haiku]: { input: 1.0, output: 5.0 },
  [ANTHROPIC_MODEL_IDS.sonnet]: { input: 2.0, output: 10.0 },
  [ANTHROPIC_MODEL_IDS.opus]: { input: 5.0, output: 25.0 },
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

export function emptyUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  };
}

/** Returns 0 for local models and for any model we have no rate for. */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const rate = RATES[model];
  if (!rate) return 0;

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
