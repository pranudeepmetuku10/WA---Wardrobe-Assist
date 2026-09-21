import { describe, expect, it } from "vitest";

import { ANTHROPIC_MODEL_IDS } from "@/lib/ai/models";
import { estimateCostUsd, formatUsd } from "@/lib/ai/pricing";

const noUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
};

describe("estimateCostUsd", () => {
  it("prices plain input and output at the model's rates", () => {
    // Haiku 4.5: $1/MTok in, $5/MTok out.
    const cost = estimateCostUsd(ANTHROPIC_MODEL_IDS.haiku, {
      ...noUsage,
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBe(6);
  });

  it("charges cache writes at 1.25x and cache reads at 0.1x input", () => {
    // Sonnet 5: $2/MTok in -> write 2.50, read 0.20.
    const cost = estimateCostUsd(ANTHROPIC_MODEL_IDS.sonnet, {
      ...noUsage,
      cacheCreationTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(2.7, 6);
  });

  it("makes a cached wardrobe catalog far cheaper than resending it", () => {
    const catalogTokens = 40_000;
    const fresh = estimateCostUsd(ANTHROPIC_MODEL_IDS.sonnet, {
      ...noUsage,
      inputTokens: catalogTokens,
    });
    const cached = estimateCostUsd(ANTHROPIC_MODEL_IDS.sonnet, {
      ...noUsage,
      cacheReadTokens: catalogTokens,
    });
    expect(cached).toBeLessThan(fresh * 0.15);
  });

  it("returns zero for local models and unknown models", () => {
    expect(
      estimateCostUsd("qwen3.5:9b", { ...noUsage, inputTokens: 1_000 }),
    ).toBe(0);
    expect(
      estimateCostUsd("some-future-model", { ...noUsage, inputTokens: 1_000 }),
    ).toBe(0);
  });
});

describe("formatUsd", () => {
  it("keeps sub-cent amounts readable", () => {
    expect(formatUsd(0.00042)).toBe("$0.0004");
    expect(formatUsd(1.5)).toBe("$1.50");
    expect(formatUsd(0)).toBe("$0");
  });
});
